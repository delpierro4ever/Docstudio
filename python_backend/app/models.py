from dataclasses import dataclass, field
from typing import List, Optional, Dict

@dataclass
class SectionRange:
    start_index: int
    end_index: int

@dataclass
class DocStructure:
    # Paragraph indices for key sections
    cover_page_range: Optional[SectionRange] = None
    title_page_range: Optional[SectionRange] = None
    
    # Map of prelim name (e.g., 'abstract') to list of paragraph indices
    # We store indices to be able to extract/move content later
    prelim_content: Dict[str, SectionRange] = field(default_factory=dict)
    
    # Where does Chapter 1 start?
    main_content_start_index: int = 0
    
    # Found markers
    has_toc: bool = False
    has_lof: bool = False
    has_lot: bool = False

@dataclass
class FormattingConfig:
    font_name: str = "Times New Roman"
    font_size_pt: int = 12
    line_spacing: float = 1.5
    alignment: str = "JUSTIFY"  # WD_ALIGN_PARAGRAPH.JUSTIFY
