# formatter-service/docx_parser/parser.py

from typing import List, Dict, Any

from docx import Document
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph

from .image_extractor import extract_images_from_paragraph


class DOCXBlockParser:
    """
    Parses a DOCX into a linear sequence of blocks:

      - Paragraph blocks:  { id: "P1", type: "paragraph", text, original_xml }
      - Table blocks:      { id: "T1", type: "table", xml, caption_guess }
      - Image blocks:      { id: "F1", type: "image", rel, caption_guess, parent }

    The 'id' field is stable and used by the LLM + formatter pipeline.
    """

    def __init__(self, docx_path: str):
        self.docx_path = docx_path
        self.blocks: List[Dict[str, Any]] = []
        self.block_counter = {"P": 0, "T": 0, "F": 0}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def parse(self) -> List[Dict[str, Any]]:
        """
        Parse the DOCX and return a list of blocks in document order.
        """
        doc = Document(self.docx_path)

        # Iterate through body elements in document order
        for element in doc.element.body:
            if self._is_paragraph(element):
                self._extract_paragraph(element)
            elif self._is_table(element):
                self._extract_table(element)
            # Images are handled as children inside paragraphs, not as top-level elements.

        return self.blocks

    # ------------------------------------------------------------------
    # Type detection
    # ------------------------------------------------------------------

    def _is_paragraph(self, element) -> bool:
        return element.tag == qn("w:p")

    def _is_table(self, element) -> bool:
        return element.tag == qn("w:tbl")

    # ------------------------------------------------------------------
    # Block extraction
    # ------------------------------------------------------------------

    def _extract_paragraph(self, element) -> None:
        """
        Register a paragraph block (P#) and any images inside it (F#).
        """
        # Create paragraph block
        self.block_counter["P"] += 1
        block_id = f"P{self.block_counter['P']}"

        para = Paragraph(element, None)  # parent None is okay for text extraction
        text = para.text

        self.blocks.append(
            {
                "id": block_id,
                "type": "paragraph",
                "text": text,
                "original_xml": element.xml,
            }
        )

        # Extract any images inside this paragraph
        image_blocks = extract_images_from_paragraph(element, parent_block_id=block_id)
        for img in image_blocks:
            self.block_counter["F"] += 1
            img["id"] = f"F{self.block_counter['F']}"
            img["caption_guess"] = self._guess_image_caption(element)
            self.blocks.append(img)

    def _extract_table(self, element) -> None:
        """
        Register a table block (T#). Caption detection is handled by a simple
        nearby-paragraph heuristic for now.
        """
        self.block_counter["T"] += 1
        block_id = f"T{self.block_counter['T']}"

        caption_guess = self._guess_caption_from_context(element)

        self.blocks.append(
            {
                "id": block_id,
                "type": "table",
                "xml": element.xml,
                "caption_guess": caption_guess,
            }
        )

    # ------------------------------------------------------------------
    # Caption helper
    # ------------------------------------------------------------------

    def _guess_caption_from_context(self, element) -> str | None:
        """
        Look at previous/next paragraph for a likely caption, for table blocks.
        """
        # Check previous element
        prev_el = element.getprevious()
        if prev_el is not None and prev_el.tag == qn("w:p"):
            prev_para = Paragraph(prev_el, None)
            prev_text = prev_para.text.strip()
            if self._looks_like_caption(prev_text):
                return prev_text

        # Check next element
        next_el = element.getnext()
        if next_el is not None and next_el.tag == qn("w:p"):
            next_para = Paragraph(next_el, None)
            next_text = next_para.text.strip()
            if self._looks_like_caption(next_text):
                return next_text

        return None

    def _guess_image_caption(self, image_para_element) -> str | None:
        """Look at the next (and previous) sibling paragraph for a figure caption."""
        next_el = image_para_element.getnext()
        if next_el is not None and next_el.tag == qn("w:p"):
            text = Paragraph(next_el, None).text.strip()
            if self._looks_like_caption(text):
                return text
        prev_el = image_para_element.getprevious()
        if prev_el is not None and prev_el.tag == qn("w:p"):
            text = Paragraph(prev_el, None).text.strip()
            if self._looks_like_caption(text):
                return text
        return None

    def _looks_like_caption(self, text: str) -> bool:
        """
        Very simple heuristic: detect typical caption patterns.
        """
        if not text:
            return False

        lower = text.lower()
        caption_keywords = ["table", "figure", "fig.", "image", "chart", "photo", "plate"]

        return any(keyword in lower for keyword in caption_keywords)
