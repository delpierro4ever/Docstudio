#!/usr/bin/env python3
"""
Standalone LibreOffice UNO script: load a DOCX, refresh every field and
document index (TOC, LOT, LOF), and save the result.

Run with the SYSTEM python3 (the one with the `uno` module that ships with
LibreOffice), not the service venv:

    /usr/bin/python3 uno_bake.py <soffice-binary> <input.docx> <output.docx>

Exit code 0 means <output.docx> was written with baked field results.
This exists because `soffice --convert-to docx` does NOT update indexes,
so a plain round-trip leaves the TOC placeholder untouched.
"""

import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid

CONNECT_ATTEMPTS = 60
CONNECT_DELAY_S = 0.5


def _prop(name, value):
    from com.sun.star.beans import PropertyValue

    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2

    soffice, in_path, out_path = sys.argv[1:4]

    try:
        import uno  # noqa: F401
    except ImportError:
        print("uno module not available in this interpreter", file=sys.stderr)
        return 3

    pipe_name = f"docstudio_{uuid.uuid4().hex}"
    profile_dir = tempfile.mkdtemp(prefix="docstudio_lo_profile_")

    soffice_proc = subprocess.Popen(
        [
            soffice,
            "--headless",
            "--invisible",
            "--norestore",
            "--nolockcheck",
            f"-env:UserInstallation=file://{profile_dir}",
            f"--accept=pipe,name={pipe_name};urp;",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        import uno

        local_ctx = uno.getComponentContext()
        resolver = local_ctx.ServiceManager.createInstanceWithContext(
            "com.sun.star.bridge.UnoUrlResolver", local_ctx
        )

        ctx = None
        for _ in range(CONNECT_ATTEMPTS):
            try:
                ctx = resolver.resolve(
                    f"uno:pipe,name={pipe_name};urp;StarOffice.ComponentContext"
                )
                break
            except Exception:
                time.sleep(CONNECT_DELAY_S)

        if ctx is None:
            print("could not connect to headless LibreOffice", file=sys.stderr)
            return 4

        desktop = ctx.ServiceManager.createInstanceWithContext(
            "com.sun.star.frame.Desktop", ctx
        )

        in_url = "file://" + os.path.abspath(in_path)
        doc = desktop.loadComponentFromURL(
            in_url, "_blank", 0, (_prop("Hidden", True),)
        )
        if doc is None:
            print(f"failed to load {in_path}", file=sys.stderr)
            return 5

        try:
            # Refresh text fields (PAGE, SEQ, ...) then rebuild the indexes
            doc.refresh()
            indexes = doc.getDocumentIndexes()
            for i in range(indexes.getCount()):
                indexes.getByIndex(i).update()

            out_url = "file://" + os.path.abspath(out_path)
            doc.storeToURL(out_url, (_prop("FilterName", "MS Word 2007 XML"),))
        finally:
            doc.close(False)

        return 0

    finally:
        soffice_proc.terminate()
        try:
            soffice_proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            soffice_proc.kill()
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
