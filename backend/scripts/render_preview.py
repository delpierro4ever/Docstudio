#!/usr/bin/python3
"""Render preview page images of a formatted DOCX.

Usage: render_preview.py <input.docx> <out_dir> [max_pages]

Runs with the system python3 (it needs python3-uno) and a headless
LibreOffice. The formatter leaves the Table of Contents, List of
Tables/Figures and page numbers as Word fields that only refresh when
the document is opened, so the document is loaded through UNO, its
indexes and fields are updated, and only then is it exported to PDF.
The chosen pages are rasterised with pdftoppm to <out_dir>/<n>.png.

Prints one JSON line on success:
  {"pageCount": 58, "pages": [1, 2, 3, 9, 14]}
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid

import uno
from com.sun.star.beans import PropertyValue

DPI = 110
CONNECT_TIMEOUT_S = 30


def prop(name, value):
    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


def to_pdf(docx_path, pdf_path, profile_dir):
    pipe = f"ds_preview_{uuid.uuid4().hex}"
    office = subprocess.Popen(
        [
            "soffice", "--headless", "--invisible", "--norestore", "--nologo",
            "--nodefault", "--nolockcheck",
            f"-env:UserInstallation=file://{profile_dir}",
            f"--accept=pipe,name={pipe};urp;",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext(
            "com.sun.star.bridge.UnoUrlResolver", local
        )
        deadline = time.time() + CONNECT_TIMEOUT_S
        while True:
            try:
                ctx = resolver.resolve(
                    f"uno:pipe,name={pipe};urp;StarOffice.ComponentContext"
                )
                break
            except Exception:
                if time.time() > deadline or office.poll() is not None:
                    raise RuntimeError("LibreOffice did not start")
                time.sleep(0.3)

        desktop = ctx.ServiceManager.createInstanceWithContext(
            "com.sun.star.frame.Desktop", ctx
        )
        doc = desktop.loadComponentFromURL(
            uno.systemPathToFileUrl(os.path.abspath(docx_path)),
            "_blank",
            0,
            (prop("Hidden", True), prop("ReadOnly", True)),
        )
        if doc is None:
            raise RuntimeError("LibreOffice could not open the document")
        try:
            # Word treats its built-in "Heading N" styles as outline
            # level N even when styles.xml doesn't say so; LibreOffice
            # doesn't, and would build an empty Table of Contents.
            styles = doc.getStyleFamilies().getByName("ParagraphStyles")
            for name in styles.getElementNames():
                m = re.fullmatch(r"Heading ([1-9])", styles.getByName(name).getName())
                if m and styles.getByName(name).OutlineLevel == 0:
                    styles.getByName(name).OutlineLevel = int(m.group(1))
            # Twice: filling the TOC can move pages, which changes the
            # page numbers the TOC itself lists.
            for _ in range(2):
                indexes = doc.getDocumentIndexes()
                for i in range(indexes.getCount()):
                    indexes.getByIndex(i).update()
                doc.getTextFields().refresh()
                doc.refresh()
            doc.storeToURL(
                uno.systemPathToFileUrl(os.path.abspath(pdf_path)),
                (prop("FilterName", "writer_pdf_Export"),),
            )
        finally:
            doc.close(True)
        try:
            desktop.terminate()
        except Exception:
            pass  # the bridge drops as soon as the office exits
    finally:
        try:
            office.wait(timeout=10)
        except subprocess.TimeoutExpired:
            office.kill()


def page_count(pdf_path):
    out = subprocess.run(["pdfinfo", pdf_path], capture_output=True, text=True, check=True).stdout
    m = re.search(r"^Pages:\s+(\d+)", out, re.M)
    return int(m.group(1)) if m else 0


def page_text(pdf_path, n):
    return subprocess.run(
        ["pdftotext", "-f", str(n), "-l", str(n), "-layout", pdf_path, "-"],
        capture_output=True, text=True,
    ).stdout


CHAPTER_ONE = re.compile(r"^\s*(CHAPTER\s+(ONE|1|I)\b|1\.?\s+INTRODUCTION\b)", re.I | re.M)
CAPTION = re.compile(r"^\s*(Table|Figure)\s+\d+(\.\d+)?\b", re.M)
DOTTED_TOC_LINE = re.compile(r"\.{4,}\s*\d+\s*$", re.M)


def choose_pages(pdf_path, total, max_pages):
    """The opening pages, plus the start of Chapter One and the first
    page with a numbered caption: the pages that show the most of what
    the formatting did."""
    chosen = list(range(1, min(3, total) + 1))
    chapter_page = None
    caption_page = None
    for n in range(4, min(total, 60) + 1):
        text = page_text(pdf_path, n)
        if DOTTED_TOC_LINE.search(text):
            continue  # a TOC / list page, not the body
        if chapter_page is None and CHAPTER_ONE.search(text):
            chapter_page = n
        if caption_page is None and CAPTION.search(text):
            caption_page = n
        if chapter_page and caption_page:
            break
    for n in (chapter_page, caption_page):
        if n and n not in chosen:
            chosen.append(n)
    n = chosen[-1] + 1
    while len(chosen) < max_pages and n <= total:
        chosen.append(n)
        n += 1
    return sorted(chosen[:max_pages])


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    docx_path, out_dir = sys.argv[1], sys.argv[2]
    max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    os.makedirs(out_dir, exist_ok=True)

    work = tempfile.mkdtemp(prefix="ds-preview-")
    try:
        pdf_path = os.path.join(work, "doc.pdf")
        to_pdf(docx_path, pdf_path, os.path.join(work, "profile"))
        if not os.path.exists(pdf_path):
            raise RuntimeError("PDF export produced no file")

        total = page_count(pdf_path)
        pages = choose_pages(pdf_path, total, max_pages)
        for i, n in enumerate(pages, start=1):
            prefix = os.path.join(work, f"p{i}")
            subprocess.run(
                ["pdftoppm", "-png", "-r", str(DPI), "-f", str(n), "-l", str(n), "-singlefile",
                 pdf_path, prefix],
                check=True, capture_output=True,
            )
            shutil.move(prefix + ".png", os.path.join(out_dir, f"{i}.png"))
        print(json.dumps({"pageCount": total, "pages": pages}))
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # reported to the backend via stderr + exit code
        print(f"preview failed: {exc}", file=sys.stderr)
        sys.exit(1)
