# formatter-service/main.py

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
import uuid
import os
import traceback

from formatting import format_docx  # uses formatting/formatter.py


app = FastAPI()


@app.post("/format")
async def format_document(
    file: UploadFile = File(...),
    profileId: str | None = Form(None),  # 👈 we accept it but ignore for now
):
    """
    Receive a .docx file + optional profileId,
    run it through the formatter, and return the formatted .docx.
    """
    # Ensure folders exist
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("outputs", exist_ok=True)

    input_filename = os.path.join("uploads", f"{uuid.uuid4()}.docx")
    output_filename = os.path.join("outputs", f"{uuid.uuid4()}.docx")

    # 1) Save uploaded file
    try:
        with open(input_filename, "wb") as f:
            f.write(await file.read())
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save input file: {e}",
        )

    # 2) Run formatter (current version only takes input & output paths)
    try:
        format_docx(input_filename, output_filename)
        # later we can extend to: format_docx(input_filename, output_filename, profileId)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Formatter crashed: {e}",
        )

    # 3) Return formatted file
    try:
        return FileResponse(
            output_filename,
            media_type=(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
            filename="formatted.docx",
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to return file: {e}",
        )
