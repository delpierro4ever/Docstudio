from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.enum.section import WD_SECTION

def create_section_break(doc, index_before):
    # This is tricky in python-docx. 
    # Easiest way: modify the paragraph properties of the paragraph right before main content 
    # to include a section break "Next Page".
    
    # However, 'sections' in docx correspond to section properties. 
    # doc.sections[-1] is the last section.
    # To start a new section at a specific point, we usually add a "Section Break" character or property.
    
    # Strategy:
    # 1. Access the paragraph strictly before "Chapter 1".
    # 2. Add a Rendered Section Break?
    # No, python-docx handles sections by `doc.add_section()`. 
    # But `doc.add_section()` appends to the END.
    # We need to split the document.
    
    # If we already have sections, we need to manage them.
    # MVP approach: 
    # We generally assume the document is currently One Section (or messy).
    # We want to insert a section break exactly at `main_content_start_index`.
    
    # Workaround:
    # Iterate paragraphs. When we hit `main_content_start_index`, we insert a section break XML element
    # into the PREVIOUS paragraph (or the start of this one).
    pass

def set_footer_page_numbers(section, footer_type='roman', start_at=None):
    # Get the footer
    footer = section.footer
    # Ensure page number field is there?
    # Usually we leave the content of footer alone but set the PROPERTY of the numbering.
    
    sectPr = section._sectPr
    # Find or create pgNumType
    pgNumType = sectPr.find(qn('w:pgNumType'))
    if pgNumType is None:
        pgNumType = OxmlElement('w:pgNumType')
        sectPr.append(pgNumType)
    
    # Set format
    if footer_type == 'roman':
        pgNumType.set(qn('w:fmt'), 'lowerRoman')
    else:
        pgNumType.set(qn('w:fmt'), 'decimal')
        
    if start_at is not None:
        pgNumType.set(qn('w:start'), str(start_at))

def apply_section_breaks_and_numbering(doc: Document, main_content_index: int):
    # 1. Identify paragraph to split at (Chapter 1)
    if main_content_index <= 0:
        return
        
    p_chap1 = doc.paragraphs[main_content_index]
    
    # Insert a section break BEFORE this paragraph.
    # In python-docx, `p.insert_paragraph_before()` adds a paragraph.
    # We can add a section break here.
    # Actually, simpler: `doc.add_section(WD_SECTION.NEW_PAGE)` adds at the end.
    # To insert inside, we must manipulate OXML.
    
    # XML Logic:
    # <w:p> ... </w:p>
    # <w:sectPr> ... </w:sectPr>  <-- This defines the END of the previous section
    # <w:p> (Chapter 1) </w:p>
    
    # So we need to insert a `<w:sectPr>` (Section Properties) into the paragraph BEFORE Chapter 1.
    # Wait, `w:sectPr` usually lives in body as a direct child for section breaks? 
    # OR inside a paragraph's pPr/sectPr for specific breaks?
    # Correct: A section break is defined by `w:p/w:pPr/w:sectPr`.
    
    # Let's get paragraph before Chapter 1
    p_prev = doc.paragraphs[main_content_index - 1]
    
    # Add section break to p_prev
    p_prev_element = p_prev._p
    pPr = p_prev_element.get_or_add_pPr()
    sectPr = OxmlElement('w:sectPr')
    
    # Define the type of break (Next Page)
    type_element = OxmlElement('w:type')
    type_element.set(qn('w:val'), 'nextPage')
    sectPr.append(type_element)
    
    pPr.append(sectPr)
    
    # Now we have structurally split the document into Section A (Prelims) and Section B (Body).
    # python-docx should now see an additional section in `doc.sections` after we save/reload? 
    # It might not update `doc.sections` live without reload. 
    # But we can try to assume it's there or just update XML.
    
    # Actually, modifying XML directly is effective but `doc.sections` wrapper might desync.
    # Ideally we operate on the sections detected.
    # Since we just added a break, the document *should* have 2 specific sections distinct behavior.
    # BUT, we need to set properties (Roman vs Arabic).
    # The `sectPr` we just inserted defines the properties of the PRECEDING section (Prelims).
    # wait. No.
    # `w:sectPr` at the end of body = Final Section.
    # `w:sectPr` inside a paragraph = Properties of the section ENDING at that paragraph.
    # So the `sectPr` we added to `p_prev` defines the properties of the PRELIM section.
    
    # So, we configure `sectPr` (Prelim) to be Roman.
    pgNumType = OxmlElement('w:pgNumType')
    pgNumType.set(qn('w:fmt'), 'lowerRoman')
    sectPr.append(pgNumType)
    
    # The properties of the NEXT section (Body) are defined by the FINAL `w:sectPr` of the document (or next break).
    # We need to find the final `sectPr` (or the one governing Chapter 1) and set it to Arabic, start at 1.
    
    # Since we only added one break, the rest of the doc is the Second section.
    # Its properties are at `doc._body._element.sectPr` (the last one).
    
    last_sectPr = doc._body._element.sectPr
    if last_sectPr is not None:
        # Set Arabic starting at 1
        pg = last_sectPr.find(qn('w:pgNumType'))
        if pg is None:
            pg = OxmlElement('w:pgNumType')
            last_sectPr.append(pg)
        
        pg.set(qn('w:fmt'), 'decimal')
        pg.set(qn('w:start'), '1')
        
    # Done.
