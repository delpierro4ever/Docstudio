from __future__ import annotations

from io import BytesIO
from typing import Any, Dict, List, Optional
from docx.text.paragraph import Paragraph 
from docx.enum.section import WD_SECTION

from docx import Document

from config.profiles import load_profile
from .heading_builder import apply_headings
from .section_builder import apply_sections
from .toc_builder import insert_table_of_contents
from .table_figure_builder import insert_list_of_entries
from .basic_style import apply_basic_style
from .references_builder import format_references_section


# --- HELPER FUNCTION (For finding anchor) ---
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

def _get_paragraph_by_block_id(doc: Document, blocks: List[Dict[str, Any]], block_id: str) -> Optional[Paragraph]:
    """Helper to get a Paragraph object by its block ID."""
    para_index = _get_paragraph_index_for_block(blocks, block_id, doc.paragraphs)
    if para_index is not None:
        return doc.paragraphs[para_index]
    return None
# -----------------------------------------------------------------


def format_docx(
    input_path: str,
    blocks: List[Dict[str, Any]],
    metadata: Dict[str, Any],
    profile_id: Optional[str] = None,
) -> bytes:
    """
    Main entry point for building the final formatted DOCX.
    """

    profile = load_profile(profile_id)
    doc = Document(input_path)
    
    # 1. Apply styles and headings (must happen first)
    try:
        apply_basic_style(doc, profile, metadata)
    except Exception as exc:
        print(f"[WARN] apply_basic_style failed: {exc}")
        
    try:
        apply_headings(doc, blocks, metadata, profile)
    except Exception as exc:
        print(f"[WARN] apply_headings failed: {exc}")


    # 2. Find the Main Content Anchor (Paragraph just before Chapter 1)
    
    # The anchor is the paragraph immediately preceding the main content (Chapter 1)
    boundary_id = metadata.get("sections", {}).get("prelim_ends_before_block_id")
    main_content_anchor = _get_paragraph_by_block_id(doc, blocks, boundary_id)
    
    if main_content_anchor is None:
        # Fallback to the first paragraph
        main_content_anchor = doc.paragraphs[0] if doc.paragraphs else doc.add_paragraph()


    # 3. Orchestrate Sequential Insertion (TOC -> LOT -> LOF)
    
    # We must insert in reverse order: LOF -> LOT -> TOC
    current_anchor = main_content_anchor
    
    # List of items to GENERATE and place (in their final required order: TOC -> LOT -> LOF)
    # NOTE: The order here must match your final requirement. Example: TOC -> LOT -> LOF
    generated_prelim_items = ["tableOfContents", "listOfTables", "listOfFigures"]
    
    # We iterate in reverse: i=0 is LOF, i=1 is LOT, i=2 is TOC
    # This loop inserts the generated content *before* the main content anchor.
    for i, item_key in enumerate(reversed(generated_prelim_items)):
        try:
            inserted_title_para = None
            
            # The item that separates prelim from main (LOF) is the first item we insert (i=0).
            is_last_prelim_page_in_flow = (i == 0)

            if item_key == "listOfFigures":
                inserted_title_para = insert_list_of_entries(
                    doc, 
                    metadata, 
                    title="LIST OF FIGURES", 
                    caption_label="Figure", 
                    anchor_para=current_anchor,
                    is_last_prelim_page=is_last_prelim_page_in_flow
                )
                    
            elif item_key == "listOfTables":
                inserted_title_para = insert_list_of_entries(
                    doc, 
                    metadata, 
                    title="LIST OF TABLES", 
                    caption_label="Table", 
                    anchor_para=current_anchor,
                    is_last_prelim_page=is_last_prelim_page_in_flow
                )
            
            elif item_key == "tableOfContents":
                inserted_title_para = insert_table_of_contents(
                    doc, 
                    metadata, 
                    anchor_para=current_anchor,
                    is_last_prelim_page=is_last_prelim_page_in_flow
                )
            
            # If we inserted something, the newly inserted title paragraph becomes the new anchor
            if inserted_title_para:
                current_anchor = inserted_title_para

        except Exception as exc:
            print(f"[WARN] Failed to insert/position {item_key}: {exc}")

    # 4. References and Sections
    try:
        format_references_section(doc, blocks, metadata, profile)
    except Exception as exc:
        print(f"[WARN] format_references_section raised unexpectedly: {exc}")
    
    # 5. Apply Sections (Must run last to apply Roman/Arabic page numbering)
    try:
        apply_sections(doc, blocks, metadata)
    except Exception as exc:
        print(f"[WARN] apply_sections failed: {exc}")

    # 6. Save to bytes
    bio = BytesIO()
    doc.save(bio)
    return bio.getvalue()