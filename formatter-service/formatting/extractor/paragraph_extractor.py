# formatter-service/formatting/extractor/paragraph_extractor.py

import re
from typing import Dict, List, Any
from docx import Document

class ParagraphExtractor:
    """Handles paragraph extraction and analysis."""
    
    def extract(self, doc: Document) -> List[Dict[str, Any]]:
        """Extract all paragraphs with styling hints."""
        paragraphs = []
        for idx, paragraph in enumerate(doc.paragraphs):
            if not paragraph.text.strip():
                continue
                
            para_data = self._analyze_paragraph(paragraph, idx)
            paragraphs.append(para_data)
        
        return paragraphs
    
    def _analyze_paragraph(self, paragraph, index: int) -> Dict[str, Any]:
        """Analyze a single paragraph for styling and formatting."""
        para_data = {
            "index": index,
            "text": paragraph.text.strip(),
            "bold": False,
            "italic": False,
            "underline": False,
            "centered": False,
            "justified": False,
            "font_size": None,
            "is_heading_candidate": False
        }
        
        self._analyze_formatting(paragraph, para_data)
        self._detect_heading_candidate(paragraph, para_data)
        
        return para_data
    
    def _analyze_formatting(self, paragraph, para_data: Dict[str, Any]) -> None:
        """Analyze run-level formatting in paragraph."""
        if not paragraph.runs:
            return
            
        # Check alignment
        if paragraph.paragraph_format.alignment:
            alignment = paragraph.paragraph_format.alignment
            if alignment == 1:  # CENTER
                para_data["centered"] = True
            elif alignment == 3:  # JUSTIFY
                para_data["justified"] = True
        
        # Check runs for bold/italic/underline and font size
        bold_count = 0
        italic_count = 0
        underline_count = 0
        total_runs = len(paragraph.runs)
        
        for run in paragraph.runs:
            if run.bold:
                bold_count += 1
            if run.italic:
                italic_count += 1
            if run.underline:
                underline_count += 1
                
            # Get font size from first run that has it
            if run.font.size and para_data["font_size"] is None:
                para_data["font_size"] = run.font.size.pt if run.font.size else None
        
        # If majority of runs have formatting, mark the paragraph
        if bold_count > total_runs / 2:
            para_data["bold"] = True
        if italic_count > total_runs / 2:
            para_data["italic"] = True
        if underline_count > total_runs / 2:
            para_data["underline"] = True
    
    def _detect_heading_candidate(self, paragraph, para_data: Dict[str, Any]) -> None:
        """Detect if paragraph is likely a heading based on text and formatting."""
        text = para_data["text"]
        
        # Common heading patterns
        heading_patterns = [
            r'^CHAPTER\s+[IVXLCDM0-9]+',
            r'^[0-9]+\.\s+',
            r'^[0-9]+\.[0-9]+\.?\s+',
            r'^[IVXLCDM]+\.\s+',
            r'^APPENDIX\s+[A-Z0-9]',
            r'^ABSTRACT',
            r'^ACKNOWLEDGEMENT',
            r'^DEDICATION',
            r'^REFERENCES',
            r'^TABLE OF CONTENTS',
            r'^LIST OF TABLES',
            r'^LIST OF FIGURES',
            r'^ABBREVIATIONS',
        ]
        
        # Check if text matches heading patterns
        for pattern in heading_patterns:
            if re.match(pattern, text.upper()):
                para_data["is_heading_candidate"] = True
                return
        
        # Check formatting clues for headings
        is_short = len(text.split()) <= 15
        is_all_caps = text.isupper()
        has_large_font = para_data["font_size"] and para_data["font_size"] > 12
        is_centered = para_data["centered"]
        is_bold = para_data["bold"]
        
        # Multiple heading indicators
        heading_score = 0
        if is_short:
            heading_score += 1
        if is_all_caps:
            heading_score += 1
        if has_large_font:
            heading_score += 1
        if is_centered:
            heading_score += 1
        if is_bold:
            heading_score += 1
        
        para_data["is_heading_candidate"] = heading_score >= 3