from typing import Dict, Any, List, Optional, Tuple

from docx import Document 
from docx.text.paragraph import Paragraph
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH


def _move_paragraph_before(paragraph: Paragraph, target_paragraph: Paragraph):
    """
    Moves a paragraph to a position immediately preceding another paragraph
    by manipulating the underlying XML structure.
    """
    # Ensure the paragraph element is detached from its current parent before insertion
    parent = paragraph._element.getparent()
    if parent is not None:
        parent.remove(paragraph._element)

    # Insert the paragraph's XML element immediately before the target's element
    target_paragraph._element.getparent().insert(
        target_paragraph._element.getparent().index(target_paragraph._element),
        paragraph._element
    )

def _get_paragraph_by_block_id(doc: Document, blocks: List[Dict[str, Any]], block_id: str) -> Optional[Paragraph]:
    """Helper to get a Paragraph object by its block ID."""
    para_index = _get_paragraph_index_for_block(blocks, block_id, doc.paragraphs)
    if para_index is not None:
        return doc.paragraphs[para_index]
    return None

def _get_generated_prelim_pair(doc: Document, title_text: str) -> Optional[Tuple[Paragraph, Optional[Paragraph]]]:
    """
    Helper to find the generated title and the paragraph immediately following it (the field).
    Searches from the end of the document where generated content is appended.
    """
    title_para = None
    field_para = None
    
    # Search from the end of the document
    for i in reversed(range(len(doc.paragraphs))):
        p = doc.paragraphs[i]
        if p.text.strip().upper() == title_text:
            title_para = p
            
            # The field paragraph is immediately after the title in the original list
            if (i + 1 < len(doc.paragraphs)):
                 # We must check if the next paragraph looks like a field, i.e., placeholder text or short
                 field_para_candidate = doc.paragraphs[i + 1]
                 # Heuristic check for the field paragraph placeholder text (e.g., "Updating...")
                 if "UPDATING" in field_para_candidate.text.upper() or len(field_para_candidate.text.strip()) < 50:
                    field_para = field_para_candidate
            break
            
    if title_para:
        return title_para, field_para
    return None


def _reorder_preliminary_content(doc: Document, blocks: List[Dict[str, Any]], metadata: Dict[str, Any]) -> None:
    """
    Reorders specific preliminary pages (TOC, LOT, LOF, etc.) to follow
    the order defined in the profile (via metadata).
    """
    
    profile_structure = metadata.get("structure", {})
    required_order = profile_structure.get("order", [])
    structure_meta = metadata.get("structure", {})
    
    # Map from profile key to the metadata key for the block ID
    prelim_block_map: Dict[str, str] = {
        "titlePage": structure_meta.get("title_page_block_id"),
        "dedication": structure_meta.get("dedication_title_block_id"),
        "acknowledgement": structure_meta.get("acknowledgement_title_block_id"),
        "abstract": structure_meta.get("abstract_title_block_id"),
        "tableOfContents": structure_meta.get("toc_title_block_id"),
        "listOfTables": structure_meta.get("lot_title_block_id"),
        "listOfFigures": structure_meta.get("lof_title_block_id"),
        "abbreviations": structure_meta.get("abbreviations_title_block_id"),
    }
    
    boundary_id = metadata.get("sections", {}).get("prelim_ends_before_block_id")
    target_anchor = _get_paragraph_by_block_id(doc, blocks, boundary_id)
    
    if not target_anchor:
        print("[WARN] Cannot find the main content anchor. Skipping preliminary reordering.")
        return

    # Store pairs of (title_para, field_para) in the correct final sequence
    move_list: List[Tuple[Paragraph, Optional[Paragraph]]] = []

    # 1. Collect all paragraphs to move in the correct sequential order
    for item_key in required_order:
        
        para_to_move = None
        field_para_to_move = None
        
        # Search for GENERATED content (TOC, LOT, LOF, Abbr.)
        if item_key in ["tableOfContents", "listOfTables", "listOfFigures", "abbreviations"]:
            title_map = {
                "tableOfContents": "TABLE OF CONTENTS",
                "listOfTables": "LIST OF TABLES",
                "listOfFigures": "LIST OF FIGURES",
                "abbreviations": "ABBREVIATIONS"
            }
            title_text = title_map.get(item_key, "")
            
            result = _get_generated_prelim_pair(doc, title_text)
            if result:
                para_to_move, field_para_to_move = result
        
        # Search for pre-existing content (Abstract, Dedication, etc.)
        else:
            block_id = prelim_block_map.get(item_key)
            if block_id:
                para_to_move = _get_paragraph_by_block_id(doc, blocks, block_id)
        
        if para_to_move:
            move_list.append((para_to_move, field_para_to_move))


    # 2. Execute the move in REVERSE order
    # The current_anchor starts at the main content boundary.
    current_anchor = target_anchor

    for title_para, field_para in reversed(move_list):
        
        # FIX: Move the FIELD paragraph (the TOC/LOT/LOF content) first, right before the anchor
        if field_para:
            _move_paragraph_before(field_para, current_anchor)
            
        # Then move the TITLE paragraph, which becomes the new anchor
        _move_paragraph_before(title_para, current_anchor)
        current_anchor = title_para # This ensures the next item moves before the title we just moved
        print(f"[INFO] Moved preliminary content for: {title_para.text.strip()[:30]}...")

    print("[INFO] Preliminary pages reordering complete.")


def apply_sections(
    doc: Document,
    blocks: List[Dict[str, Any]],
    metadata: Dict[str, Any],
) -> None:
    """
    1. Reorder preliminary content (TOC, LOT, LOF, etc.) to the start.
    2. Create two logical zones in the document: prelim + main.
    3. Apply basic page-numbering rules.
    """
    
    # NEW STEP: Reorder preliminary pages before section splitting
    try:
        _reorder_preliminary_content(doc, blocks, metadata)
    except Exception as exc:
        print(f"[WARN] _reorder_preliminary_content failed: {exc}")


    sections_meta = metadata.get("sections", {})
    boundary_id: Optional[str] = sections_meta.get("prelim_ends_before_block_id")

    if not boundary_id:
        # No clear boundary detected → do nothing
        return

    # 1) Determine which P# is the last prelim paragraph
    last_prelim_p_block_id = _get_last_prelim_paragraph_id(blocks, boundary_id)
    if not last_prelim_p_block_id:
        # Could not resolve a valid prelim paragraph → skip
        return

    # 2) Map that P# to a paragraph index in the actual doc
    last_prelim_para_index = _get_paragraph_index_for_block(
        blocks,
        last_prelim_p_block_id,
        doc.paragraphs,
    )
    if last_prelim_para_index is None:
        return

    # 3) Insert section break AFTER that paragraph
    _insert_section_break_after_paragraph(doc, last_prelim_para_index)

    # 4) Apply page numbering + PAGE fields
    sections = list(doc.sections)
    if not sections:
        return

    # First section = prelim (roman)
    _apply_prelim_page_numbering(sections[0])

    # All later sections = main (arabic)
    first_main = True
    for sec in sections[1:]:
        _apply_main_page_numbering(sec, restart_at_1=first_main)
        first_main = False


# ----------------------------------------------------------------------
# Boundary + mapping helpers 
# ----------------------------------------------------------------------


def _get_last_prelim_paragraph_id(
    blocks: List[Dict[str, Any]],
    boundary_id: str,
) -> Optional[str]:
    """
    Given the block id where prelim ends BEFORE that block,
    determine the last prelim paragraph block id (P#).
    """
    last_p_before_boundary: Optional[str] = None

    for block in blocks:
        block_id = block.get("id")
        if block_id == boundary_id:
            break

        if block.get("type") == "paragraph":
            last_p_before_boundary = block_id

    return last_p_before_boundary


def _get_paragraph_index_for_block(
    blocks: List[Dict[str, Any]],
    target_block_id: str,
    doc_paragraphs: List[Paragraph],
) -> Optional[int]:
    """
    Walk through blocks and map paragraph-type blocks to
    indices in doc.paragraphs (same order as original DOCX).
    """
    para_index = -1

    for block in blocks:
        if block.get("type") != "paragraph":
            continue

        para_index += 1
        if block.get("id") == target_block_id:
            if 0 <= para_index < len(doc_paragraphs):
                return para_index
            return None

    return None


def _insert_section_break_after_paragraph(doc: Document, para_index: int) -> None:
    """
    Insert a section break AFTER the paragraph at para_index.
    """
    if not (0 <= para_index < len(doc.paragraphs)):
        return

    paragraph = doc.paragraphs[para_index]
    p = paragraph._p  # underlying <w:p> element

    # Ensure paragraph has a <w:pPr>
    pPr = p.get_or_add_pPr()

    # Create a new <w:sectPr> (section properties) child
    sectPr = OxmlElement("w:sectPr")

    # Explicitly set break type = nextPage
    type_el = OxmlElement("w:type")
    type_el.set(qn("w:val"), "nextPage")
    sectPr.append(type_el)

    pPr.append(sectPr)


# ----------------------------------------------------------------------
# Page numbering + footer helpers
# ----------------------------------------------------------------------


def _apply_prelim_page_numbering(section) -> None:
    """
    Roman numerals (i, ii, iii) in prelim section.
    """
    footer = section.footer

    try:
        footer.is_linked_to_previous = False
    except AttributeError:
        pass

    _set_page_number_format(section, fmt="lowerRoman")

    _ensure_page_field_in_footer(footer)


def _apply_main_page_numbering(section, restart_at_1: bool = False) -> None:
    """
    Arabic numbering in main sections.
    """
    footer = section.footer

    try:
        footer.is_linked_to_previous = False
    except AttributeError:
        pass

    start_val: Optional[int] = 1 if restart_at_1 else None
    _set_page_number_format(section, fmt="decimal", start=start_val)

    _ensure_page_field_in_footer(footer)


def _set_page_number_format(section, fmt: str, start: Optional[int] = None) -> None:
    """
    Centralized way to set <w:pgNumType> for a section.
    """
    sectPr = section._sectPr
    pgNumType = sectPr.find(qn("w:pgNumType"))
    if pgNumType is None:
        pgNumType = OxmlElement("w:pgNumType")
        sectPr.append(pgNumType)

    pgNumType.set(qn("w:fmt"), fmt)

    if start is not None:
        pgNumType.set(qn("w:start"), str(start))
    else:
        if pgNumType.get(qn("w:start")) is not None:
            del pgNumType.attrib[qn("w:start")]


def _ensure_page_field_in_footer(footer) -> None:
    """
    Insert a { PAGE } field in the footer, right-aligned,
    if not already present.
    """
    if footer.paragraphs:
        para = footer.paragraphs[-1]
        if "PAGE" in para.text.upper():
            return
    else:
        para = footer.add_paragraph()

    para.clear()
    para.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    # Build complex field: { PAGE }
    begin_run = para.add_run()
    fld_char_begin = OxmlElement("w:fldChar")
    fld_char_begin.set(qn("w:fldCharType"), "begin")
    begin_run._r.append(fld_char_begin)

    instr_run = para.add_run()
    instr_text = OxmlElement("w:instrText")
    instr_text.text = " PAGE "
    instr_run._r.append(instr_text)

    end_run = para.add_run()
    fld_char_end = OxmlElement("w:fldChar")
    fld_char_end.set(qn("w:fldCharType"), "end")
    end_run._r.append(fld_char_end)