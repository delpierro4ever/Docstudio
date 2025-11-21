# formatter-service/formatting/formatter.py

import logging
from docx import Document

# Import directly from the modules that exist
from .extractor_wrapper import extract_for_model, extract_original_tables, extract_original_images
from .llm_client import structure_document
from .body import apply_body_font, apply_paragraph_format
from .page_numbers import add_page_numbers
from .margins import apply_ub_margins

# Try different builder imports
try:
    from .doc_builder import build_docx_from_structure  # If doc_builder.py exists
except ImportError:
    try:
        from .doc_builder_wrapper import build_docx_from_structure  # If builder.py exists
    except ImportError:
        # Fallback: import from the test that worked
        import sys
        import os
        sys.path.append(os.path.dirname(__file__))
        from doc_builder.base_builder import DocumentBuilder
        def build_docx_from_structure(structured_doc, preserved_tables=None, preserved_images=None):
            builder = DocumentBuilder()
            return builder.build_docx_from_structure(structured_doc, preserved_tables, preserved_images)

logger = logging.getLogger(__name__)

def format_docx(input_path: str, output_path: str) -> None:
    """
    DocStudio v2 - LLM-powered formatter pipeline
    """
    logger.info(f"Starting LLM-powered formatting for: {input_path}")
    
    try:
        # 1) EXTRACTION PHASE
        logger.info("Phase 1: Extracting document content...")
        extracted = extract_for_model(input_path)
        preserved_tables = extract_original_tables(input_path)
        preserved_images = extract_original_images(input_path)
        
        logger.info(f"Extracted: {len(extracted['paragraphs'])} paragraphs, "
                   f"{len(extracted['tables'])} tables, {len(extracted['images'])} images")

        # 2) STRUCTURING PHASE
        logger.info("Phase 2: Structuring document with LLM...")
        structured_doc = structure_document(extracted)
        
        # DEBUG: Check what the LLM returned
        logger.info("=== LLM OUTPUT DEBUG ===")
        logger.info(f"Chapters: {len(structured_doc.get('chapters', []))}")
        total_paragraphs = 0
        for i, chapter in enumerate(structured_doc.get('chapters', [])):
            chapter_paragraphs = len(chapter.get('paragraphs', []))
            total_paragraphs += chapter_paragraphs
            logger.info(f"Chapter {i}: '{chapter.get('title', 'No title')}'")
            logger.info(f"  - Paragraphs: {chapter_paragraphs}")
            logger.info(f"  - Subsections: {len(chapter.get('subsections', []))}")
            
            # Debug subsections too
            for j, subsection in enumerate(chapter.get('subsections', [])):
                sub_paragraphs = len(subsection.get('paragraphs', []))
                total_paragraphs += sub_paragraphs
                logger.info(f"    Subsection {j}: '{subsection.get('title', 'No title')}'")
                logger.info(f"      - Paragraphs: {sub_paragraphs}")
        
        # Check preliminaries content
        preliminaries = structured_doc.get('preliminaries', {})
        logger.info(f"Preliminaries - Abstract: {len(preliminaries.get('abstract', []))} paragraphs")
        logger.info(f"Preliminaries - Dedication: {len(preliminaries.get('dedication', []))} paragraphs")
        logger.info(f"Preliminaries - Acknowledgement: {len(preliminaries.get('acknowledgement', []))} paragraphs")
        
        logger.info(f"TOTAL PARAGRAPHS IN STRUCTURE: {total_paragraphs}")
        logger.info(f"TOTAL PARAGRAPHS EXTRACTED: {len(extracted['paragraphs'])}")
        logger.info("=== END DEBUG ===")
        
        logger.info(f"Structured: {len(structured_doc.get('chapters', []))} chapters")

        # 3) BUILDING PHASE
        logger.info("Phase 3: Building formatted DOCX...")
        doc = build_docx_from_structure(structured_doc, preserved_tables, preserved_images)
        
        # DEBUG: Check what was actually built
        logger.info("=== BUILDER OUTPUT DEBUG ===")
        logger.info(f"Final document paragraphs: {len(doc.paragraphs)}")
        logger.info("=== END BUILDER DEBUG ===")
        
        # 4) FORMATTING PHASE
        logger.info("Phase 4: Applying UB formatting...")
        _apply_ub_formatting(doc)

        # Save final document
        logger.info(f"Saving formatted document to: {output_path}")
        doc.save(output_path)
        
        logger.info("✅ Formatting completed successfully!")

    except Exception as e:
        logger.error(f"❌ Formatting failed: {e}")
        raise

def _apply_ub_formatting(doc: Document) -> None:
    """Apply University of Buea formatting."""
    for paragraph in doc.paragraphs:
        apply_body_font(paragraph)
        apply_paragraph_format(paragraph)
    
    apply_ub_margins(doc)
    add_page_numbers(doc)