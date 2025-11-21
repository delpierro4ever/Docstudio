# formatter-service/formatting/margins.py

from docx.shared import Cm
from docx.document import Document as _Document  # type hint only


def apply_ub_margins(doc: "_Document") -> None:
    """
    Apply University of Buea default margins to all sections:
      - Top: 2.5 cm
      - Bottom: 2.5 cm
      - Left: 3.0 cm
      - Right: 2.5 cm
    """
    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(3.0)
        section.right_margin = Cm(2.5)
