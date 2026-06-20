from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal

class AnchorMap(BaseModel):
    cover_start_idx: int = Field(..., description="Start index of Cover Page")
    title_page_idx: Optional[int] = Field(None, description="Start index of Title Page")
    declaration_idx: Optional[int] = Field(None, description="Start index of Declaration")
    dedication_idx: Optional[int] = Field(None, description="Start index of Dedication")
    acknowledgement_idx: Optional[int] = Field(None, description="Start index of Acknowledgement")
    abstract_idx: Optional[int] = Field(None, description="Start index of Abstract")
    toc_idx: Optional[int] = Field(None, description="Index of existing TOC heading if any")
    lof_idx: Optional[int] = Field(None, description="Index of existing LOF heading if any")
    lot_idx: Optional[int] = Field(None, description="Index of existing LOT heading if any")
    abbreviations_idx: Optional[int] = Field(None, description="Index of Abbreviations")
    main_content_start_idx: int = Field(..., description="The index where Chapter 1 / Introduction starts. This is critical.")
    references_idx: Optional[int] = Field(None, description="Start index of References")
    appendix_idx: Optional[int] = Field(None, description="Start index of Appendix")

class ChapterItem(BaseModel):
    chapter_no: int
    start_idx: int
    end_idx: Optional[int]
    title: str

class CaptionRules(BaseModel):
    figure_caption_prefix: str = "Figure"
    table_caption_prefix: str = "Table"

class ThesisStructure(BaseModel):
    doc_type: Literal["thesis", "report", "proposal"]
    confidence: float = Field(..., description="0.0 to 1.0 confidence score")
    anchors: AnchorMap
    section_order: List[str] = Field(..., description="Detected or IMPLIED order of sections")
    chapter_map: List[ChapterItem]
    caption_rules: CaptionRules
    notes: List[str] = []
