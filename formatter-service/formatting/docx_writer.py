# formatter-service/formatting/docx_writer.py

from io import BytesIO
from docx import Document


def save_document_to_bytes(doc: Document) -> bytes:
    """
    Save a python-docx Document to raw DOCX bytes.
    """
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.read()
