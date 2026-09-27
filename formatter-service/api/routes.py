# formatter-service/api/routes.py

import os
import traceback
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

from pipeline.docx_pipeline import InvalidDocumentError, run_pipeline, run_quick_pipeline

router = APIRouter()

# Base dir of project
BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BASE_DIR / "storage" / "temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/format", response_class=Response)
async def format_document(
    file: UploadFile = File(...),
    profileId: str = Form(...),
    documentType: str = Form("report"),
):
    """
    Main endpoint called by the Node backend.

    Node sends:
      - multipart/form-data with:
          file      -> uploaded DOCX
          profileId -> selected formatting profile ID

    We:
      1. Save the uploaded file to a temp path
      2. Run the DocStudio pipeline (parse → LLM classify → format)
      3. Return the formatted DOCX as raw bytes
    """
    # 1) Save uploaded file to a temporary location
    try:
        suffix = Path(file.filename or "").suffix or ".docx"
        temp_name = f"{uuid.uuid4()}{suffix}"
        temp_path = TEMP_DIR / temp_name

        contents = await file.read()
        temp_path.write_bytes(contents)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save uploaded file: {e}",
        )

    if not contents:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")

    # 2) Run pipeline — quick (print-ready) or full
    try:
        if documentType == "print_ready":
            output_bytes = run_quick_pipeline(
                input_path=str(temp_path),
                profile_id=profileId,
            )
        else:
            output_bytes = run_pipeline(
                input_path=str(temp_path),
                profile_id=profileId,
            )
    except InvalidDocumentError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except FileNotFoundError:
        # Shouldn't happen, but just in case
        raise HTTPException(status_code=404, detail="Input file not found")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Formatter error: {e}",
        )
    finally:
        # Optionally clean up temp input file.
        # Comment this out if you want to inspect temp files during debugging.
        if temp_path.exists():
            try:
                os.remove(temp_path)
            except Exception:
                # Ignore cleanup errors
                pass

    # 3) Return formatted DOCX bytes to Node
    return Response(
        content=output_bytes,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
    )
