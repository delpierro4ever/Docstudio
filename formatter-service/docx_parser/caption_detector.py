# formatter-service/docx_parser/caption_detector.py

from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

CAPTION_KEYWORDS = ["table", "figure", "fig.", "image", "chart"]


def looks_like_caption(text: str) -> bool:
    t = text.lower().strip()
    return any(word in t for word in CAPTION_KEYWORDS)


def guess_caption_from_context(element):
    """
    Check previous and next elements for caption-like text.
    """
    prev_el = element.getprevious()
    if prev_el is not None and prev_el.tag == qn("w:p"):
        prev_text = Paragraph(prev_el, None).text.strip()
        if looks_like_caption(prev_text):
            return prev_text

    next_el = element.getnext()
    if next_el is not None and next_el.tag == qn("w:p"):
        next_text = Paragraph(next_el, None).text.strip()
        if looks_like_caption(next_text):
            return next_text

    return None
