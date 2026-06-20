# formatter-service/config/profile_loader.py

import json
import os
from functools import lru_cache


CONFIG_PATH = os.path.join(
    os.path.dirname(__file__),
    "formattingRules.json"
)


@lru_cache(maxsize=1)
def _load_config() -> dict:
    """Load formattingRules.json once (cached)."""
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(f"Missing config file: {CONFIG_PATH}")

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_profile_by_id(profile_id: str) -> dict:
    """Return the formatting profile matching profile_id."""

    config = _load_config()
    profiles = config.get("textProfiles", [])
    default_id = config.get("defaultProfileId")

    # First try exact match
    for p in profiles:
        if p.get("id") == profile_id:
            return p

    # Fallback to default
    for p in profiles:
        if p.get("id") == default_id:
            return p

    # Fallback to first
    if profiles:
        return profiles[0]

    raise ValueError("No textProfiles defined in formattingRules.json")
