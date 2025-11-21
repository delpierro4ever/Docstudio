# formatter-service/formatting/doc_builder_wrapper.py

from .doc_builder.base_builder import DocumentBuilder  # Import from FOLDER

# Create singleton instance
_builder = DocumentBuilder()

# Public API
def build_docx_from_structure(structured_doc, preserved_tables=None, preserved_images=None):
    return _builder.build_docx_from_structure(structured_doc, preserved_tables, preserved_images)