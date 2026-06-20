# formatter-service/config/profiles.py

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional, List

# Very safe built-in fallback if JSON is missing/broken
_FALLBACK_PROFILE: Dict[str, Any] = {
    "id": "fallback",
    "name": "Fallback Profile",
    "description": "Used when formattingRules.json cannot be loaded.",
    "font": {
        "family": "Times New Roman",
        "size": 12,
    },
    "paragraph": {
        "justify": True,
        "lineSpacing": 1.5,
        "spaceBefore": 0,
        "spaceAfter": 0,
        "firstLineIndentCm": 0.0,
    },
    "margins": {
        "topCm": 2.5,
        "bottomCm": 2.5,
        "leftCm": 3.0,
        "rightCm": 2.5,
    },
    "headings": {},
    "sections": {},
    "structure": {},
    "toc": {},
}


def _load_rules_json() -> Dict[str, Any]:
    """
    Try to load config/formattingRules.json.

    If anything fails (file not found, bad JSON, etc.), we log a warning
    and return a minimal fallback config so the formatter still works.
    """
    base_dir = os.path.dirname(__file__)
    json_path = os.path.join(base_dir, "formattingRules.json")

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Basic sanity
        if not isinstance(data, dict):
            raise ValueError("formattingRules.json root is not an object")
        return data
    except Exception as exc:
        print(f"[WARN] Could not load formattingRules.json at {json_path}: {exc}")
        return {
            "defaultProfileId": "fallback",
            "textProfiles": [_FALLBACK_PROFILE],
        }


def load_profile(profile_id: Optional[str]) -> Dict[str, Any]:
    """
    Given a profile id (e.g. 'ub-v1') coming from the backend / frontend,
    return the matching profile from formattingRules.json.

    Fallback behavior:
      • If profile_id is None or not found → use defaultProfileId
      • If defaultProfileId not found → first profile
      • If no profiles at all → _FALLBACK_PROFILE
    """
    rules = _load_rules_json()
    profiles: List[Dict[str, Any]] = rules.get("textProfiles") or []
    default_id: Optional[str] = rules.get("defaultProfileId")

    # 1) Try exact profile_id from caller
    if profile_id:
        for p in profiles:
            if p.get("id") == profile_id:
                return p

    # 2) Try defaultProfileId from JSON
    if default_id:
        for p in profiles:
            if p.get("id") == default_id:
                return p

    # 3) Fallback to first profile
    if profiles:
        return profiles[0]

    # 4) Extreme fallback
    return _FALLBACK_PROFILE
