# formatting/body.py

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt
from docx.oxml.ns import qn

BODY_FONT_NAME = "Times New Roman"
BODY_FONT_SIZE_PT = 12
BODY_LINE_SPACING = 1.5

NON_JUSTIFIED_STYLES = {
    "Title",
    "Subtitle",
    "Heading 1",
    "Heading 2",
    "Heading 3",
    "Heading 4",
    "Heading 5",
    "TOC Heading",
}


def apply_body_font(paragraph):
    """Force Times New Roman 12pt on all runs in the paragraph."""
    for run in paragraph.runs:
        font = run.font
        font.name = BODY_FONT_NAME
        font.size = Pt(BODY_FONT_SIZE_PT)

        # Fix inline fonts at XML level too
        if font.element.rPr is not None:
            rPr = font.element.rPr
            rFonts = rPr.rFonts
            rFonts.set(qn("w:ascii"), BODY_FONT_NAME)
            rFonts.set(qn("w:hAnsi"), BODY_FONT_NAME)
            rFonts.set(qn("w:cs"), BODY_FONT_NAME)


def apply_paragraph_format(paragraph):
    """Line spacing + justification for normal body paragraphs."""
    text = paragraph.text.strip()
    if not text:
        return

    style_name = (paragraph.style.name or "").strip()

    pf = paragraph.paragraph_format
    pf.line_spacing = BODY_LINE_SPACING
    pf.space_before = Pt(0)
    pf.space_after = Pt(6)  # small gap between paragraphs

    if style_name not in NON_JUSTIFIED_STYLES:
        paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
