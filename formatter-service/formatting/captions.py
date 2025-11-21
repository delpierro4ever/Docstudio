# formatter-service/formatting/captions.py

import re
from docx import Document
from docx.text.paragraph import Paragraph
from docx.table import Table
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn


# ---------- Helpers to walk blocks (paragraphs + tables) ----------

def iter_block_items(doc: Document):
    """
    Iterate over top-level block items in document order:
    returns Paragraph or Table objects.
    """
    body = doc.element.body
    for child in body.iterchildren():
        if child.tag.endswith("p"):
            yield Paragraph(child, doc)
        elif child.tag.endswith("tbl"):
            yield Table(child, doc)


def _first_non_empty_paragraph_before(blocks, index):
    for i in range(index - 1, -1, -1):
        b = blocks[i]
        if isinstance(b, Paragraph) and (b.text or "").strip():
            return b
    return None


def _first_non_empty_paragraph_after(blocks, index):
    for i in range(index + 1, len(blocks)):
        b = blocks[i]
        if isinstance(b, Paragraph) and (b.text or "").strip():
            return b
    return None


# ---------- Caption “looks like” checks ----------

def _looks_like_table_caption(text: str) -> bool:
    """
    Heuristic:
    - Contains the word 'table' or 'tab.'
    - Often phrases like 'A table showing...', 'A table of...', etc.
    """
    if not text:
        return False
    lower = text.lower()
    if "table" in lower or "tab." in lower:
        return True
    return False


def _looks_like_figure_caption(text: str) -> bool:
    """
    Heuristic for figures:
    - Contains 'figure', 'fig.', 'photo', 'picture', 'pic'
    - Students often write: 'Picture showing ...', 'Photo of ...'
    """
    if not text:
        return False
    lower = text.lower()
    keywords = ["figure", "fig.", "photo", "picture", "pic"]
    return any(k in lower for k in keywords)


# ---------- Normalization of captions (add Table 1 / Figure 1) ----------

def _normalize_table_caption(raw: str, index: int) -> (str, int):
    """
    Convert arbitrary label like:
      'A table showing distribution of age...'
    or:
      'Table 2: Distribution of age...'
    into:
      'Table 1: A table showing distribution of age...'
    (or re-numbered according to index).
    """
    raw = raw.strip()
    if not raw:
        return f"Table {index}", index + 1

    # If already starts with 'Table' or 'Tab.', strip existing number, keep title.
    m = re.match(r"^(table|tab\.)\s*\d*\s*[:\-]?\s*(.*)$", raw, re.IGNORECASE)
    if m:
        title = m.group(2).strip()
        return (f"Table {index}: {title}" if title else f"Table {index}"), index + 1

    # Otherwise, just prefix
    return f"Table {index}: {raw}", index + 1


def _normalize_figure_caption(raw: str, index: int) -> (str, int):
    """
    Convert labels like:
      'Photo showing ...', 'Picture of ...', 'Figure 3: ...'
    into:
      'Figure 1: Photo showing ...'
    """
    raw = raw.strip()
    if not raw:
        return f"Figure {index}", index + 1

    # If already starts with Figure/Fig/Photo/Picture, strip number, keep title
    m = re.match(
        r"^(figure|fig\.|photo|picture|pic)\s*\d*\s*[:\-]?\s*(.*)$",
        raw,
        re.IGNORECASE,
    )
    if m:
        title = m.group(2).strip()
        if title:
            return f"Figure {index}: {title}", index + 1
        else:
            return f"Figure {index}", index + 1

    # Otherwise, just prefix
    return f"Figure {index}: {raw}", index + 1


# ---------- Styling helpers ----------

def _set_paragraph_font(
    paragraph: Paragraph,
    name: str = "Times New Roman",
    size_pt: int = 11,
    bold: bool = False,
    italic: bool = True,
):
    """
    Apply font styling to all runs in a caption paragraph.
    Default:
      - Times New Roman
      - 11pt
      - italic
      - not bold
    """
    for run in paragraph.runs:
        font = run.font
        font.name = name
        font.size = Pt(size_pt)
        font.bold = bold
        font.italic = italic

        # fix underlying XML font
        if font.element.rPr is not None:
            rPr = font.element.rPr
            rFonts = rPr.rFonts
            rFonts.set(qn("w:ascii"), name)
            rFonts.set(qn("w:hAnsi"), name)
            rFonts.set(qn("w:cs"), name)


def _style_table_caption(paragraph: Paragraph):
    """
    UB-style-ish:
    - Table captions above the table
    - Left aligned
    - Times New Roman 11pt, italic
    """
    pf = paragraph.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
    pf.space_before = Pt(6)
    pf.space_after = Pt(3)

    _set_paragraph_font(paragraph, size_pt=11, bold=False, italic=True)


def _style_figure_caption(paragraph: Paragraph):
    """
    Common style:
    - Figure captions below the image
    - Centered
    - Times New Roman 11pt, italic
    """
    pf = paragraph.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pf.space_before = Pt(3)
    pf.space_after = Pt(6)

    _set_paragraph_font(paragraph, size_pt=11, bold=False, italic=True)


# ---------- Main processing logic ----------

def process_captions(doc: Document) -> None:
    """
    High-level caption logic based on real student behavior:

    TABLES:
      - Students might write:
          "A table of ...", "A table showing ...", or "Table 1: ..."
      - Usually this is the sentence just before OR just after the table.
      - We:
          * Look at last non-empty paragraph before the table
          * Or first non-empty paragraph after the table
          * If it mentions 'table', treat it as caption
          * Normalize to 'Table N: ...'
          * Ensure caption is ABOVE the table.

    FIGURES:
      - Students write:
          "Picture/Photo/Figure of ... (showing ...)"
      - Usually this is the first sentence AFTER the photo.
      - We:
          * Detect paragraphs that contain an image
          * Take the next non-empty paragraph as caption
          * Normalize to 'Figure N: ...'
          * Keep it below the image.
    """
    blocks = list(iter_block_items(doc))

    table_index = 1
    figure_index = 1

    # ----- TABLE CAPTIONS -----
    for i, blk in enumerate(blocks):
        if not isinstance(blk, Table):
            continue

        tbl = blk

        # Candidate paragraphs: before and after
        before_p = _first_non_empty_paragraph_before(blocks, i)
        after_p = _first_non_empty_paragraph_after(blocks, i)

        chosen_para = None
        came_from_after = False

        # Prefer 'table-like' text that mentions table
        if before_p and _looks_like_table_caption(before_p.text):
            chosen_para = before_p
        elif after_p and _looks_like_table_caption(after_p.text):
            chosen_para = after_p
            came_from_after = True

        if not chosen_para:
            continue  # no good caption near this table

        # Normalize text and increment table counter
        new_text, table_index = _normalize_table_caption(chosen_para.text, table_index)
        chosen_para.text = new_text
        _style_table_caption(chosen_para)

        # If caption was AFTER the table, move it ABOVE the table
        if came_from_after:
            tbl_elm = tbl._element
            cap_elm = chosen_para._p
            tbl_elm.addprevious(cap_elm)

    # Rebuild blocks list because we may have reordered paragraphs
    blocks = list(iter_block_items(doc))

    # ----- FIGURE CAPTIONS -----
    # Image detection: any paragraph containing a <w:drawing> element.
    for idx, blk in enumerate(blocks):
        if not isinstance(blk, Paragraph):
            continue

        p = blk
        has_drawing = bool(p._p.xpath(".//w:drawing"))
        if not has_drawing:
            continue

        # Find next non-empty paragraph
        caption_para = _first_non_empty_paragraph_after(blocks, idx)
        if not caption_para:
            continue

        # Even if text doesn’t explicitly say “picture/photo/figure”,
        # we still treat first sentence after image as caption.
        new_text, figure_index = _normalize_figure_caption(
            caption_para.text, figure_index
        )
        caption_para.text = new_text
        _style_figure_caption(caption_para)
