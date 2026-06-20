from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def create_field_element(instr_text):
    """
    Create a complex field element (fldChar begin, instrText, fldChar separate, fldChar end).
    """
    # 1. fldChar begin
    fldChar_begin = OxmlElement('w:fldChar')
    fldChar_begin.set(qn('w:fldCharType'), 'begin')

    # 2. instrText
    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = instr_text

    # 3. fldChar separate
    fldChar_sep = OxmlElement('w:fldChar')
    fldChar_sep.set(qn('w:fldCharType'), 'separate')

    # 4. fldChar end
    fldChar_end = OxmlElement('w:fldChar')
    fldChar_end.set(qn('w:fldCharType'), 'end')

    return fldChar_begin, instrText, fldChar_sep, fldChar_end

def insert_toc_field(paragraph, instruction=' TOC \\o "1-3" \\h \\z \\u '):
    """
    Inserts a TOC field into the given paragraph.
    Usage: paragraph = doc.add_paragraph()
           insert_toc_field(paragraph)
    """
    run = paragraph.add_run()
    fldChar_begin, instrText, fldChar_sep, fldChar_end = create_field_element(instruction)
    
    # Append to the run's element
    r_element = run._r
    r_element.append(fldChar_begin)
    r_element.append(instrText)
    r_element.append(fldChar_sep)
    r_element.append(fldChar_end)

def insert_page_number_field(run):
    """
    Inserts a { PAGE } field into a run.
    """
    fldChar_begin, instrText, fldChar_sep, fldChar_end = create_field_element(' PAGE ')
    r_element = run._r
    r_element.append(fldChar_begin)
    r_element.append(instrText)
    r_element.append(fldChar_sep)
    r_element.append(fldChar_end)
