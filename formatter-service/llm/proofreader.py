# formatter-service/llm/proofreader.py

"""
LLM grammar/spelling correction pass.

The classification prompt deliberately forbids rewriting (it only labels
blocks), so this module makes a SEPARATE, correction-only LLM call for
body paragraphs. It is strictly best-effort: any failure (no API key,
network error, malformed response) leaves the document text untouched.

Controlled by DOCSTUDIO_PROOFREAD (default: enabled).
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv

from .schema_validator import parse_llm_json

load_dotenv()

_BATCH_SIZE = 20
_MIN_PARAGRAPH_LEN = 25  # skip fragments; they're usually labels/headings

_SYSTEM_PROMPT = """You are an academic copy editor.
You will receive numbered paragraphs from a student report.
Correct ONLY grammar, spelling, punctuation, and obvious typos.

STRICT RULES:
1. Preserve the author's meaning, terminology, tone, and sentence order.
2. Do NOT paraphrase, shorten, expand, or "improve" style.
3. Do NOT touch citations, references, numbers, names, or acronyms.
4. If a paragraph needs no correction, OMIT it from your answer.
5. Return STRICT JSON only — an object mapping paragraph id to the fully
   corrected paragraph text. No commentary, no markdown fences.

Example output:
{"P4": "The data were collected over three months.", "P9": "Its impact is significant."}
"""


def proofreading_enabled() -> bool:
    flag = os.getenv("DOCSTUDIO_PROOFREAD", "1").strip().lower()
    return flag not in ("0", "false", "no", "off")


class Proofreader:
    """Correction-only LLM wrapper (OpenRouter, same stack as LLMClassifier)."""

    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.api_url = os.getenv(
            "LLM_API_URL",
            "https://openrouter.ai/api/v1/chat/completions",
        )
        primary_model = os.getenv("LLM_MODEL", "x-ai/grok-4.1-fast:free")
        self.models_to_try: List[str] = [
            primary_model,
            "google/gemini-3-pro-preview",
            "kwaipilot/kat-coder-pro:free",
        ]

    def correct_texts(self, texts: Dict[str, str]) -> Dict[str, str]:
        """
        Take {block_id: original_text}, return {block_id: corrected_text}
        containing ONLY the paragraphs the model changed. Never raises.
        """
        if not self.api_key:
            print("[WARN] Proofreader skipped: OPENROUTER_API_KEY not set")
            return {}

        corrections: Dict[str, str] = {}
        items = list(texts.items())

        for start in range(0, len(items), _BATCH_SIZE):
            batch = dict(items[start:start + _BATCH_SIZE])
            try:
                corrections.update(self._correct_batch(batch))
            except Exception as exc:
                print(f"[WARN] Proofreader batch {start // _BATCH_SIZE + 1} failed: {exc}")
                continue

        return corrections

    def _correct_batch(self, batch: Dict[str, str]) -> Dict[str, str]:
        user_prompt = "\n\n".join(f"[{bid}] {text}" for bid, text in batch.items())

        last_error: Exception | None = None
        for model in self.models_to_try:
            try:
                raw = self._call_llm(user_prompt, model)
                data = parse_llm_json(raw)
                if not isinstance(data, dict):
                    raise ValueError("Proofreader response is not a JSON object")
                return self._sanitize(data, batch)
            except Exception as exc:
                last_error = exc
                continue

        raise RuntimeError(f"All proofreader models failed: {last_error}")

    @staticmethod
    def _sanitize(data: Dict[str, Any], batch: Dict[str, str]) -> Dict[str, str]:
        """
        Keep only corrections for ids we actually sent, with sane content.
        Guards against the model inventing ids, returning empty strings, or
        rewriting a paragraph beyond recognition (length ratio check).
        """
        clean: Dict[str, str] = {}
        for bid, corrected in data.items():
            if bid not in batch or not isinstance(corrected, str):
                continue
            corrected = corrected.strip()
            original = batch[bid].strip()
            if not corrected or corrected == original:
                continue
            ratio = len(corrected) / max(len(original), 1)
            if not (0.5 <= ratio <= 2.0):
                print(f"[WARN] Proofreader rewrite for {bid} out of bounds; discarded")
                continue
            clean[bid] = corrected
        return clean

    def _call_llm(self, user_prompt: str, model: str) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8082",
            "X-Title": "DocStudio Proofreader",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.0,
            "max_tokens": 8000,
        }
        resp = requests.post(self.api_url, json=payload, headers=headers, timeout=90)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def collect_proofread_candidates(
    blocks: List[Dict[str, Any]],
    metadata: Dict[str, Any],
) -> Dict[str, str]:
    """
    Pick the paragraphs worth proofreading: body/abstract text, long
    enough to contain sentences. Headings, captions, TOC lines, and
    reference entries are left alone.
    """
    block_meta: Dict[str, Any] = metadata.get("blocks", {}) or {}
    candidates: Dict[str, str] = {}

    for block in blocks:
        if block.get("type") != "paragraph":
            continue

        text = (block.get("text") or "").strip()
        if len(text) < _MIN_PARAGRAPH_LEN:
            continue

        role = (block_meta.get(block.get("id"), {}) or {}).get("role", "body_paragraph")
        if role not in ("body_paragraph", "abstract_paragraph"):
            continue

        candidates[block["id"]] = text

    return candidates
