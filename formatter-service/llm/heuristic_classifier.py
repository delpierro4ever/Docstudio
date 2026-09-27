# formatter-service/llm/heuristic_classifier.py

"""
Deterministic, rule-based block classifier.

Produces the same metadata shape as the LLM classifier (see
prompt_builder.py) so the formatting engine can run with no LLM at all:
when no API key is configured, when every model fails, or when the LLM
returns JSON we cannot use. It is also used to fill gaps in a partial
LLM answer.
"""

import re
from typing import Any, Dict, List, Optional

_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}
_ROMAN = {"i": 1, "v": 5, "x": 10, "l": 50}

# "CHAPTER ONE: INTRODUCTION", "Chapter 1 - Background", "CHAPTER IV"
_CHAPTER_RE = re.compile(
    r"^\s*chapter\s+([0-9]+|[ivxl]+|" + "|".join(_WORD_NUMBERS) + r")\b\s*[:.\-–—]?\s*(.*)$",
    re.IGNORECASE,
)
# "1.0 INTRODUCTION"
_CHAPTER_DOT_ZERO_RE = re.compile(r"^\s*(\d{1,2})\.0\s+(\S.*)$")
# "1.1 Background", "2.3.4 Data"
_NUMBERED_HEADING_RE = re.compile(r"^\s*(\d{1,2})\.(\d{1,2})((?:\.\d{1,2})*)\.?\s+(\S.*)$")
_CAPTION_RE = re.compile(r"^\s*(table|figure|fig\.)\s*[0-9ivxIVX]+([.\-]\d+)*\s*[:.\-–—]?\s*", re.IGNORECASE)

_PRELIM_HEADINGS = {
    "abstract", "dedication", "acknowledgement", "acknowledgements",
    "acknowledgment", "acknowledgments", "declaration", "certification",
    "approval", "preface", "foreword", "list of abbreviations",
    "abbreviations", "list of acronyms", "acronyms",
    "table of contents", "contents", "list of tables", "list of figures",
}
_REFERENCE_HEADINGS = {"references", "bibliography", "works cited", "reference list"}
_BACK_MATTER_HEADINGS = {"appendix", "appendices", "glossary", "index"}

# Headings stop being plausible past this length
_MAX_HEADING_CHARS = 120


def _to_int(token: str) -> Optional[int]:
    token = token.strip().lower()
    if token.isdigit():
        return int(token)
    if token in _WORD_NUMBERS:
        return _WORD_NUMBERS[token]
    if token and all(c in _ROMAN for c in token):
        total, prev = 0, 0
        for c in reversed(token):
            val = _ROMAN[c]
            total = total - val if val < prev else total + val
            prev = max(prev, val)
        return total
    return None


def _normalized_heading(text: str) -> str:
    return re.sub(r"[\s:.]+$", "", text.strip()).lower()


def _is_heading_length(text: str) -> bool:
    return 0 < len(text) <= _MAX_HEADING_CHARS and not text.endswith((",", ";"))


def _match_chapter(text: str) -> Optional[Dict[str, Any]]:
    if not _is_heading_length(text):
        return None
    m = _CHAPTER_RE.match(text)
    if m:
        num = _to_int(m.group(1))
        if num:
            return {"chapter": num, "title": text.strip()}
    m = _CHAPTER_DOT_ZERO_RE.match(text)
    if m:
        return {"chapter": int(m.group(1)), "title": text.strip()}
    return None


def classify_blocks_heuristically(blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Classify blocks with regex/keyword rules. Returns
    {"blocks": {...}, "sections": {...}, "structure": {...}, "classifier": "heuristic"}.
    """
    result: Dict[str, Any] = {}
    paragraphs = [b for b in blocks if b.get("type") == "paragraph"]
    by_id = {b.get("id"): b for b in blocks}

    # 1) The first chapter heading is the prelim/main boundary. Require a
    #    "Chapter N" match for the boundary if one exists anywhere, so that a
    #    stray "1.0 ..." line in the front matter doesn't end the prelims.
    first_chapter_id: Optional[str] = None
    for strict in (True, False):
        for b in paragraphs:
            text = (b.get("text") or "").strip()
            if strict and _CHAPTER_RE.match(text) and _match_chapter(text):
                first_chapter_id = b["id"]
                break
            if not strict and _match_chapter(text):
                first_chapter_id = b["id"]
                break
        if first_chapter_id:
            break

    section = "prelim" if first_chapter_id else "main"
    chapter = 0
    in_references = False
    references_heading_id: Optional[str] = None

    for b in blocks:
        bid = b.get("id")
        if not bid:
            continue
        if bid == first_chapter_id:
            section = "main"

        if b.get("type") == "table":
            result[bid] = {"role": "table", "section": section, "chapter": chapter or 1}
            continue
        if b.get("type") == "image":
            result[bid] = {"role": "figure", "section": section, "chapter": chapter or 1}
            continue

        text = (b.get("text") or "").strip()
        norm = _normalized_heading(text)
        meta: Dict[str, Any] = {"role": "body_paragraph", "section": section}

        chap = _match_chapter(text) if section == "main" else None
        numbered = _NUMBERED_HEADING_RE.match(text) if _is_heading_length(text) else None

        if chap:
            chapter = chap["chapter"]
            in_references = False
            meta.update(role="chapter_heading", chapter=chapter, headingLevel=1, title=chap["title"])
        elif norm in _REFERENCE_HEADINGS:
            in_references = True
            references_heading_id = references_heading_id or bid
            meta.update(role="references_heading", headingLevel=1, title=text)
        elif norm in _BACK_MATTER_HEADINGS or norm.startswith("appendix "):
            in_references = False
            meta.update(role="chapter_heading", headingLevel=1, title=text)
        elif section == "prelim" and norm in _PRELIM_HEADINGS:
            role = "abstract_heading" if norm == "abstract" else "section_heading"
            meta.update(role=role, title=text)
        elif numbered and section == "main" and not text.endswith("."):
            depth = 2 + len([p for p in numbered.group(3).split(".") if p])
            meta.update(
                role="section_heading" if depth == 2 else "subsection_heading",
                chapter=int(numbered.group(1)),
                headingLevel=min(depth, 3),
                title=text,
            )
        elif _CAPTION_RE.match(text) and _is_heading_length(text):
            meta["role"] = "caption"
        elif in_references and text:
            meta["role"] = "reference_entry"

        if chapter and "chapter" not in meta:
            meta["chapter"] = chapter
        result[bid] = meta

    # 2) Link tables/figures to their caption paragraphs.
    para_ids = [b["id"] for b in paragraphs]
    para_pos = {pid: i for i, pid in enumerate(para_ids)}
    for idx, b in enumerate(blocks):
        if b.get("type") not in ("table", "image"):
            continue
        caption_id = _find_caption_block(b, idx, blocks, by_id, para_ids, para_pos, result)
        info = result[b["id"]]
        if caption_id:
            info["caption_block_id"] = caption_id
            info["caption"] = _CAPTION_RE.sub("", by_id[caption_id].get("text") or "").strip() or None
            result[caption_id]["role"] = "caption"
        elif b.get("caption_guess"):
            info["caption"] = _CAPTION_RE.sub("", b["caption_guess"]).strip() or None

    structure: Dict[str, Any] = {}
    if references_heading_id:
        structure["references"] = {"title_block_id": references_heading_id}

    return {
        "blocks": result,
        "sections": {"prelim_ends_before_block_id": first_chapter_id},
        "structure": structure,
        "classifier": "heuristic",
    }


def _find_caption_block(
    block: Dict[str, Any],
    idx: int,
    blocks: List[Dict[str, Any]],
    by_id: Dict[str, Dict[str, Any]],
    para_ids: List[str],
    para_pos: Dict[str, int],
    result: Dict[str, Dict[str, Any]],
) -> Optional[str]:
    """
    The nearest non-empty paragraph, if it is a caption:
    tables look above first then below; figures look below first
    (relative to their parent paragraph) then above.
    """
    label = "table" if block.get("type") == "table" else "fig"

    def is_caption(pid: str) -> bool:
        text = (by_id[pid].get("text") or "").strip()
        return bool(_CAPTION_RE.match(text)) and text.lower().startswith(label) and _is_heading_length(text)

    def scan(start: int, step: int) -> Optional[str]:
        i, seen = start, 0
        while 0 <= i < len(para_ids) and seen < 1:
            pid = para_ids[i]
            text = (by_id[pid].get("text") or "").strip()
            if text:
                if is_caption(pid) and not _caption_taken(pid, result):
                    return pid
                seen += 1
            i += step
        return None

    if block.get("type") == "image":
        parent = block.get("parent")
        if parent in para_pos:
            pos = para_pos[parent]
            if is_caption(parent) and not _caption_taken(parent, result):
                return parent
            return scan(pos + 1, 1) or scan(pos - 1, -1)
        return None

    # Table: position between paragraphs = count of paragraphs before it
    before = sum(1 for b in blocks[:idx] if b.get("type") == "paragraph")
    return scan(before - 1, -1) or scan(before, 1)


def _caption_taken(pid: str, result: Dict[str, Dict[str, Any]]) -> bool:
    return any(m.get("caption_block_id") == pid for m in result.values())
