from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import Response, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io
import os
import uuid
import datetime
from typing import Dict, Any
from docx import Document

# ... imports ...
from app.extraction.doc_parser import extract_paragraph_stream
from app.intelligence.llm_client import analyze_structure_with_llm
from app.formatting.rebuilder import rebuild_document
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Academic Thesis Formatter", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for MVP dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage Setup
STORAGE_DIR = "storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

# In-memory Job Store (MVP)
JOBS: Dict[str, Dict[str, Any]] = {}

def process_document_task(job_id: str, file_path: str):
    import traceback
    try:
        print(f"\n{'='*60}")
        print(f"[Job {job_id}] Starting document processing")
        print(f"[Job {job_id}] Input file: {file_path}")
        print(f"{'='*60}\n")
        
        # Load Doc
        print(f"[Job {job_id}] Loading document...")
        doc = Document(file_path)
        print(f"[Job {job_id}] Document loaded successfully. Paragraphs: {len(doc.paragraphs)}")
        
        # STAGE A: Extraction & Intelligence
        print(f"[Job {job_id}] STAGE A: Extraction & Intelligence")
        print(f"[Job {job_id}] Extracting paragraph stream...")
        stream = extract_paragraph_stream(doc)
        print(f"[Job {job_id}] Extracted {len(stream)} paragraphs")
        
        print(f"[Job {job_id}] Calling LLM for structural analysis...")
        metadata = analyze_structure_with_llm(stream)
        print(f"[Job {job_id}] LLM analysis complete!")
        print(f"[Job {job_id}] - Document type: {metadata.doc_type}")
        print(f"[Job {job_id}] - Confidence: {metadata.confidence}")
        print(f"[Job {job_id}] - Main content starts at index: {metadata.anchors.main_content_start_idx}")
        
        # STAGE B: Deterministic Rebuild
        print(f"\n[Job {job_id}] STAGE B: Deterministic Rebuild")
        print(f"[Job {job_id}] Rebuilding document with formatting rules...")
        new_doc = rebuild_document(doc, metadata)
        print(f"[Job {job_id}] Document rebuilt successfully")
        
        # Save
        out_path = os.path.join(STORAGE_DIR, f"{job_id}_formatted.docx")
        print(f"[Job {job_id}] Saving formatted document to: {out_path}")
        new_doc.save(out_path)
        print(f"[Job {job_id}] Document saved successfully")
        
        JOBS[job_id]["status"] = "done"
        JOBS[job_id]["outputPath"] = out_path
        JOBS[job_id]["updatedAt"] = datetime.datetime.now().isoformat()
        # Store metadata for debug/frontend
        JOBS[job_id]["metadata"] = metadata.dict()
        
        print(f"\n{'='*60}")
        print(f"[Job {job_id}] ✓ Processing completed successfully!")
        print(f"{'='*60}\n")
        
    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        print(f"\n{'='*60}")
        print(f"[Job {job_id}] ✗ ERROR during processing")
        print(f"[Job {job_id}] Error type: {type(e).__name__}")
        print(f"[Job {job_id}] Error message: {error_msg}")
        print(f"[Job {job_id}] Full traceback:")
        print(error_trace)
        print(f"{'='*60}\n")
        
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["errorMessage"] = error_msg
        JOBS[job_id]["updatedAt"] = datetime.datetime.now().isoformat()

@app.get("/profiles")
def get_profiles():
    return [
        {
            "id": "standard",
            "name": "Academic Standard (Times New Roman 12pt)",
            "description": "Strict academic formatting with Roman prelims and Arabic body."
        }
    ]

@app.post("/documents")
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    documentType: str = Form("report"),
    profileId: str = Form("standard")
):
    job_id = str(uuid.uuid4())
    filename = f"{job_id}_input.docx"
    file_path = os.path.join(STORAGE_DIR, filename)
    
    # Save input
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    # Create Job Record
    job = {
        "id": job_id,
        "status": "processing",
        "documentType": documentType,
        "profileId": profileId,
        "isFree": True,
        "inputPath": file_path,
        "createdAt": datetime.datetime.now().isoformat(),
        "updatedAt": datetime.datetime.now().isoformat()
    }
    JOBS[job_id] = job
    
    # Trigger Processing
    background_tasks.add_task(process_document_task, job_id, file_path)
    
    return {"message": "Job created", "job": job}

@app.get("/documents/{job_id}")
def get_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return JOBS[job_id]

@app.get("/documents/{job_id}/download")
def download_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = JOBS[job_id]
    if job["status"] != "done" or "outputPath" not in job:
        raise HTTPException(status_code=400, detail="Document not ready")
        
    return FileResponse(
        job["outputPath"], 
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"{job['documentType']}-{job_id}.docx"
    )

@app.get("/documents/{job_id}/preview")
def get_preview(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # MVP: No HTML preview generation yet
    return {"previewHtml": "<div style='text-align: center; padding: 20px;'><h3>Preview Not Available</h3><p>Please download the document to view changes in Word.</p></div>"}

@app.post("/documents/{job_id}/reformat")
def reformat_job(job_id: str, background_tasks: BackgroundTasks):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = JOBS[job_id]
    job["status"] = "processing"
    
    # Re-run processing
    background_tasks.add_task(process_document_task, job_id, job["inputPath"])
    
    return {"message": "Reformatting started", "job": job}


# Legacy direct endpoint (kept for backward compatibility if needed, but updated logic)
@app.post("/format-doc")
async def format_document_direct(file: UploadFile = File(...)):
    # ... legacy stream implementation ...
    return {"error": "Use /documents for full features"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
