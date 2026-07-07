# formatter-service/docx_parser/image_extractor.py

from typing import List, Dict, Any
from docx.oxml.ns import qn

# Clark-notation tags — avoids relying on namespace prefix maps being present
_W_DRAWING   = qn("w:drawing")
_W_PICT      = qn("w:pict")

# DrawingML: <a:blip r:embed="rId7"/>
_A_BLIP      = "{http://schemas.openxmlformats.org/drawingml/2006/main}blip"
_R_EMBED     = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"

# VML: <v:imagedata r:id="rId5" o:title="..."/>
_V_IMAGEDATA = "{urn:schemas-microsoft-com:vml}imagedata"
_R_ID        = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def extract_images_from_paragraph(paragraph_element, parent_block_id: str) -> List[Dict[str, Any]]:
    """
    Scan a <w:p> element for embedded images in both formats:
      - DrawingML: <w:drawing> → <a:blip r:embed="rId7"/>
      - VML:       <w:pict>   → <v:imagedata r:id="rId5"/>

    Returns image block dicts with rel (relationship id) and parent block id.
    """
    images: List[Dict[str, Any]] = []

    for el in paragraph_element.iter():
        rel_id = None

        if el.tag == _W_DRAWING:
            # DrawingML — find the blip anywhere inside the drawing
            blip = el.find(f".//{_A_BLIP}")
            if blip is not None:
                rel_id = blip.get(_R_EMBED)

        elif el.tag == _W_PICT:
            # VML — find <v:imagedata> anywhere inside the picture block
            imagedata = el.find(f".//{_V_IMAGEDATA}")
            if imagedata is not None:
                rel_id = imagedata.get(_R_ID)

        if rel_id:
            images.append(
                {
                    "id": None,          # filled in by DOCXBlockParser
                    "type": "image",
                    "rel": rel_id,
                    "caption_guess": None,
                    "parent": parent_block_id,
                }
            )
            # One image per drawing/pict block — skip children to avoid duplicates
            continue

    return images
