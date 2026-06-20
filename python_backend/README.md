# Academic Thesis/Report Formatter MVP

## Overview
This is a FastAPI-based service that accepts a raw `.docx` file and applies strict academic formatting, including:
- Consistent Fonts (Times New Roman 12pt).
- Table of Contents (TOC), List of Figures (LOF), List of Tables (LOT) insertion.
- Correct Roman (prelims) and Arabic (body) page numbering.

## Setup
1. **Install Dependencies**:
   ```bash
   cd python_backend
   pip install -r requirements.txt
   ```

2. **Run the API**:
   ```bash
   python -m uvicorn app.main:app --reload
   ```
   The API will be available at `http://localhost:8000`.

## Usage
**Endpoint**: `POST /format-doc`
- Upload a `.docx` file.
- Receives a formatted `.docx` file.

## Critical Note on Table of Contents
Because this tool performs formatting server-side using `python-docx`, the Table of Contents fields are **inserted but not calculated**. 

**Action Required**:
1. Open the downloaded document in Microsoft Word.
2. Select the Table of Contents (or press `Ctrl+A` to select all).
3. Right-click and choose **Update Field** -> **Update entire table**.
4. Repeat for List of Figures and List of Tables if necessary.

## Logic
- **Structure Detection**: Finds "Chapter 1" or "Introduction" to separate Preliminaries from Body.
- **Section Breaks**: Inserts a "Next Page" Section Break before Chapter 1 to restart page numbering.
- **Ordering**: Inserts TOC/LOF/LOT immediately before Chapter 1.
