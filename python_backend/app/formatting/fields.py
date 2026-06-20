from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def create_field_element(instr_text):
    fldChar_begin = OxmlElement('w:fldChar')
    fldChar_begin.set(qn('w:fldCharType'), 'begin')

    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = instr_text

    fldChar_sep = OxmlElement('w:fldChar')
    fldChar_sep.set(qn('w:fldCharType'), 'separate')

    fldChar_end = OxmlElement('w:fldChar')
    fldChar_end.set(qn('w:fldCharType'), 'end')

    return fldChar_begin, instrText, fldChar_sep, fldChar_end

def append_toc_field(run, instruction=' TOC \\o "1-3" \\h \\z \\u '):
    fldChar_begin, instrText, fldChar_sep, fldChar_end = create_field_element(instruction)
    r_element = run._r
    r_element.append(fldChar_begin)
    r_element.append(instrText)
    r_element.append(fldChar_sep)
    r_element.append(fldChar_end)

def append_page_field(run):
    """Appends a PAGE number field to the run."""
    fldChar_begin, instrText, fldChar_sep, fldChar_end = create_field_element(' PAGE ')
    r_element = run._r
    r_element.append(fldChar_begin)
    r_element.append(instrText)
    r_element.append(fldChar_sep)
    r_element.append(fldChar_end)

def set_section_page_numbering(section, fmt='decimal', start=None):
    sectPr = section._sectPr
    pgNumType = sectPr.find(qn('w:pgNumType'))
    if pgNumType is None:
        pgNumType = OxmlElement('w:pgNumType')
        sectPr.append(pgNumType)
    
    if fmt == 'roman':
        pgNumType.set(qn('w:fmt'), 'lowerRoman')
    else:
        pgNumType.set(qn('w:fmt'), 'decimal')
        
    if start is not None:
        pgNumType.set(qn('w:start'), str(start))
