# formatter-service/formatting/__init__.py

# Import functions directly from their modules
from .extractor_wrapper import extract_for_model, extract_original_tables, extract_original_images
from .llm_client import structure_document
from .formatter import format_docx

# Try to import builder, but don't break if it fails
try:
    from .doc_builder import build_docx_from_structure
except ImportError:
    try:
        from .doc_builder_wrapper import build_docx_from_structure
    except ImportError:
        # Create a placeholder
        def build_docx_from_structure(*args, **kwargs):
            from docx import Document
            doc = Document()
            doc.add_paragraph("Builder not available")
            return doc

__all__ = [
    "extract_for_model",
    "extract_original_tables", 
    "extract_original_images",
    "structure_document", 
    "build_docx_from_structure",
    "format_docx"
]