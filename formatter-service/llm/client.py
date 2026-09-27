# formatter-service/llm/client.py

import os
import requests
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from .prompt_builder import LLMPromptBuilder
from .schema_validator import parse_llm_json, normalize_classification
from .heuristic_classifier import classify_blocks_heuristically

load_dotenv()


class LLMClassifier:
    """
    Wraps the LLM call for block classification.
    Uses OpenRouter by default. Never raises: with no API key, when every
    model fails, or when no model returns usable JSON, the rule-based
    heuristic classifier's result is returned instead.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")

        self.api_url = api_url or os.getenv(
            "LLM_API_URL",
            "https://openrouter.ai/api/v1/chat/completions",
        )
        # Primary model (can be env override)
        primary_model = model or os.getenv("LLM_MODEL", "x-ai/grok-4.1-fast:free")

        # Fallback models (optional; you can tweak this list)
        self.models_to_try: List[str] = list(dict.fromkeys([
            primary_model,
            "openai/gpt-4o-mini",
            "openai/gpt-4.1-nano",
        ]))

        self.prompt_builder = LLMPromptBuilder()

    def classify_document_blocks(
        self,
        blocks: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Main entrypoint: takes blocks[], returns classification JSON.
        """
        heuristic = classify_blocks_heuristically(blocks)

        if not self.api_key:
            print("[INFO] OPENROUTER_API_KEY not set; using heuristic classifier")
            return heuristic

        print("🤖 Starting LLM classification...")

        system_prompt = self.prompt_builder.build_system_prompt()
        classification_view = self.prompt_builder.build_classification_view(blocks)

        for model_name in self.models_to_try:
            try:
                print(f"🔄 Trying model: {model_name}")
                result_text = self._call_llm(
                    system_prompt=system_prompt,
                    user_prompt=classification_view,
                    model=model_name,
                )

                data = parse_llm_json(result_text)
                normalized = normalize_classification(data, blocks, fallback=heuristic)
                normalized["classifier"] = f"llm:{model_name}"
                print("🎯 LLM classification completed successfully")
                return normalized

            except Exception as e:
                print(f"❌ Model {model_name} failed: {e}")
                continue

        print("[WARN] All LLM models failed; using heuristic classifier")
        return heuristic

    def _call_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
    ) -> str:
        """
        Perform a single call to the LLM via OpenRouter.
        Returns the raw content string from the assistant.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            # Optional metadata for OpenRouter
            "HTTP-Referer": "http://localhost:8082",
            "X-Title": "DocStudio Formatter",
        }

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 4000,
        }

        print("📡 Sending request to LLM API...")
        resp = requests.post(self.api_url, json=payload, headers=headers, timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "60")))
        resp.raise_for_status()

        data = resp.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ValueError(f"Unexpected LLM response shape: {exc}") from exc
        print("✅ Received response from LLM")
        return content
