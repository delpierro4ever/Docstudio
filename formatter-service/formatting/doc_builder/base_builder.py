# formatter-service/formatting/doc_builder/base_builder.py

from docx import Document
from typing import Dict, List, Any
import logging
from .front_matter_builder import FrontMatterBuilder
from .chapter_builder import ChapterBuilder
from .back_matter_builder import BackMatterBuilder

logger = logging.getLogger(__name__)

class DocumentBuilder:
    """Main orchestrator for document building."""
    
    def __init__(self):
        self.doc = None
        self.front_matter_builder = FrontMatterBuilder()
        self.chapter_builder = ChapterBuilder()
        self.back_matter_builder = BackMatterBuilder()
    
    def build_docx_from_structure(self, structured_doc: Dict[str, Any], 
                                preserved_tables: List[Dict[str, Any]] = None,
                                preserved_images: List[Dict[str, Any]] = None) -> Document:
        """Build formatted DOCX from structured JSON."""
        logger.info("Starting document building...")
        
        self.doc = Document()
        self.preserved_tables = preserved_tables or []
        self.preserved_images = preserved_images or []
        
        try:
            self._apply_base_formatting()
            
            # Build document sections - PASS preserved data
            self.front_matter_builder.build(self.doc, structured_doc)
            self.chapter_builder.build(self.doc, structured_doc)
            self.back_matter_builder.build(self.doc, structured_doc)
            
            # TODO: Integrate preserved tables and images
            self._integrate_preserved_content()
            
            logger.info("Document building completed successfully")
            return self.doc
            
        except Exception as e:
            logger.error(f"Document building failed: {e}")
            raise
    
    def _apply_base_formatting(self):
        """Apply basic UB formatting."""
        from docx.shared import Inches
        sections = self.doc.sections
        for section in sections:
            section.top_margin = Inches(1)
            section.bottom_margin = Inches(1)
            section.left_margin = Inches(1)
            section.right_margin = Inches(1)
    
    def _integrate_preserved_content(self):
        """Integrate preserved tables and images into the document."""
        logger.info(f"Integrating {len(self.preserved_tables)} preserved tables and {len(self.preserved_images)} images")
        # TODO: Implement table and image integration logic
        # This is complex and requires understanding the document structure
        # For now, we'll log what we have
        if self.preserved_tables:
            logger.info("Preserved tables available (not yet integrated)")
        if self.preserved_images:
            logger.info("Preserved images available (not yet integrated)")