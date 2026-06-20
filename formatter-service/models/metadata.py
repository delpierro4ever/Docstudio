# formatter-service/models/metadata.py

from typing import Optional, Dict
from pydantic import BaseModel, Field


class BlockClassification(BaseModel):
    """
    Represents the classification for a single block (P#, T#, F#)
    as returned by the LLM.

    All fields are optional except 'role' so we stay robust even
    when the LLM omits some metadata.
    """

    role: str = Field(..., description="Academic role of the block (e.g. body_paragraph, chapter_heading, table, figure, reference_entry)")
    section: Optional[str] = Field(
        default=None,
        description="Document section: 'prelim' or 'main'",
    )

    # Heading-related
    chapter: Optional[int] = Field(
        default=None,
        description="Chapter number if applicable",
    )
    headingLevel: Optional[int] = Field(
        default=None,
        description="Heading level for headings (1, 2, 3)",
    )
    title: Optional[str] = Field(
        default=None,
        description="Clean title text for headings or headings-like blocks",
    )

    # Tables
    tableNumber: Optional[str] = Field(
        default=None,
        description="Table label, e.g. 'Table 3.1'",
    )

    # Figures
    figureNumber: Optional[str] = Field(
        default=None,
        description="Figure label, e.g. 'Figure 2.4'",
    )

    # Captions & references
    caption: Optional[str] = Field(
        default=None,
        description="Caption text for table/figure/caption blocks",
    )

    # Optional raw text that LLM may attach for later formatting
    rawText: Optional[str] = Field(
        default=None,
        description="Optional raw text or content associated with the block",
    )

    class Config:
        extra = "allow"   # Accept extra keys from LLM without failing


class SectionsMeta(BaseModel):
    """
    Document-level section metadata.
    """
    prelim_ends_before_block_id: Optional[str] = Field(
        default=None,
        description="Block ID where prelim ends BEFORE this block; that block is first in main section",
    )

    class Config:
        extra = "allow"


class DocumentMetadata(BaseModel):
    """
    Top-level metadata object for the whole document, as returned by the LLM.

    Example structure:
    {
      "blocks": {
        "P1": {...},
        "P2": {...}
      },
      "sections": {
        "prelim_ends_before_block_id": "P10"
      }
    }
    """

    blocks: Dict[str, BlockClassification] = Field(
        default_factory=dict,
        description="Per-block classification keyed by block id (P1, T1, F1, ...)",
    )
    sections: SectionsMeta = Field(
        default_factory=SectionsMeta,
        description="Section boundary metadata (prelim/main).",
    )

    class Config:
        extra = "allow"

    @classmethod
    def from_raw(cls, data: dict) -> "DocumentMetadata":
        """
        Helper to build a DocumentMetadata from a raw dict produced by the LLM.
        Safe to use after schema_validator.normalize_classification().
        """
        return cls(**data)
