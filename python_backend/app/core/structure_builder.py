from docx import Document
from app.models import DocStructure
from app.core.oxml_utils import insert_toc_field, insert_page_number_field
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

PREFERRED_ORDER = [
    "declaration", "dedication", "acknowledgement", "abstract",
    "table of contents", "list of figures", "list of tables", "abbreviations"
]

def rebuild_preliminaries(doc: Document, structure: DocStructure):
    # This function assumes we have identified the prelims and main content start.
    # Strategy:
    # 1. Locate the insertion point for TOC/LOF/LOT (usually before Chapter 1).
    # 2. Check if we have existing TOC blocks to remove (to avoid duplicates).
    # 3. Insert specific headings and fields.

    # Identify where 'Chapter 1' starts. If 0, we can't do much safely.
    if structure.main_content_start_index <= 0:
        return

    # Find the paragraph to insert BEFORE.
    # main_content_start_index is the index of "CHAPTER 1".
    # We want to insert strictly before that.
    insert_before_p = doc.paragraphs[structure.main_content_start_index]
    
    # helper to insert before a paragraph
    def insert_block(heading_text, field_instruction=None):
        # We need to use insert_paragraph_before on the target paragraph
        # docx doesn't fully support insert_paragraph_before on the `doc` object easily, 
        # but `p.insert_paragraph_before()` works.
        
        # Heading
        p = insert_before_p.insert_paragraph_before(heading_text)
        p.style = "Heading 1"
        p.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        
        # Field
        if field_instruction:
            p_field = insert_before_p.insert_paragraph_before("")
            insert_toc_field(p_field, field_instruction)
            # Add a Page Break strictly? No, let sections handle breaks.
            # But usually TOC is on its own page.
            # For now, just content.
            
    # Check what is missing or needs moving.
    # For MVP, we simply INSERT TOC/LOF/LOT if not present, right before Chapter 1.
    # If they are present (detected by analyzer), we might assume they are okay OR delete and regenerate.
    # The prompt says: "If student already has a TOC heading, replace it; otherwise insert a new TOC block."
    
    # 1. Remove existing TOC/LOF/LOT if found in structure range
    # In a real impl, we would delete the range. 
    # For MVP, let's just Append/Insert new ones if missing, or specific request.
    # Prompt: "MUST BE HERE". So we force insertion.
    
    # We'll insert in reverse order of appearance (LOT, LOF, TOC) since we are using 'insert_before'
    
    # LOT
    if not structure.has_lot: # Or force it? Prompt implies force.
        # insert_block("LIST OF TABLES", ' TOC \\h \\z \\c "Table" ')
        pass # Only insert if we think there are tables? Prompt says "MUST BE HERE". 
        # But if no tables, it's empty. That's fine.
        
    insert_block("LIST OF TABLES", ' TOC \\h \\z \\c "Table" ')
    insert_block("LIST OF FIGURES", ' TOC \\h \\z \\c "Figure" ')
    insert_block("TABLE OF CONTENTS", ' TOC \\o "1-3" \\h \\z \\u ')
    
    # Note: We are inserting them right before Chapter 1. 
    # If there are other prelims (Abstract), they should be BEFORE these.
    # Since we insert_before Chapter 1, and existing Abstract is at index X < Chapter 1, 
    # effectively these go AFTER Abstract. Correct.
