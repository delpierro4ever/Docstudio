from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE

def normalize_styles(doc: Document):
    # Ensure Heading styles exist
    for i in range(1, 4):
        style_name = f'Heading {i}'
        if style_name not in doc.styles:
            style = doc.styles.add_style(style_name, WD_STYLE_TYPE.PARAGRAPH)
            style.base_style = doc.styles['Normal']
    
    # Update Normal style
    if 'Normal' in doc.styles:
        style = doc.styles['Normal']
        font = style.font
        font.name = 'Times New Roman'
        font.size = Pt(12)
        
        # Update Paragraph formatting for Normal style
        p_format = style.paragraph_format
        p_format.alignment = WD_PARAGRAPH_ALIGNMENT.JUSTIFY
        # Line spacing 1.5 = 1.5 lines?
        # REMOVED: p_format.line_spacing = 1.5 # Reset to single/default as per sample
        p_format.line_spacing = None # Default

    
    # Ensure Caption style exists
    if 'Caption' not in doc.styles:
        style = doc.styles.add_style('Caption', WD_STYLE_TYPE.PARAGRAPH)
        style.base_style = doc.styles['Normal']
        font = style.font
        font.name = 'Times New Roman'
        font.size = Pt(10) # Often smaller or italic
        font.italic = True
        
    # Force Word to update TOC/Fields on open
    doc.settings.update_fields_on_open = True

    # Also ensure Headings are reasonable
    for i in range(1, 4):
        style_name = f'Heading {i}'
        if style_name in doc.styles:
            h_style = doc.styles[style_name]
            h_font = h_style.font
            h_font.name = 'Times New Roman'
            h_font.bold = True
            h_font.color.rgb = None # Auto color
            
            from docx.oxml import OxmlElement
            from docx.oxml.ns import qn

            # Access the style's XML element directly to set outline level
            # The outline level MUST be in <w:style><w:pPr><w:outlineLvl w:val="X"/>
            # Heading 1 -> val=0, Heading 2 -> val=1, Heading 3 -> val=2
            style_elem = h_style.element  # <w:style>
            pPr = style_elem.find(qn('w:pPr'))
            if pPr is None:
                pPr = OxmlElement('w:pPr')
                style_elem.append(pPr)
            
            # Set outline level
            lvl = pPr.find(qn('w:outlineLvl'))
            if lvl is None:
                lvl = OxmlElement('w:outlineLvl')
                pPr.append(lvl)
            lvl.set(qn('w:val'), str(i - 1))

            p_format = h_style.paragraph_format
            if i == 1:
                p_format.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
                h_font.size = Pt(16)
            else:
                p_format.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT
                h_font.size = Pt(12)
            
    return doc

def apply_style(paragraph, style_name: str):
    """
    Safely applies a style to a paragraph. Does nothing if style doesn't exist.
    """
    try:
        paragraph.style = style_name
    except:
        pass # Fallback to existing style if 'Heading X' missing logic fails

def get_paragraph_text(p) -> str:
    """Helper to get clean text"""
    return p.text.strip()
