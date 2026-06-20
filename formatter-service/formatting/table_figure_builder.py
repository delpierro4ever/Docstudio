from typing import Dict, Any, List, Optional
from docx import Document # <-- FIX: Added missing import for Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.text.paragraph import Paragraph 
from docx.enum.section import WD_SECTION 


# --- HELPER FUNCTIONS FOR LIST INSERTION ---

def _add_list_field(paragraph: Paragraph, caption_label: str) -> None:
    """
    Inserts a functional List field (LOT/LOF) that Word can update.
    """
    # Clear paragraph completely and set alignment
    paragraph.clear()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT

    # 1) Begin field: <w:fldChar w:fldCharType="begin" w:dirty="true"/>
    run = paragraph.add_run()
    fld_char_begin = OxmlElement("w:fldChar")
    fld_char_begin.set(qn("w:fldCharType"), "begin")
    fld_char_begin.set(qn("w:dirty"), "true") # Signal for auto-refresh
    run._r.append(fld_char_begin)

    # 2) Instruction text: <w:instrText xml:space="preserve"> TOC \h \z \c "CaptionLabel" </w:instrText>
    run = paragraph.add_run()
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    # \c is the switch for "use TOC entries identified by the Sequence field (caption) name"
    instr_text.text = f' TOC \\h \\z \\c "{caption_label}" '
    run._r.append(instr_text)

    # 3) Separate
    run = paragraph.add_run()
    fld_char_sep = OxmlElement("w:fldChar")
    fld_char_sep.set(qn("w:fldCharType"), "separate")
    run._r.append(fld_char_sep)

    # 4) Placeholder result run
    placeholder_run = paragraph.add_run()
    placeholder_run.text = f"Updating list of {caption_label.lower()}..."
    placeholder_run.italic = True

    # 5) End
    run = paragraph.add_run()
    fld_char_end = OxmlElement("w:fldChar")
    fld_char_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char_end)


def insert_list_of_entries(
    doc: Document, 
    metadata: Dict[str, Any], 
    title: str, 
    caption_label: str, 
    anchor_para: Optional[Paragraph] = None,
    is_last_prelim_page: bool = False
) -> Optional[Paragraph]:
    """
    Inserts a List of Tables/Figures title and field BEFORE the anchor_para.
    A page break is inserted immediately before the title (or a section break if it's the last prelim item).
    
    Returns the inserted title paragraph (which acts as the new anchor).
    """
    title_style_name = metadata.get("toc", {}).get("titleStyleName", "Heading 1")
    
    # --- 1. NEW PAGE/SECTION BREAK ---
    break_anchor = anchor_para
    is_first_paragraph_in_doc = (break_anchor is not None and break_anchor == doc.paragraphs[0])

    if break_anchor is not None and not is_first_paragraph_in_doc:
        break_para = break_anchor.insert_paragraph_before()
        
        if is_last_prelim_page:
            # Insert a paragraph with a NEXT_PAGE section break (separates Prelim from Main)
            break_para.add_run().add_break(WD_SECTION.NEXT_PAGE)
        else:
            # Insert a simple page break to separate prelim pages (TOC, LOT, LOF)
            break_para.add_run().add_break(WD_BREAK.PAGE)
    
    
    # --- 2. INSERT LIST FIELD (just before the title) ---
    if anchor_para is not None:
        list_para = anchor_para.insert_paragraph_before()
    else:
        list_para = doc.add_paragraph()
        
    _add_list_field(list_para, caption_label)

    # --- 3. INSERT TITLE (just before the field) ---
    title_para = list_para.insert_paragraph_before(title)
    
    # Apply style and alignment
    try:
        title_para.style = title_style_name
    except Exception:
        pass
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    print(f"[INFO] Inserted placeholder for {title}")
    
    return title_para


# --- MAIN ENTRY POINT (Updated to match the call in formatter.py) ---

def _get_paragraph_by_block_id(doc: Document, blocks: List[Dict[str, Any]], block_id: str) -> Optional[Paragraph]:
    """
    Helper to get a Paragraph object by its block ID.
    """
    # Simple placeholder logic
    try:
        para_index = block_id.split('P')[-1] 
        return doc.paragraphs[int(para_index)]
    except:
        return None

def _reformat_caption_paragraph(
    paragraph: Paragraph,
    role: str,
    number: str,
    caption: str,
    profile: Dict[str, Any],
) -> None:
    """
    Rewrites the caption paragraph text and applies the required style.
    """
    
    # 1. Construct the new, normalized caption text
    normalized_text = f"{number}: {caption}"
    
    # 2. Apply the text to the paragraph
    paragraph.clear()
    run = paragraph.add_run(normalized_text)

    # 3. Apply basic caption styling (should come from a dedicated 'caption' profile config)
    caption_cfg = profile.get("captions", {})
    if role == "table":
        style_name = caption_cfg.get("tableStyleName", "Caption")
        alignment = WD_ALIGN_PARAGRAPH.CENTER
        bold = caption_cfg.get("tableBold", True)
        
    elif role == "figure":
        style_name = caption_cfg.get("figureStyleName", "Caption")
        alignment = WD_ALIGN_PARAGRAPH.CENTER
        bold = caption_cfg.get("figureBold", False)
        
    else:
        style_name = "Caption"
        alignment = WD_ALIGN_PARAGRAPH.LEFT
        bold = False


    # Apply style and formatting
    try:
        paragraph.style = style_name
    except KeyError:
        pass 

    paragraph.alignment = alignment
    run.bold = bold


def apply_tables_and_figures(
    doc: Document,
    blocks: List[Dict[str, Any]],
    metadata: Dict[str, Any],
    profile: Dict[str, Any], 
) -> None:
    """
    Normalize table and figure numbering & captions using LLM metadata,
    AND reformat the actual caption paragraphs in the DOCX.
    """
    if "blocks" not in metadata:
        return

    block_meta: Dict[str, Any] = metadata["blocks"]
    table_counters: Dict[int, int] = {}
    figure_counters: Dict[int, int] = {}

    for block_id, info in block_meta.items():
        role = info.get("role")
        if role not in ("table", "figure"):
            continue

        chapter = info.get("chapter")
        if chapter is None:
            chapter = 1
            info["chapter"] = chapter

        if role == "table" and chapter not in table_counters:
            table_counters[chapter] = 0
        if role == "figure" and chapter not in figure_counters:
            figure_counters[chapter] = 0

    for block_id, info in block_meta.items():
        role = info.get("role")
        if role == "table":
            _ensure_table_metadata(block_id, info, table_counters)
        elif role == "figure":
            _ensure_figure_metadata(block_id, info, figure_counters)
            
    for block_id, info in block_meta.items():
        role = info.get("role")
        
        caption_block_id = info.get("caption_block_id")
        
        if role in ("table", "figure") and caption_block_id:
            caption_para = _get_paragraph_by_block_id(doc, blocks, caption_block_id)
            
            if caption_para:
                number_key = "tableNumber" if role == "table" else "figureNumber"
                number = info.get(number_key, "N/A")
                caption = info.get("caption", "Missing Caption")
                
                _reformat_caption_paragraph(
                    caption_para, 
                    role, 
                    number, 
                    caption, 
                    profile
                )
    
def _ensure_table_metadata(
    block_id: str,
    info: Dict[str, Any],
    table_counters: Dict[int, int],
) -> None:
    
    chapter = info.get("chapter", 1)
    table_counters[chapter] = table_counters.get(chapter, 0) + 1
    index_in_chapter = table_counters[chapter]

    if not info.get("tableNumber"):
        info["tableNumber"] = f"Table {chapter}.{index_in_chapter}"

    if "caption" not in info or not info["caption"]:
        raw_caption = info.get("rawCaption") or info.get("title") or ""
        if raw_caption:
            info["caption"] = raw_caption
        else:
            info["caption"] = f"{info['tableNumber']} caption"


def _ensure_figure_metadata(
    block_id: str,
    info: Dict[str, Any],
    figure_counters: Dict[int, int],
) -> None:
    
    chapter = info.get("chapter", 1)
    figure_counters[chapter] = figure_counters.get(chapter, 0) + 1
    index_in_chapter = figure_counters[chapter]

    if not info.get("figureNumber"):
        info["figureNumber"] = f"Figure {chapter}.{index_in_chapter}"

    if "caption" not in info or not info["caption"]:
        raw_caption = info.get("rawCaption") or info.get("title") or ""
        if raw_caption:
            info["caption"] = raw_caption
        else:
            info["caption"] = f"{info['figureNumber']} caption"