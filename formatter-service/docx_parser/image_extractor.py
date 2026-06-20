# formatter-service/docx_parser/image_extractor.py

from typing import List, Dict, Any
from docx.oxml.ns import qn


def extract_images_from_paragraph(paragraph_element, parent_block_id: str) -> List[Dict[str, Any]]:
    """
    Scan a <w:p> paragraph element for embedded images (w:drawing → a:blip).
    Returns a list of image block dicts with:
      - id: F# (assigned later by the parser)
      - type: "image"
      - rel: relationship id (r:embed value), e.g. "rId7"
      - caption_guess: reserved for future caption detection
      - parent: the parent paragraph block id (e.g. "P12")
    """
    images: List[Dict[str, Any]] = []

    # paragraph_element is a CT_P (<w:p>). We look for nested <w:drawing> elements.
    for el in paragraph_element.iter():
        if el.tag == qn("w:drawing"):
            # Look for <a:blip> inside the drawing, which holds r:embed
            blip = el.find(".//a:blip", namespaces=el.nsmap)
            if blip is None:
                continue

            rel_id = blip.get(qn("r:embed"))
            if not rel_id:
                continue

            images.append(
                {
                    "id": None,  # will be filled in by DOCXBlockParser
                    "type": "image",
                    "rel": rel_id,
                    "caption_guess": None,
                    "parent": parent_block_id,
                }
            )

    return images
