from typing import Dict, Any, Optional

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.enum.section import WD_SECTION 


def insert_table_of_contents(
    doc: Document, 
    metadata: Dict[str, Any], 
    anchor_para: Optional[Paragraph] = None,
    is_last_prelim_page: bool = False
) -> Optional[Paragraph]:
    """
    Inserts a TABLE OF CONTENTS title and a functional TOC field BEFORE the anchor_para.
    A page break is inserted immediately before the title (or a section break if it's the last prelim item).
    
    Returns the inserted title paragraph (which acts as the new anchor).
    """
    toc_meta: Dict[str, Any] = metadata.get("toc", {})

    if toc_meta is not None and not toc_meta.get("autoInsert", True):
        return None
    
    # --- 1. NEW PAGE/SECTION BREAK ---
    break_anchor = anchor_para
    # CRITICAL: Skip break only if the anchor is the absolute first paragraph in the doc 
    is_first_paragraph_in_doc = (break_anchor is not None and break_anchor == doc.paragraphs[0])
    
    if break_anchor is not None and not is_first_paragraph_in_doc:
        break_para = break_anchor.insert_paragraph_before()
        
        if is_last_prelim_page:
            # Insert a paragraph with a NEXT_PAGE section break (separates Prelim from Main)
            break_para.add_run().add_break(WD_SECTION.NEXT_PAGE)
        else:
            # Insert a simple page break to separate prelim pages (TOC, LOT, LOF)
            break_para.add_run().add_break(WD_BREAK.PAGE)
    
    
    # --- 2. INSERT TOC FIELD (just before the title) ---
    if anchor_para is not None:
        toc_para = anchor_para.insert_paragraph_before()
    else:
        # Fallback to appending if no anchor provided
        toc_para = doc.add_paragraph()
        
    _add_toc_field(toc_para, toc_meta or {})


    # --- 3. INSERT TOC TITLE (just before the field) ---
    title_text = toc_meta.get("titleText", "TABLE OF CONTENTS")
    title_style_name = toc_meta.get("titleStyleName", "Heading 1")

    title_para = toc_para.insert_paragraph_before(title_text)

    try:
        title_para.style = title_style_name
    except Exception:
        pass

    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # The inserted title paragraph becomes the new anchor for the next item in the reverse flow
    return title_para


def _add_toc_field(paragraph, toc_meta: Dict[str, Any]) -> None:
    # ... (function body remains the same) ...
    """
    Inserts a functional TOC field that Word can update via
    "Update Field" → "Update entire table".
    """
    levels = toc_meta.get("includeHeadingLevels", [1, 2, 3])
    if not levels:
        levels = [1, 2, 3]

    min_level = min(levels)
    max_level = max(levels)
    o_switch = f'\\o "{min_level}-{max_level}"'

    paragraph.clear()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT

    # 1) Begin field: <w:fldChar w:fldCharType="begin" w:dirty="true"/>
    run = paragraph.add_run()
    fld_char_begin = OxmlElement("w:fldChar")
    fld_char_begin.set(qn("w:fldCharType"), "begin")
    fld_char_begin.set(qn("w:dirty"), "true") 
    run._r.append(fld_char_begin)

    # 2) Instruction text: <w:instrText xml:space="preserve"> TOC ... </w:instrText>
    run = paragraph.add_run()
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = f' TOC {o_switch} \\h \\z \\u '
    run._r.append(instr_text)

    # 3) Separate
    run = paragraph.add_run()
    fld_char_sep = OxmlElement("w:fldChar")
    fld_char_sep.set(qn("w:fldCharType"), "separate")
    run._r.append(fld_char_sep)

    # 4) Placeholder result run
    placeholder_run = paragraph.add_run()
    placeholder_run.text = "Updating table of contents..."
    placeholder_run.italic = True

    # 5) End
    run = paragraph.add_run()
    fld_char_end = OxmlElement("w:fldChar")
    fld_char_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char_end)