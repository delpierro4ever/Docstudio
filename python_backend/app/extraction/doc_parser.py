from docx import Document
from typing import List, Dict, Any

def get_heading_score(style_name: str, text: str) -> float:
    style = style_name.lower()
    text = text.upper()
    score = 0.0
    if "heading" in style:
        score += 0.8
        if "1" in style: score += 0.2
    
    # Keyword boosts
    if "CHAPTER" in text or "INTRODUCTION" in text:
        score += 0.3
    if "ABSTRACT" in text or "TABLE OF CONTENTS" in text:
        score += 0.5
        
    return min(score, 1.0)

def extract_paragraph_stream(doc: Document) -> List[Dict[str, Any]]:
    """
    Extract paragraph metadata for LLM analysis.
    CRITICAL: We must include ALL paragraphs (even empty ones) to preserve indices!
    The LLM will return indices that must match the actual document paragraph indices.
    """
    stream = []
    for i, p in enumerate(doc.paragraphs):
        text = p.text.strip()
        
        # Even if empty, we MUST include it to preserve indices
        # Mark it so LLM knows to ignore it for section detection
        is_empty = len(text) == 0
        
        # Basic check for bold (if all runs are bold)
        is_bold = False
        if p.runs and not is_empty:
            # naive check: if > 50% of text is bold
            bold_chars = sum(len(r.text) for r in p.runs if r.bold)
            total_chars = len(text)
            if total_chars > 0 and (bold_chars / total_chars) > 0.5:
                is_bold = True
        
        has_page_break = False
        # Check rendered page breaks in runs
        for r in p.runs:
            if 'lastRenderedPageBreak' in r._element.xml:
                has_page_break = True
            if 'w:br' in r._element.xml and 'type="page"' in r._element.xml:
                 has_page_break = True
                 
        meta = {
            "idx": i,  # CRITICAL: This must match the actual paragraph index in doc.paragraphs
            "text": text[:200] if not is_empty else "",  # Truncate likely body text for LLM efficiency
            "is_empty": is_empty,  # Flag for LLM to ignore
            "style_name": p.style.name,
            "is_bold": is_bold,
            "is_upper": text.isupper() if not is_empty else False,
            "approx_heading_score": get_heading_score(p.style.name, text) if not is_empty else 0.0,
            "has_page_break": has_page_break,
            "contains_chapter_keyword": "CHAPTER" in text.upper() if not is_empty else False,
            "contains_toc_keyword": "TABLE OF CONTENTS" in text.upper() if not is_empty else False,
            "word_count": len(text.split()) if not is_empty else 0
        }
        stream.append(meta)
    return stream
