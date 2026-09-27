# formatter-service/tools/inspect_docx.py

"""
Structural report for a formatted DOCX: sections and their page-number
format, footer PAGE fields, prelim/main split, headings, captions, and
the TOC / LOT / LOF fields.

    python tools/inspect_docx.py path/to/output.docx [--json]

inspect_docx() is also used by the tests to assert on real output.
"""

import json
import sys
from typing import Any, Dict, List

from docx import Document
from docx.oxml.ns import qn


def _instr_texts(element) -> List[str]:
    parts = [t.text or "" for t in element.iter(qn("w:instrText"))]
    parts += [f.get(qn("w:instr")) or "" for f in element.iter(qn("w:fldSimple"))]
    return [p.strip() for p in parts if p.strip()]


def inspect_docx(path: str) -> Dict[str, Any]:
    doc = Document(path)
    body = doc.element.body

    # Walk body paragraphs, tracking which section each lands in: a
    # paragraph-level sectPr closes the current section.
    section_idx = 0
    paragraphs: List[Dict[str, Any]] = []
    for el in body.iterchildren():
        if el.tag == qn("w:tbl"):
            paragraphs.append({"kind": "table", "section": section_idx})
            continue
        if el.tag != qn("w:p"):
            continue
        style_el = el.find(f"{qn('w:pPr')}/{qn('w:pStyle')}")
        text = "".join(t.text or "" for t in el.iter(qn("w:t")))
        paragraphs.append({
            "kind": "paragraph",
            "section": section_idx,
            "style": style_el.get(qn("w:val")) if style_el is not None else None,
            "text": text,
            "fields": _instr_texts(el),
            "has_image": el.find(".//" + qn("w:drawing")) is not None
                         or el.find(".//{urn:schemas-microsoft-com:vml}imagedata") is not None,
        })
        if el.find(f"{qn('w:pPr')}/{qn('w:sectPr')}") is not None:
            section_idx += 1

    sections = []
    for i, sec in enumerate(doc.sections):
        pg = sec._sectPr.find(qn("w:pgNumType"))
        footer_fields: List[str] = []
        footer_text = ""
        if not sec.footer.is_linked_to_previous:
            footer_fields = _instr_texts(sec.footer._element)
            footer_text = "".join(t.text or "" for t in sec.footer._element.iter(qn("w:t")))
        sections.append({
            "index": i,
            "page_number_format": pg.get(qn("w:fmt")) if pg is not None else None,
            "page_number_start": pg.get(qn("w:start")) if pg is not None else None,
            "footer_linked_to_previous": sec.footer.is_linked_to_previous,
            "footer_fields": footer_fields,
            "footer_text": footer_text,
            "first_text": next(
                (p["text"] for p in paragraphs
                 if p["section"] == i and p["kind"] == "paragraph" and p["text"].strip()),
                None,
            ),
        })

    all_fields = [f for p in paragraphs if p["kind"] == "paragraph" for f in p["fields"]]
    settings = doc.settings.element
    update_fields = settings.find(qn("w:updateFields"))

    return {
        "sections": sections,
        "headings": [
            {"style": p["style"], "text": p["text"], "section": p["section"]}
            for p in paragraphs
            if p["kind"] == "paragraph" and (p["style"] or "").lower().startswith("heading")
        ],
        "captions": [
            {"text": p["text"], "fields": p["fields"], "section": p["section"]}
            for p in paragraphs
            if p["kind"] == "paragraph" and any(f.startswith("SEQ") for f in p["fields"])
        ],
        "has_toc_field": any(f.startswith("TOC") and "\\c" not in f for f in all_fields),
        "has_lot_field": any(f.startswith("TOC") and '\\c "Table"' in f for f in all_fields),
        "has_lof_field": any(f.startswith("TOC") and '\\c "Figure"' in f for f in all_fields),
        "update_fields_on_open": update_fields is not None
                                 and update_fields.get(qn("w:val")) in ("true", "1", None),
        "tables": sum(1 for p in paragraphs if p["kind"] == "table"),
        "images": sum(1 for p in paragraphs if p.get("has_image")),
        "prelim_texts": [
            p["text"] for p in paragraphs
            if p["kind"] == "paragraph" and p["section"] == 0 and p["text"].strip()
        ],
    }


def _print_report(report: Dict[str, Any]) -> None:
    print("SECTIONS")
    for s in report["sections"]:
        print(f"  [{s['index']}] numbering={s['page_number_format']} start={s['page_number_start']} "
              f"footer_fields={s['footer_fields']} footer_text={s['footer_text']!r} first_text={s['first_text']!r}")
    print("PRELIM TEXT (section 0)")
    for t in report["prelim_texts"]:
        print(f"  {t!r}")
    print("HEADINGS")
    for h in report["headings"]:
        print(f"  s{h['section']} {h['style']:<10} {h['text']!r}")
    print("CAPTIONS")
    for c in report["captions"]:
        print(f"  s{c['section']} {c['text']!r} {c['fields']}")
    for key in ("has_toc_field", "has_lot_field", "has_lof_field",
                "update_fields_on_open", "tables", "images"):
        print(f"{key}: {report[key]}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: inspect_docx.py FILE.docx [--json]")
    result = inspect_docx(sys.argv[1])
    if "--json" in sys.argv:
        print(json.dumps(result, indent=2))
    else:
        _print_report(result)
