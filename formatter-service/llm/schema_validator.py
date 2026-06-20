# formatter-service/llm/schema_validator.py

import json
from typing import Dict, Any, List


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


def parse_llm_json(raw: str) -> Dict[str, Any]:
    """
    Clean + parse JSON from LLM.
    Raises ValueError if parsing fails.
    """
    cleaned = clean_llm_json_text(raw)
    return json.loads(cleaned)


def normalize_classification(
    data: Dict[str, Any],
    blocks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Ensure 'blocks' and 'sections' objects exist
    and that each known block id has at least a default classification.
    """
    if "blocks" not in data or not isinstance(data["blocks"], dict):
        data["blocks"] = {}

    if "sections" not in data or not isinstance(data["sections"], dict):
        data["sections"] = {}

    if "prelim_ends_before_block_id" not in data["sections"]:
        data["sections"]["prelim_ends_before_block_id"] = None

    classified_blocks = data["blocks"]

    # Fill defaults for any missing block ids
    for block in blocks:
        block_id = block.get("id")
        if not block_id:
            continue

        if block_id not in classified_blocks:
            # Default classification: body_paragraph, section unknown → assume "main"
            classified_blocks[block_id] = {
                "role": "body_paragraph",
                "section": "main",
            }

    return data
