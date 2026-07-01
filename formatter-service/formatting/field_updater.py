# formatter-service/formatting/field_updater.py

"""
Utilities to make Word actually render the dynamic fields we emit
(TOC, LOT, LOF, SEQ, PAGE).

Two complementary strategies:

1. `enable_update_fields_on_open(doc)`
   Writes <w:updateFields w:val="true"/> into word/settings.xml so that
   Word recalculates every field the first time the document is opened.
   This is cheap, has no external dependencies, and is the reason the
   old "Updating table of contents..." placeholder stayed forever:
   the flag was never set, so Word never refreshed the fields.

2. `bake_fields_with_libreoffice(docx_bytes)`
   Optionally drives headless LibreOffice over UNO (see uno_bake.py) to
   load the document, refresh every field and index, and save the
   result — so even viewers that ignore `updateFields` (Google Docs,
   some mobile apps) show a populated TOC. A plain
   `soffice --convert-to docx` is NOT enough: it round-trips the file
   without updating indexes (verified empirically), which is why the
   UNO script exists. Controlled by DOCSTUDIO_BAKE_FIELDS (default:
   enabled when both soffice and a uno-capable python are installed).
   Any failure falls back to the original bytes.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import uuid
from typing import Optional

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def enable_update_fields_on_open(doc: Document) -> None:
    """
    Set <w:updateFields w:val="true"/> in word/settings.xml so Word
    refreshes TOC/LOT/LOF/SEQ/PAGE fields when the document is opened.
    """
    settings_el = doc.settings.element

    update_fields = settings_el.find(qn("w:updateFields"))
    if update_fields is None:
        update_fields = OxmlElement("w:updateFields")
        settings_el.append(update_fields)

    update_fields.set(qn("w:val"), "true")


def _soffice_binary() -> Optional[str]:
    return shutil.which("soffice") or shutil.which("libreoffice")


_uno_python_cache: Optional[str] = None
_uno_python_checked = False


def _uno_python() -> Optional[str]:
    """
    Find a python interpreter with the `uno` module (LibreOffice's
    scripting bridge). The service itself usually runs in a venv without
    uno, so we look at the system interpreters.
    """
    global _uno_python_cache, _uno_python_checked
    if _uno_python_checked:
        return _uno_python_cache
    _uno_python_checked = True

    candidates = [
        "/usr/bin/python3",
        shutil.which("python3"),
        "/usr/lib/libreoffice/program/python",
    ]
    for candidate in candidates:
        if not candidate or not os.path.exists(candidate):
            continue
        try:
            check = subprocess.run(
                [candidate, "-c", "import uno"],
                capture_output=True,
                timeout=30,
            )
            if check.returncode == 0:
                _uno_python_cache = candidate
                return candidate
        except Exception:
            continue

    return None


def bake_fields_enabled() -> bool:
    """
    Baking is on by default when LibreOffice + a uno-capable python are
    available; opt out with DOCSTUDIO_BAKE_FIELDS=0.
    """
    flag = os.getenv("DOCSTUDIO_BAKE_FIELDS", "1").strip().lower()
    if flag in ("0", "false", "no", "off"):
        return False
    return _soffice_binary() is not None and _uno_python() is not None


def bake_fields_with_libreoffice(docx_bytes: bytes, timeout_s: int = 180) -> Optional[bytes]:
    """
    Drive headless LibreOffice via the uno_bake.py helper to refresh all
    fields and indexes and write their results into the file.

    Returns the baked bytes, or None if anything failed (caller should
    keep the original bytes — Word will still update fields on open).
    """
    soffice = _soffice_binary()
    python = _uno_python()
    if soffice is None or python is None:
        return None

    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uno_bake.py")

    work_dir = tempfile.mkdtemp(prefix="docstudio_bake_")
    try:
        input_path = os.path.join(work_dir, f"{uuid.uuid4()}.docx")
        output_path = os.path.join(work_dir, "baked.docx")
        with open(input_path, "wb") as f:
            f.write(docx_bytes)

        result = subprocess.run(
            [python, script_path, soffice, input_path, output_path],
            capture_output=True,
            timeout=timeout_s,
        )
        if result.returncode != 0:
            print(f"[WARN] LibreOffice field bake failed "
                  f"(rc={result.returncode}): {result.stderr.decode(errors='replace')[:500]}")
            return None

        if not os.path.exists(output_path):
            print("[WARN] LibreOffice field bake produced no output file")
            return None

        with open(output_path, "rb") as f:
            return f.read()

    except Exception as exc:
        print(f"[WARN] LibreOffice field bake raised: {exc}")
        return None
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
