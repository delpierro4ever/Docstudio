# formatter-service/pipeline/docx_pipeline.py

from typing import Optional, Dict, Any, List

from docx_parser import DOCXBlockParser
from llm.client import LLMClassifier
from formatting.formatter import format_docx


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
    parser = DOCXBlockParser(input_path)
    blocks: List[Dict[str, Any]] = parser.parse()

    if not blocks:
        # For safety – you can customize this behavior
        raise ValueError("No blocks were extracted from the input DOCX.")

    # 2) LLM classification (roles, sections, headings, tables, figures, refs)
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
