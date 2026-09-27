# formatter-service/pipeline/docx_pipeline.py

import zipfile
from io import BytesIO
from typing import Optional, Dict, Any, List

from docx import Document
from docx_parser import DOCXBlockParser
from llm.client import LLMClassifier
from config.profiles import load_profile
from formatting.formatter import format_docx
from formatting.basic_style import apply_basic_style
from formatting.field_updater import enable_update_fields_on_open
from formatting.section_builder import add_arabic_page_numbers


class InvalidDocumentError(ValueError):
    """The upload is not a DOCX we can read (corrupt, wrong format, empty)."""


def load_document(input_path: str):
    """
    Open a DOCX, turning every "this isn't a readable DOCX" failure into
    InvalidDocumentError so the API can answer 422 instead of 500.
    """
    if not zipfile.is_zipfile(input_path):
        raise InvalidDocumentError(
            "The uploaded file is not a valid .docx document "
            "(legacy .doc, PDF, and corrupted files are not supported)."
        )
    try:
        with zipfile.ZipFile(input_path) as zf:
            names = set(zf.namelist())
            if "word/document.xml" not in names:
                raise InvalidDocumentError(
                    "The uploaded file is a ZIP archive but not a Word document."
                )
            bad = zf.testzip()
            if bad is not None:
                raise InvalidDocumentError(f"The .docx archive is corrupted ({bad}).")
        return Document(input_path)
    except InvalidDocumentError:
        raise
    except Exception as exc:
        raise InvalidDocumentError(f"The .docx file could not be read: {exc}") from exc


def run_quick_pipeline(
    input_path: str,
    profile_id: Optional[str] = None,
) -> bytes:
    """
    Lightweight pipeline for print-ready documents (reports to print).

    Skips LLM classification and preliminary pages.
    Only applies: font, line spacing, paragraph style, margins, heading
    styles, and simple Arabic page numbering.
    """
    profile = load_profile(profile_id)
    doc = load_document(input_path)

    try:
        apply_basic_style(doc, profile, metadata=None)
    except Exception as exc:
        print(f"[WARN] quick apply_basic_style failed: {exc}")

    try:
        add_arabic_page_numbers(doc)
    except Exception as exc:
        print(f"[WARN] quick add_arabic_page_numbers failed: {exc}")

    try:
        enable_update_fields_on_open(doc)
    except Exception as exc:
        print(f"[WARN] quick enable_update_fields_on_open failed: {exc}")

    bio = BytesIO()
    doc.save(bio)
    print("[INFO] Quick format complete (no LLM, no prelim pages)")
    return bio.getvalue()


def run_pipeline(
    input_path: str,
    profile_id: Optional[str] = None,
) -> bytes:
    """
    Full DocStudio pipeline for a single DOCX file.

    Steps:
      1. Parse DOCX into ordered blocks (P#, T#, F#).
      2. Send blocks to LLM for structural classification.
      3. Use blocks + LLM metadata to rebuild a formatted DOCX.
      4. Return the formatted DOCX as raw bytes.

    :param input_path: Path to the original DOCX file (temp upload).
    :param profile_id: Optional formatting profile (from frontend/backend).
    :return: Bytes of the new formatted DOCX file.
    """

    # 1) Parse DOCX into blocks
    load_document(input_path)
    parser = DOCXBlockParser(input_path)
    blocks: List[Dict[str, Any]] = parser.parse()

    if not any((b.get("text") or "").strip() for b in blocks if b.get("type") == "paragraph"):
        raise InvalidDocumentError("The document contains no text to format.")

    # 2) Classification (roles, sections, headings, tables, figures, refs).
    #    Falls back to the rule-based classifier if the LLM is unavailable.
    llm = LLMClassifier()
    classification_metadata: Dict[str, Any] = llm.classify_document_blocks(blocks)

    # 3) Formatting engine produces a new DOCX in memory
    output_bytes: bytes = format_docx(
        input_path=input_path,
        blocks=blocks,
        metadata=classification_metadata,
        profile_id=profile_id,
    )

    return output_bytes
