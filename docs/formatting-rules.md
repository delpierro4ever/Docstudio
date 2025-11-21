# Student Report Formatter – Formatting Rules (v1)

This document defines the default formatting rules for the Student Report Formatter.

These rules are **only about structure & layout** (no grammar corrections).

---

## 1. Text Profiles (Font + Line Spacing)

We support two font-size/line-spacing profiles:

1. **Standard Profile (Default)**
   - Font family: Times New Roman
   - Font size: 12 pt
   - Line spacing: 1.5
   - Usage: Default for all reports, unless the supervisor explicitly requests otherwise.

2. **Large Profile (On Request)**
   - Font family: Times New Roman
   - Font size: 14 pt
   - Line spacing: 2.0
   - Usage: Used only when the supervisor has specified this requirement.

If no profile is specified in the input, we use the **Standard Profile**.

---

## 2. Global Layout Rules

- Text alignment: **Justified**
- Paragraph spacing:
  - Before: 0 pt
  - After: 0 pt
- First-line indent:
  - Body paragraphs: 0.5 cm (or equivalent)
  - Paragraphs immediately after headings: **no indent**
- Margins (default, can be adjusted later if needed):
  - Top: 1 inch (2.54 cm)
  - Bottom: 1 inch (2.54 cm)
  - Left: 1.25 inch (3.17 cm)
  - Right: 1 inch (2.54 cm)

---

## 3. Document Structure & Section Order

The formatter will respect this **logical order** when sections exist.  
It will **not invent missing sections**; it only formats what is present.

### 3.1 Preliminary Pages (Prelims)

These come before Chapter 1 and use **Roman numeral page numbering**.

Typical order:

1. Title Page  
2. Declaration / Certification  
3. Dedication (optional)  
4. Acknowledgements (optional)  
5. Abstract  
6. Table of Contents (TOC)  
7. List of Tables (LOT) – only if tables exist  
8. List of Figures (LOF) – only if figures exist  
9. List of Abbreviations / Acronyms (optional)

### 3.2 Main Body

These use **Arabic page numbering**, starting from **1 at Chapter 1**.

1. Chapter 1 – Introduction  
2. Chapter 2 – Literature Review (or related chapter)  
3. Chapter 3 – Methodology  
4. Chapter 4 – Results / Findings  
5. Chapter 5 – Discussion / Conclusion / Recommendations  
6. Any additional chapters as provided

### 3.3 Back Matter

After the last chapter:

1. References / Bibliography  
2. Appendices (Appendix A, B, C, etc.)

---

## 4. Page Numbering Rules

### 4.1 Preliminaries

- Numbering format: **lowercase Roman numerals** (`i, ii, iii, iv, ...`)
- Start at: `i`
- The **Title Page** is counted as page `i` but the page number may be **hidden** on the title page.
- Page number position: **bottom center** (can be adjusted if needed)

### 4.2 Main Body

- Start a **new section** at Chapter 1.
- Numbering format: **Arabic numerals** (`1, 2, 3, ...`)
- Restart numbering at `1` on the first page of **Chapter 1**.
- Page number position: **bottom center** or **bottom right** (to be kept consistent; default = bottom center).

---

## 5. Headings & Chapters

- Chapter titles use a consistent style, e.g.:
  - `CHAPTER ONE: INTRODUCTION`
  - `CHAPTER TWO: LITERATURE REVIEW`
- Heading levels:
  - Chapter titles: Heading 1 (all caps, bold, centered)
  - Main section headings: Heading 2
  - Sub-section headings: Heading 3
- The formatter will:
  - Detect chapter headings (based on “CHAPTER 1”, “CHAPTER ONE”, etc.)
  - Assign appropriate heading styles for consistency.

---

## 6. Tables & Figures

### 6.1 Numbering

- Tables: `Table 1.1`, `Table 1.2`, … (Chapter.TableNumber)
- Figures: `Figure 1.1`, `Figure 1.2`, … (Chapter.FigureNumber)

### 6.2 Captions

- Table captions:
  - Positioned **above** the table
  - Example: `Table 3.2: Distribution of Respondents by Age`

- Figure captions:
  - Positioned **below** the figure
  - Example: `Figure 4.1: System Architecture Diagram`

### 6.3 Lists

- **List of Tables** and **List of Figures** are auto-generated from captions.
- They appear in the prelims section:
  - After Table of Contents
  - Before List of Abbreviations (if present)

---

## 7. Table of Contents (TOC)

- Automatically generated from:
  - Chapter headings (Heading 1)
  - Section headings (Heading 2)
  - (Optionally) Sub-sections (Heading 3)
- Uses:
  - Dotted leader lines (…..)
  - Right-aligned page numbers
- Placed in prelims, after Abstract.

---

## 8. List of Abbreviations

- All abbreviations detected in the report (if supplied) are placed in a **two-column table**:
  - Column 1: Abbreviation (e.g. “ICT”)
  - Column 2: Full Meaning (e.g. “Information and Communication Technology”)
- Positioned after:
  - List of Figures (if it exists)
- If the student has no abbreviations, this section is simply **omitted**.

---

## 9. References

- Section title: `REFERENCES` or `BIBLIOGRAPHY` (as found in the document).
- Placed after the last chapter and before appendices.
- For now:
  - The formatter preserves the existing reference entries.
  - It aligns text and spacing to match the global style.
- Future enhancement:
  - Enforce a specific reference style (APA, IEEE, etc.) based on configuration.

---

## 10. Appendices

- Each appendix starts on a **new page**.
- Naming:
  - `APPENDIX A: <Title>`
  - `APPENDIX B: <Title>`
- Appendices appear after References.

---

## 11. Handling Missing Sections

- The formatter **does not create new content**.
- If a section such as Abstract, List of Tables, or certain chapters is missing:
  - It is simply skipped in the ordering.
  - Existing sections are still formatted correctly according to these rules.
