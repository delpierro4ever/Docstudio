# formatter-service/app.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router

app = FastAPI(
    title="DocStudio Formatter Service",
    description="Python microservice for DOCX parsing, LLM classification, and automated formatting",
    version="1.0.0",
)

# Allow your Node backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach API router
app.include_router(api_router)


@app.get("/")
def root():
    # Health-check endpoint
    return {"message": "DocStudio Formatter Service is running"}


# Run with:
# uvicorn app:app --host 0.0.0.0 --port 8082
