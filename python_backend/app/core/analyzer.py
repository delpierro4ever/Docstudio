from docx import Document
from docx.document import Document as _Document
from typing import List, Optional
from app.models import DocStructure, SectionRange
import re

PRELIM_HEADERS = {
    "DECLARATION", "DEDICATION", "APPROVAL", "CERTIFICATION",
    "ACKNOWLEDGEMENT", "ACKNOWLEDGMENT", "ACKNOWLEDGEMENTS",
    "ABSTRACT", "TABLE OF CONTENTS", "LIST OF FIGURES", "LIST OF TABLES",
    "LIST OF ABBREVIATIONS", "ABBREVIATIONS"
}

# Regex for finding Chapter 1
# Matches: "CHAPTER 1", "CHAPTER ONE", "1. INTRODUCTION", "INTRODUCTION" (if Heading 1)
CHAPTER_START_REGEX = re.compile(r"^(CHAPTER\s+(ONE|1)|INTRODUCTION)", re.IGNORECASE)

def normalize_text(text: str) -> str:
    return text.strip().upper()

def get_heading_level(paragraph) -> Optional[int]:
    """Returns 1 for Heading 1, 2 for Heading 2, etc. None if not a heading."""
    style_name = paragraph.style.name
    if style_name.startswith("Heading"):
        try:
            return int(style_name.replace("Heading", "").strip())
        except ValueError:
            return None
    return None

def analyze_document(doc: _Document) -> DocStructure:
    structure = DocStructure()
    
    paragraphs = doc.paragraphs
    total_paras = len(paragraphs)
    
    current_prelim = None
    prelim_start_index = -1
    
    # Heuristic: We need to find the boundary between Prelims and Main Content.
    # We also want to map specific prelims if they exist.
    
    for i, p in enumerate(paragraphs):
        text = normalize_text(p.text)
        if not text:
            continue
            
        level = get_heading_level(p)
        is_heading = level is not None
        
        # Check for Main Content Start (Chapter 1)
        if (is_heading and level == 1) or (not is_heading and p.runs and p.runs[0].bold and len(p.text) < 50):
            # Strict check for Chapter 1 to avoid false positives in prelims
            if CHAPTER_START_REGEX.match(text):
                structure.main_content_start_index = i
                # Close any open prelim
                if current_prelim and prelim_start_index != -1:
                    structure.prelim_content[current_prelim] = SectionRange(prelim_start_index, i - 1)
                break
        
        # Check for Prelim Headings
        # We assume prelim headings are either actual styles or bold lines
        is_potential_heading = is_heading or (p.runs and p.runs[0].bold)
        
        if is_potential_heading and text in PRELIM_HEADERS:
            # Close previous prelim
            if current_prelim and prelim_start_index != -1:
                structure.prelim_content[current_prelim] = SectionRange(prelim_start_index, i - 1)
            
            # Start new prelim
            current_prelim = text.lower()
            prelim_start_index = i
            
            # Flag detection
            if "CONTENTS" in text: structure.has_toc = True
            if "FIGURES" in text: structure.has_lof = True
            if "TABLES" in text: structure.has_lot = True

    # If we didn't find specific main content start, maybe end of file?
    # Or if we looped to the end.
    if structure.main_content_start_index == 0:
        # Fallback: if we found abstract, maybe chapter 1 is after abstract?
        # This is risky. Let's leave as 0 and assume whole doc is body if detection fails, 
        # BUT for the MVP we need to be careful.
        pass

    # Identify Cover/Title pages
    # Everything before the first detected prelim is Cover/Title.
    first_prelim_start = min([r.start_index for r in structure.prelim_content.values()], default=structure.main_content_start_index)
    
    if first_prelim_start > 0:
        # We split this range into Cover and Title if possible.
        # Simple heuristic: Split in half? No. 
        # Just assign first half to Cover, valid for now.
        # Better: Look for a page break? (Rendered page break is hard to detect in python-docx xml without parsing exact breaks)
        # We will check for `p.runs[].break` or `w:br` type page.
        
        # For MVP, let's treat the entire block pre-prelims as "Cover Section".
        structure.cover_page_range = SectionRange(0, first_prelim_start - 1)
        
    return structure
