# DocStudio — Student Report Formatter

DocStudio automatically reformats messy student reports/theses (.docx)
to University of Buea academic standards.

## What it does

- Upload a .docx report, get back a formatted .docx
- Separates preliminaries and main content with a real section break
  - Roman page numbers (i, ii, iii) for prelims, Arabic restarting at 1 for the main body
- Applies fonts and spacing from a selectable profile:
  - `ub-v1` — Times New Roman 12pt body, 1.5 spacing, 13pt subheadings (default)
  - `ub-v2` — Times New Roman 14pt body, double spacing, 15pt subheadings
- Generates **Table of Contents**, **List of Tables**, **List of Figures**
  (real Word fields, results pre-baked via headless LibreOffice and set to
  refresh on open in Word)
- Rewrites table/figure captions with proper `SEQ` fields
  (`Table 2.1: …`) so the lists stay correct when the document changes
- Generates a **List of Abbreviations** (acronyms + detected expansions)
- Optional LLM **grammar/spelling pass** over body paragraphs
  (correction-only; never paraphrases)
- Formats the references section with hanging indents

## Architecture

```
frontend (Next.js, :3000)
   → backend (Express gateway, :4000)      — auth, jobs, pricing, profiles
       → formatter-service (FastAPI, :8082) — parse → LLM classify → format
```

`python_backend/` is a deprecated dead prototype — see its DEPRECATED.md.

## Running locally

```bash
# formatter-service
cd formatter-service
virtualenv .venv && .venv/bin/pip install -r requirements.txt
echo "OPENROUTER_API_KEY=sk-..." > .env      # needed for classification + grammar pass
.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8082

# backend gateway
cd backend && npm install && npm run dev     # :4000

# frontend
cd frontend && npm install && npm run dev    # :3000 (set NEXT_PUBLIC_API_BASE to override :4000)
```

Optional formatter-service environment flags:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DOCSTUDIO_BAKE_FIELDS` | `1` | Bake TOC/LOT/LOF/page-number field results via headless LibreOffice (needs `soffice` + a python with `uno`) |
| `DOCSTUDIO_PROOFREAD` | `1` | LLM grammar/spelling pass over body paragraphs |
| `LLM_MODEL` | `x-ai/grok-4.1-fast:free` | OpenRouter model for classification/proofreading |

## Tests

```bash
cd formatter-service
.venv/bin/python -m unittest discover -s tests -v
```

The suite covers the whole formatting pipeline (fields, section breaks,
page numbering, SEQ captions, abbreviations, profiles) without needing
the LLM or LibreOffice.
