from __future__ import annotations

from typing import Any, Dict, Optional

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Cm
from docx.enum.style import WD_STYLE_TYPE  # Public import
from docx.enum.dml import MSO_THEME_COLOR  # Public import


def _ensure_heading_styles_conform(doc: Document, profile: Dict[str, Any]) -> None:
    """
    Ensures Heading 1, 2, and 3 styles exist and conform to the profile's font/size/bold settings.
    This prevents KeyErrors in heading_builder.py and guarantees TOC compatibility.
    """
    headings_cfg = profile.get("headings", {})
    global_font_family = profile.get("font", {}).get("family", "Times New Roman")
    
    style_configs = {
        # Using the styleName property from the profile config keys
        "Heading 1": headings_cfg.get("chapterHeading", {}),
        "Heading 2": headings_cfg.get("subHeading1", {}),
        "Heading 3": headings_cfg.get("subHeading2", {}),
    }

    for style_name, cfg in style_configs.items():
        if not cfg:
            continue
            
        try:
            # Try to get the existing built-in style
            style = doc.styles[style_name] # Removed private type hint
        except KeyError:
            # If style doesn't exist (rare for built-in, but defensive), add it
            style = doc.styles.add_style(style_name, WD_STYLE_TYPE.PARAGRAPH)
            style.based_on = doc.styles['Normal'] # Base on Normal for safety
            style.next_paragraph_style = doc.styles['Normal']

        # Apply basic formatting from the profile to the style itself
        
        # 1. Font
        if global_font_family:
            style.font.name = global_font_family
        if cfg.get("fontSize") is not None:
            style.font.size = Pt(cfg["fontSize"])
        
        # 2. Bold/Italics/Color (Explicitly enforcing user's requirement)
        style.font.bold = cfg.get("bold", False)
        style.font.italic = cfg.get("italics", False)
        # Ensures font color is theme black (TEXT_1)
        style.font.theme_color = MSO_THEME_COLOR.TEXT_1 
        
        # 3. Paragraph Alignment (Ensuring Heading 1 is centered, others left)
        alignment = cfg.get("alignment", "left").lower()
        if alignment == "center":
            style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
            
        print(f"[INFO] Guaranteed style conformity for: {style_name}")


def apply_basic_style(
    doc: Document,
    profile: Dict[str, Any],
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Apply global formatting from the text profile, and guarantee heading styles.
    """

    # NEW STEP: Ensure heading styles exist and conform to profile BEFORE applying formatting to paragraphs
    try:
        _ensure_heading_styles_conform(doc, profile)
    except Exception as exc:
        print(f"[WARN] Failed to ensure heading styles conform: {exc}")


    font_cfg = profile.get("font", {}) or {}
    para_cfg = profile.get("paragraph", {}) or {}
    margins_cfg = profile.get("margins", {}) or {}

    # ------------------------------------------------------------------
    # 1) Page margins for all sections
    # ------------------------------------------------------------------
    try:
        top_cm = margins_cfg.get("topCm")
        bottom_cm = margins_cfg.get("bottomCm")
        left_cm = margins_cfg.get("leftCm")
        right_cm = margins_cfg.get("rightCm")

        for section in doc.sections:
            if top_cm is not None:
                section.top_margin = Cm(top_cm)
            if bottom_cm is not None:
                section.bottom_margin = Cm(bottom_cm)
            if left_cm is not None:
                section.left_margin = Cm(left_cm)
            if right_cm is not None:
                section.right_margin = Cm(right_cm)
    except Exception as exc:
        print(f"[WARN] apply_basic_style: failed to set margins: {exc}")

    # ------------------------------------------------------------------
    # 2) Paragraph + font formatting (Applied globally to all body text)
    # ------------------------------------------------------------------
    justify = bool(para_cfg.get("justify", False))
    line_spacing = para_cfg.get("lineSpacing")  # e.g. 1.5
    space_before = para_cfg.get("spaceBefore", 0)  # in points
    space_after = para_cfg.get("spaceAfter", 0)  # in points
    first_line_indent_cm = para_cfg.get("firstLineIndentCm", 0.0)

    font_family = font_cfg.get("family")
    font_size_pt = font_cfg.get("size")  # e.g. 12

    for paragraph in doc.paragraphs:
        pf = paragraph.paragraph_format

        style_name = paragraph.style.name if paragraph.style is not None else ""
        # Check for both built-in styles and the names used in heading_builder.py
        is_heading = style_name.startswith("Heading") or style_name in ["Heading 1", "Heading 2", "Heading 3"]

        # Alignment
        if justify:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

        # Line spacing
        if line_spacing is not None:
            try:
                pf.line_spacing = float(line_spacing)
            except Exception:
                pass

        # Space before/after (points)
        try:
            pf.space_before = Pt(space_before)
            pf.space_after = Pt(space_after)
        except Exception:
            pass

        # First-line indent only for normal paragraphs (not headings)
        if not is_heading:
            try:
                pf.first_line_indent = Cm(first_line_indent_cm)
            except Exception:
                pass

        # Font family & size applied to runs
        for run in paragraph.runs:
            if font_family:
                run.font.name = font_family

            if font_size_pt:
                try:
                    run.font.size = Pt(font_size_pt)
                except Exception:
                    pass