# formatting/sections.py

from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt
import re


CHAPTER_REGEX = re.compile(r"^\s*chapter\s+\d+", re.IGNORECASE)


def find_first_chapter_paragraph(doc):
    """Return the first 'Chapter X' paragraph object or None."""
    for p in doc.paragraphs:
        if CHAPTER_REGEX.match(p.text.strip()):
            return p
    return None


def insert_section_break_before(paragraph):
    """
    Insert a section break BEFORE the given paragraph.
    This creates:
    - Section 1: prelims (roman numbers)
    - Section 2: main body (arabic numbers)
    """
    p = paragraph._p  # raw XML <w:p>
    sectPr = OxmlElement("w:sectPr")
    typeEl = OxmlElement("w:type")
    typeEl.set(qn("w:val"), "nextPage")
    sectPr.append(typeEl)

    p.addprevious(sectPr)


def _set_footer_page_number_style(section, number_format="decimal", start_at=None):
    """
    Modify footer of a section to use:
    - number_format: "decimal", "roman", "ROMAN"
    - restart at: start_at (integer) or None
    """
    sectPr = section._sectPr

    # 1) Page numbering properties <w:pgNumType>
    pgNumType = sectPr.find(qn("w:pgNumType"))
    if pgNumType is None:
        pgNumType = OxmlElement("w:pgNumType")
        sectPr.append(pgNumType)

    # Set number style
    pgNumType.set(qn("w:fmt"), number_format)

    # Restart numbering if requested
    if start_at is not None:
        pgNumType.set(qn("w:start"), str(start_at))


def apply_page_numbering_styles(doc):
    """
    After inserting a section break at Chapter 1:
    - Section 1 → roman numerals
    - Section 2 → arabic (restart at 1)
    """
    sections = doc.sections

    if len(sections) == 1:
        # No section break inserted → keep default Arabic
        return

    prelim = sections[0]
    main = sections[1]

    _set_footer_page_number_style(prelim, number_format="roman", start_at=1)
    _set_footer_page_number_style(main, number_format="decimal", start_at=1)
