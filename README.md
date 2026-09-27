# DocStudio

DocStudio is a document formatting service built for students at the University of Buea (Cameroon). Students upload a `.docx` report or thesis and get back a properly formatted document that meets the university's academic standards — correct fonts, spacing, heading hierarchy, page numbering, and all required preliminary pages.

---

## Why it exists

Students spend hours manually fixing formatting before submission. Lecturers reject documents for trivial formatting violations. DocStudio eliminates that friction: upload a rough draft, download a submission-ready document.

The system is built to handle real student documents, which means messy input: inconsistent heading levels, missing captions, photos embedded in obscure XML formats, broken numbering, and text the LLM might misclassify. Robustness is a first-class concern — every formatting step is wrapped in a try/except or try/catch so a single bad paragraph never crashes the entire pipeline.

---

## Two formatting modes

### Full Thesis Format
For theses and formal academic reports. Runs the complete pipeline:
- LLM classifies the document structure (sections, headings, tables, figures, references)
- Generates all required preliminary pages: Table of Contents, List of Tables, List of Figures, List of Abbreviations
- Normalises table and figure captions with real Word `SEQ` fields so numbering (Table 2.3, Figure 1.1) stays correct when content moves
- Applies section breaks — roman numerals (i, ii, iii) for prelims, Arabic restarting at 1 for main content
- Applies the chosen formatting profile (font, spacing, margins, heading styles)

### Quick Print Format
For reports that just need to look clean before printing. Skips the LLM entirely and skips all preliminary pages. Applies only:
- Font family and size
- Line spacing and paragraph style
- Page margins
- Heading styles
- Simple Arabic page numbering

This mode is significantly faster and cheaper (200 FCFA vs 500+ for full format) because there is no LLM call.

---

## Architecture

```
Browser (Next.js frontend, :3000)
    │
    │  REST + multipart/form-data
    ▼
Express backend gateway (:4000)
    │  — auth (register/login/me)
    │  — job lifecycle (create, poll, download, reformat)
    │  — pricing and profile config
    │  — persists users + jobs to backend/data/*.json
    │
    │  HTTP POST multipart (file + profileId + documentType)
    ▼
FastAPI formatter-service (:8082)
    │  — parses DOCX into ordered blocks (P#, T#, F#)
    │  — calls LLM for structural classification (full mode only)
    │  — runs formatting pipeline
    │  — returns formatted DOCX bytes
```

`python_backend/` is a deprecated dead prototype — ignore it.

---

## Service breakdown

### frontend (Next.js, port 3000)

Pages:
- `/` — redirects to `/dashboard` if logged in, else `/login`
- `/login`, `/register` — email/password auth, stores `userId` in localStorage
- `/dashboard` — shows user info and quick actions
- `/upload` — mode-selection screen (Full vs Quick), then file + profile form
- `/documents` — list of the user's past jobs with download links
- `/dashboard/documents/[id]` — job detail page with download button

Auth is localStorage-based. Every API request sends `x-user-id` as a custom header. The backend validates this against its user store. There are no JWTs or sessions — this is intentional for simplicity at this stage.

Downloads use `fetch()` + `URL.createObjectURL()` rather than a plain `<a href>` link, because browsers do not send custom headers on direct navigation.

### backend (Express + TypeScript, port 4000)

The backend is a thin gateway. Its jobs:
1. Validate auth (`x-user-id` header → user lookup)
2. Handle file uploads (multer → temp file on disk)
3. Create a job record, call the formatter, save the output file, update the job
4. Serve download endpoints

**Persistence:** Users and jobs are stored in JSON files at `backend/data/users.json` and `backend/data/jobs.json`. The in-memory arrays are loaded from these files on startup and written to disk on every mutation. This is intentionally simple — no database dependency — while surviving process restarts.

**Pricing:** Defined in `backend/config/pricingRules.json`. Each document type has a base price in XAF (FCFA). The first N documents for a new user are free (`freeRemaining` counter on the user record).

**Profiles:** Defined in `backend/config/formattingRules.json`. Profiles control font, spacing, margins, heading sizes, caption styles, and which preliminary pages to generate.

### formatter-service (FastAPI + python-docx, port 8082)

The formatter is a Python microservice. Node sends it the raw upload file + `profileId` + `documentType` via multipart form. It returns the formatted DOCX as raw bytes.

#### Full pipeline (`documentType != "print_ready"`)

1. **Parse** — `docx_parser/parser.py` walks the DOCX XML and produces an ordered list of typed blocks:
   - `P#` — paragraph blocks (body text, headings, captions)
   - `T#` — table blocks
   - `F#` — image/figure blocks (detected in both DrawingML `<w:drawing>/<a:blip>` and VML `<w:pict>/<v:imagedata>` formats)

2. **LLM classify** — the block list is sent to an OpenRouter LLM (see `LLM_MODEL`), falling back to the rule-based heuristic classifier when no key is set or the LLM fails. The LLM returns a JSON structure that labels each block: its role (body, heading, caption, reference, abbreviation…), which section it belongs to (prelim vs main), and which tables/figures have captions and where.

3. **Format** — `formatting/formatter.py` orchestrates the pipeline in strict order. Ordering matters because early steps map block IDs to paragraph indices in `doc.paragraphs`, and that mapping breaks the moment any paragraph is inserted or removed:
   - `apply_basic_style` — fonts, spacing, margins, heading styles
   - `apply_headings` — applies Heading 1/2/3 styles to classified headings
   - `apply_tables_and_figures` — rewrites captions with `SEQ` fields, repositions captions (above tables, below figures), creates captions for uncaptioned figures
   - `format_references_section` — hanging-indent style for reference lists
   - *Anchor resolution* — finds the first main-content paragraph as a live object before any insertions
   - Prelim page insertion in reverse order (TOC, LOT, LOF, abbreviations), each inserted just before the anchor
   - `apply_sections` — inserts the section break at the prelim/main boundary, applies roman numbering to prelim, Arabic to main
   - `enable_update_fields_on_open` — sets a Word document flag so TOC/LOT/LOF/SEQ/PAGE fields refresh automatically when opened

#### Quick pipeline (`documentType == "print_ready"`)

Skips parsing, LLM, captions, references, and prelim pages entirely. Only runs `apply_basic_style` + `add_arabic_page_numbers` + `enable_update_fields_on_open`.

#### Key technical details

**Caption positioning with lxml:** python-docx's high-level API has no way to move an existing paragraph to a different position in the document. The solution is to drop down to the lxml XML layer and use `element.addprevious()` / `element.addnext()`, which atomically detaches and reattaches the element.

**SEQ fields:** Word's built-in caption numbering uses `{ SEQ Table \* ARABIC \s 1 }` fields. The `\s 1` switch resets the counter after each Heading 1, producing the `2.3` style chapter-relative numbering. DocStudio writes real SEQ field XML rather than plain text so:
- The List of Tables and List of Figures (`TOC \c "Table"` / `TOC \c "Figure"`) can collect captions correctly
- Numbers stay correct if the user adds or removes content after formatting

**Image detection:** Word stores embedded images in two XML formats depending on how they were inserted:
- DrawingML (modern): `<w:drawing>` → `<a:blip r:embed="rId7"/>`
- VML (legacy/older Office): `<w:pict>` → `<v:imagedata r:id="rId5"/>`

The extractor handles both by using Clark-notation namespace strings (e.g. `{urn:schemas-microsoft-com:vml}imagedata`) rather than prefix-based lookups, which avoids failures when namespace prefix maps are absent.

**LLM fallback chain:** The classifier tries models in order. If a model fails, times out, or returns JSON that is invalid or has the wrong shape, it tries the next one. If no API key is set or every model fails, `llm/heuristic_classifier.py` classifies the document with rules (`CHAPTER ONE` / `Chapter 2` / `1.0` chapter headings, `1.1` / `1.1.1` numbered headings, known prelim headings, `Table n` / `Figure n` captions, `REFERENCES`) and the pipeline carries on. The heuristic also fills in anything a partial LLM answer left out, including an invalid prelim/main boundary. **Formatting never fails just because the LLM is unavailable.**

**Malformed uploads:** Non-ZIP files (legacy `.doc`, PDF), ZIPs without `word/document.xml`, truncated or corrupt archives, and documents with no text are rejected with HTTP 422 and a readable message, which the backend and upload page pass on to the user.

**Windows encoding:** On Windows, Python's default stdout encoding is cp1252, which crashes when the LLM returns emoji or non-ASCII characters in output. The formatter is launched with `PYTHONUTF8=1` to force UTF-8 throughout.

---

## Running locally

Ports: frontend **3000**, backend **4000**, formatter-service **8082**.

```bash
# 1. Formatter service (terminal 1)
cd formatter-service
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
# Optional: an OpenRouter key enables LLM classification (heuristic otherwise)
echo "OPENROUTER_API_KEY=sk-or-v1-..." > .env
PYTHONUTF8=1 .venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8082

# 2. Backend gateway (terminal 2)
cd backend
npm ci
npm run dev    # starts on :4000

# 3. Frontend (terminal 3)
cd frontend
npm ci
npm run dev    # starts on :3000  (or: npm run build && npm start)
```

Open http://localhost:3000 in your browser. Register an account — accounts and jobs persist to `backend/data/` and survive restarts.

### Tests and output inspection

```bash
cd formatter-service
.venv/bin/pip install pytest
.venv/bin/python -m pytest -q tests          # formatter, LLM-failure, bad-JSON, malformed-DOCX tests
.venv/bin/python test_pipeline.py sample.docx out.docx ub-v1   # run the full pipeline on a file
.venv/bin/python tools/inspect_docx.py out.docx                 # sections, page numbering, headings, captions, TOC fields

cd ../backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit && npm run build
```

### Environment variables (formatter-service)

| Variable | Default | Effect |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Enables LLM classification; without it the heuristic classifier is used |
| `LLM_MODEL` | `x-ai/grok-4.1-fast:free` | Primary OpenRouter model (then `openai/gpt-4o-mini`, `openai/gpt-4.1-nano`) |
| `LLM_TIMEOUT_SECONDS` | `60` | Per-model request timeout |
| `DOCSTUDIO_BAKE_FIELDS` | `1` | Bake TOC/SEQ results via headless LibreOffice when installed; `0` to skip |
| `DOCSTUDIO_PROOFREAD` | `1` | LLM grammar/spelling pass (only runs with an API key); `0` to disable |

### Environment variables (backend)

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `4000` | Backend port |
| `FORMATTER_URL` | `http://localhost:8082` | Formatter-service base URL |
| `FORMATTER_TIMEOUT_MS` | `300000` | Max time to wait for one formatting job |

---

## Data storage layout

```
backend/
  config/
    formattingRules.json   — formatting profiles (font, spacing, heading sizes)
    pricingRules.json      — price per document type in XAF
  data/
    users.json             — registered user accounts (persisted)
    jobs.json              — formatting job records (persisted)
  uploads/
    <uuid>                 — raw uploaded .docx files (multer temp names)
    formatted/
      <job-id>.docx        — formatted output files
```

---

## Extending the project

**Add a new document type:** Add the type string to `allowedTypes` in `backend/src/routes/documents.ts`, add pricing in `pricingRules.json`, add a label to `FULL_DOC_TYPES` in `frontend/src/pages/upload.tsx`, and add a label to `docTypeLabel()` in the document viewer.

**Add a new formatting profile:** Add an entry to `backend/config/formattingRules.json` (the profile schema is defined in `formatter-service/config/profiles.py`). The new profile will appear automatically in the upload form's profile dropdown.

**Change the LLM:** Set `LLM_MODEL` in `formatter-service/.env` to any model available on OpenRouter. The classifier's prompt is in `formatter-service/llm/client.py`.

**Add a new prelim page type:** Add a key to `_GENERATED_PRELIM_ITEMS` in `formatting/formatter.py`, add the insertion logic in the loop, and add the key to the profile's `structure.order` array.
