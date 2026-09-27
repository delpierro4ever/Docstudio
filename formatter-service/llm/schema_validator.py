# formatter-service/llm/schema_validator.py

import json
from typing import Dict, Any, List, Optional

_VALID_SECTIONS = {"prelim", "main"}


def clean_llm_json_text(raw: str) -> str:
    """
    Remove common markdown fences around JSON (```json ... ```).
    """
    text = raw.strip()

    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    return text.strip()


def parse_llm_json(raw: Optional[str]) -> Dict[str, Any]:
    """
    Clean + parse JSON from LLM. Tolerates markdown fences and prose
    around the object by falling back to the outermost {...} span.
    Raises ValueError if no JSON object can be recovered.
    """
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("LLM returned an empty response")

    cleaned = clean_llm_json_text(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("LLM response contains no JSON object")
        try:
            data = json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError(f"LLM response is not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(f"LLM JSON must be an object, got {type(data).__name__}")
    return data


def normalize_classification(
    data: Dict[str, Any],
    blocks: List[Dict[str, Any]],
    fallback: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Make LLM output safe for the formatter:
      - 'blocks' and 'sections' objects exist
      - entries for unknown block ids or of the wrong type are dropped
      - every known block id has a classification, taken from `fallback`
        (heuristic metadata) when given, else body_paragraph/main
      - prelim_ends_before_block_id names a real paragraph, else the
        fallback's boundary is used

    Raises ValueError when the answer is unusable (no valid block entries).
    """
    fallback = fallback or {}
    fb_blocks: Dict[str, Any] = fallback.get("blocks", {}) or {}
    known_ids = {b.get("id") for b in blocks if b.get("id")}
    paragraph_ids = {b.get("id") for b in blocks if b.get("type") == "paragraph"}

    raw_blocks = data.get("blocks")
    if not isinstance(raw_blocks, dict):
        raise ValueError("LLM JSON has no 'blocks' object")

    classified: Dict[str, Any] = {}
    for block_id, meta in raw_blocks.items():
        if block_id not in known_ids or not isinstance(meta, dict):
            continue
        if not isinstance(meta.get("role"), str):
            continue
        if meta.get("section") not in _VALID_SECTIONS:
            meta.pop("section", None)
        classified[block_id] = meta

    if not classified:
        raise ValueError("LLM JSON classified none of the document's blocks")

    for block in blocks:
        block_id = block.get("id")
        if not block_id:
            continue
        default = fb_blocks.get(block_id) or {"role": "body_paragraph", "section": "main"}
        if block_id not in classified:
            classified[block_id] = dict(default)
        elif "section" not in classified[block_id]:
            classified[block_id]["section"] = default.get("section", "main")

    sections = data.get("sections")
    if not isinstance(sections, dict):
        sections = {}
    boundary = sections.get("prelim_ends_before_block_id")
    if boundary not in paragraph_ids:
        boundary = (fallback.get("sections", {}) or {}).get("prelim_ends_before_block_id")
    sections["prelim_ends_before_block_id"] = boundary

    _assign_media_chapters(blocks, classified)

    data["blocks"] = classified
    data["sections"] = sections
    if not isinstance(data.get("structure"), dict) or not data["structure"]:
        data["structure"] = fallback.get("structure", {}) or {}
    return data


def _assign_media_chapters(
    blocks: List[Dict[str, Any]],
    classified: Dict[str, Any],
) -> None:
    """
    Set each table/figure's chapter from its position: the chapter of the
    nearest preceding chapter_heading. LLMs often omit or misnumber this,
    which would caption a Chapter 2 table as "Table 1.1".
    """
    current = 0
    for block in blocks:
        meta = classified.get(block.get("id"))
        if not meta:
            continue
        role = meta.get("role")
        if role == "chapter_heading":
            try:
                current = int(meta.get("chapter"))
            except (TypeError, ValueError):
                current += 1
            meta["chapter"] = current
        elif role in ("table", "figure"):
            meta["chapter"] = current or 1
