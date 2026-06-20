from typing import List, Dict, Any


class LLMPromptBuilder:
    """
    Builds the system prompt + classification view for the LLM.

    Input: 	blocks[] from DOCXBlockParser
    Output: (system_prompt: str, classification_view: str)
    """

    def build_system_prompt(self) -> str:
        return """You are an academic document structure classifier.
Your task is to analyze DOCX blocks and classify each one by its academic role and metadata.

DOCUMENT BLOCKS:
- [P#] = Paragraph block with text content
- [T#] = Table block (you only see a placeholder; real table XML is preserved elsewhere)
- [F#] = Figure/Image block (you only see a placeholder; real image is preserved elsewhere)

CRITICAL RULES:
1. DO NOT rewrite or paraphrase content.
2. DO NOT invent new blocks or delete existing ones.
3. ONLY classify the role and metadata of each existing block.
4. Return STRICT JSON only, no extra commentary or markdown fences.
5. If you are unsure about a field, omit it rather than guessing wildly.

ACADEMIC ROLES:
You may assign these roles:

- "title_page"
- "abstract_heading", "abstract_paragraph"
- "table_of_contents"
- "list_of_tables", "list_of_figures"
- "chapter_heading"
- "section_heading"
- "subsection_heading"
- "body_paragraph"
- "caption"
- "table"
- "figure"
- "references_heading"
- "reference_entry"

SECTIONS:
- "prelim" 	= everything before the first real chapter (front matter)
- "main" 	= from the first real chapter heading (Chapter One / Chapter 1 / CHAPTER I, etc.) onward

CHAPTER & HEADING RULES:
- A top-level chapter heading often looks like:
  - "CHAPTER ONE: INTRODUCTION"
  - "Chapter 1: Human Psychology"
  - "CHAPTER 2"
  - "1.0 INTRODUCTION"
- Treat those as "chapter_heading" with headingLevel = 1.
- A second-level heading often looks like:
  - "1.1 Background of the Study"
  - "2.3 Data Collection"
- Treat those as "section_heading" with headingLevel = 2.
- Subsections like "1.1.1" may be "subsection_heading" with headingLevel = 3.

- The first detected chapter heading marks the transition:
  - All preceding blocks -> section = "prelim"
  - That chapter heading and everything after -> section = "main"

TABLES & FIGURES:
- A [T#] [TABLE BLOCK] line is always a table.
- A [F#] [FIGURE BLOCK] line is always a figure.
- If a table or figure has a caption-like text nearby (P#), you must link them.
- The caption paragraph itself should be classified as "caption" role.

- For the media block [T#] or [F#], use:
  - role: "table" or "figure"
  - tableNumber / figureNumber: e.g. "Table 3.1"
  - caption: short description.
  - NEW: "caption_block_id": The ID (e.g., "P15") of the paragraph that contains this caption.

REFERENCES:
- A heading like "REFERENCES" or "BIBLIOGRAPHY" at the end is "references_heading".
- Each subsequent bibliographic entry is "reference_entry" until another major section begins.

FOR EACH BLOCK:
You must map each block id (P#, T#, F#) to a JSON object with some of:
- "role": string (from roles above)
- "section": "prelim" or "main"
- "chapter": integer (1, 2, 3...) if applicable
- "headingLevel": 1, 2, or 3 for headings
- "title": heading text (for headings only)
- "tableNumber": string (for tables)
- "figureNumber": string (for figures)
- "caption": string (for captions / tables / figures)
- "caption_block_id": string (the P# of the paragraph that contains the caption text, if applicable)
- For plain body text -> at minimum: "role": "body_paragraph", "section": "prelim" or "main".

JSON OUTPUT FORMAT:
Return JSON exactly like:

{
  "blocks": {
    "P1": {
      "role": "body_paragraph",
      "section": "prelim"
    },
    "P2": {
      "role": "chapter_heading",
      "section": "main",
      "chapter": 1,
      "headingLevel": 1,
      "title": "CHAPTER ONE: INTRODUCTION"
    },
    "P3": {
      "role": "caption",
      "section": "main"
    },
    "T1": {
      "role": "table",
      "section": "main",
      "chapter": 1,
      "tableNumber": "Table 1.1",
      "caption": "Age distribution of respondents",
      "caption_block_id": "P3" 
    }
  },
  "sections": {
    "prelim_ends_before_block_id": "P2"
  }
}

IMPORTANT:
- Include a "blocks" object with one entry per block ID that you recognize.
- Include a "sections" object with "prelim_ends_before_block_id" set to the last prelim block id (or null if not sure).
"""

    def build_classification_view(self, blocks: List[Dict[str, Any]]) -> str:
        """
        Build the text-only view with placeholders for the LLM.

        Example:
            [P1] CHAPTER ONE: INTRODUCTION
            [T1] [TABLE BLOCK] Caption (if any): "Table 1.1: Age distribution"
            [F1] [FIGURE BLOCK] Caption (if any): "Figure 2.1: Conceptual framework"
        """
        lines: List[str] = []

        for block in blocks:
            block_id = block.get("id")
            block_type = block.get("type")

            if block_type == "paragraph":
                text = block.get("text", "") or ""
                # Optional truncation for extremely long paragraphs
                if len(text) > 800:
                    text = text[:800] + "... [truncated]"
                lines.append(f"[{block_id}] {text}")

            elif block_type == "table":
                caption_info = ""
                caption_guess = block.get("caption_guess")
                if caption_guess:
                    caption_info = f' Caption (if any): "{caption_guess}"'
                lines.append(f"[{block_id}] [TABLE BLOCK]{caption_info}")

            elif block_type == "image":
                caption_info = ""
                caption_guess = block.get("caption_guess")
                if caption_guess:
                    caption_info = f' Caption (if any): "{caption_guess}"'
                lines.append(f"[{block_id}] [FIGURE BLOCK]{caption_info}")

        return "\n".join(lines)