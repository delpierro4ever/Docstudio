import os
import json
import google.generativeai as genai
from openai import OpenAI
from app.schemas.thesis_structure import ThesisStructure
from dotenv import load_dotenv

load_dotenv()

# Support both keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("LLM_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Default to openai if key is present, otherwise gemini, otherwise mock
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai" if OPENAI_API_KEY else "gemini")

EXTRACTION_PROMPT = """
You are an expert academic document analyzer.
Your task is to analyze the structure of a Thesis/Report from a stream of paragraph metadata.

Identify the following key distinct sections (Anchors) by their paragraph index (idx):

PRELIMINARY SECTIONS (Before Main Content):
- Cover Page (Start) - Usually index 0
- Title Page - May contain university name, degree, student name
- Declaration/Certification - Statement of originality, may be titled "Declaration" or "Certification"
- Dedication - Short dedication text, usually titled "Dedication"
- Acknowledgement/Acknowledgements - Gratitude section, titled "Acknowledgement" or "Acknowledgements"
- Abstract - Summary of the work, titled "Abstract"
- Table of Contents (if present) - May be auto-generated or placeholder
- List of Figures (if present) - May be auto-generated or placeholder
- List of Tables (if present) - May be auto-generated or placeholder
- Abbreviations - List of acronyms and their meanings, may be titled "List of Abbreviations" or "Abbreviations"

MAIN CONTENT:
- Main Content Start (CRITICAL: Usually "Chapter 1", "CHAPTER ONE", "Introduction", or the first numeric chapter).
  This is the MOST IMPORTANT anchor. It marks the transition from preliminaries to main body.

BACK MATTER:
- References - Bibliography section, titled "References" or "Bibliography"
- Appendices - Additional materials, titled "Appendix A", "Appendix B", etc.

INPUT: A JSON list of paragraph metadata with fields: idx, text, is_empty, approx_heading_score, etc.
OUTPUT: A strictly valid JSON object conforming to the ThesisStructure schema.

RULES:
1. 'main_content_start_idx' must point to the EXACT paragraph where Chapter 1 starts (look for "CHAPTER 1", "CHAPTER ONE", "Chapter 1:", etc.)
2. If a section is missing, set its index to null.
3. IGNORE paragraphs where is_empty is true - they are spacing/formatting and don't represent sections.
4. For preliminary sections, look for paragraphs with high approx_heading_score and matching keywords.
5. 'section_order' list should reflect the detected logical order of sections found in the document.
6. Be precise with indices - each index should point to the heading/title of that section, not content below it.
7. Certification and Declaration are often the same section - use declaration_idx for either.
8. The idx values correspond EXACTLY to paragraph positions in the document - do not adjust or offset them.
"""

def analyze_structure_with_llm(paragraph_stream) -> ThesisStructure:
    print(f"\n[LLM] Starting structural analysis")
    print(f"[LLM] Provider: {LLM_PROVIDER}")
    print(f"[LLM] Paragraph stream size: {len(paragraph_stream)} items")
    
    try:
        if LLM_PROVIDER == "openai":
            if not OPENAI_API_KEY:
                print("[LLM] WARNING: No OPENAI_API_KEY found. Using Mock response.")
                return _mock_response(paragraph_stream)
            
            print(f"[LLM] OpenAI API key found (length: {len(OPENAI_API_KEY)})")
            print(f"[LLM] Calling OpenAI API...")
            result = _call_openai(paragraph_stream)
            print(f"[LLM] [OK] OpenAI analysis successful")
            return result
            
        elif LLM_PROVIDER == "gemini":
            if not GEMINI_API_KEY:
                print("[LLM] WARNING: No GEMINI_API_KEY found. Using Mock response.")
                return _mock_response(paragraph_stream)
            
            print(f"[LLM] Gemini API key found")
            print(f"[LLM] Calling Gemini API...")
            result = _call_gemini(paragraph_stream)
            print(f"[LLM] [OK] Gemini analysis successful")
            return result
            
        else:
            raise ValueError(f"Provider {LLM_PROVIDER} not implemented yet.")
            
    except Exception as e:
        print(f"[LLM] [ERROR] {type(e).__name__}: {str(e)}")
        print(f"[LLM] Falling back to mock response for stability")
        # Fallback to mock on failure for stability during dev
        return _mock_response(paragraph_stream)

def _call_gemini(stream):
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Compress stream for context window if needed (though Flash has 1M)
    prompt = f"{EXTRACTION_PROMPT}\n\nDATA:\n{json.dumps(stream, indent=None)}"
    
    # Enforce JSON mode
    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    
    # Parse
    return ThesisStructure.model_validate_json(response.text)

def _normalize_llm_response(data: dict) -> dict:
    """
    Normalize inconsistencies in LLM JSON responses before Pydantic validation.
    Handles common issues like wrong field names, wrong types, etc.
    """
    # 1. Normalize doc_type
    if 'doc_type' in data:
        dt = data['doc_type'].lower().strip()
        if 'thesis' in dt and 'report' in dt:
            data['doc_type'] = 'report'
        elif 'thesis' in dt:
            data['doc_type'] = 'thesis'
        elif 'proposal' in dt:
            data['doc_type'] = 'proposal'
        elif dt not in ('thesis', 'report', 'proposal'):
            data['doc_type'] = 'report'  # safe default

    # 2. Normalize anchors
    if 'anchors' in data and isinstance(data['anchors'], dict):
        anchors = data['anchors']
        # Alias cover_page_idx -> cover_start_idx
        if 'cover_start_idx' not in anchors and 'cover_page_idx' in anchors:
            anchors['cover_start_idx'] = anchors.pop('cover_page_idx')
        # Default cover_start_idx to 0 if missing or None
        if anchors.get('cover_start_idx') is None:
            anchors['cover_start_idx'] = 0
        # Alias appendices_idx -> appendix_idx
        if 'appendix_idx' not in anchors and 'appendices_idx' in anchors:
            anchors['appendix_idx'] = anchors.pop('appendices_idx')
        # Remove extra keys not in our schema
        valid_keys = {
            'cover_start_idx', 'title_page_idx', 'declaration_idx',
            'dedication_idx', 'acknowledgement_idx', 'abstract_idx',
            'toc_idx', 'lof_idx', 'lot_idx', 'abbreviations_idx',
            'main_content_start_idx', 'references_idx', 'appendix_idx'
        }
        data['anchors'] = {k: v for k, v in anchors.items() if k in valid_keys}

    # 3. Normalize chapter_map
    if 'chapter_map' in data:
        cm = data['chapter_map']
        # Case A: dict like {"Chapter 1": 6, "Chapter 2": 28}
        if isinstance(cm, dict):
            chapter_list = []
            for key, val in cm.items():
                import re
                num_match = re.search(r'\d+', str(key))
                chapter_no = int(num_match.group()) if num_match else 1
                start_idx = val if isinstance(val, int) else 0
                chapter_list.append({
                    'chapter_no': chapter_no,
                    'start_idx': start_idx,
                    'end_idx': None,
                    'title': str(key)
                })
            data['chapter_map'] = chapter_list
        # Case B: list of dicts with non-standard keys
        elif isinstance(cm, list):
            normalized = []
            for item in cm:
                if isinstance(item, dict):
                    norm = {}
                    # chapter_no from chapter_index or chapter_no
                    norm['chapter_no'] = item.get('chapter_no', item.get('chapter_index', 1))
                    # start_idx from start_idx or start_paragraph_idx
                    norm['start_idx'] = item.get('start_idx', item.get('start_paragraph_idx', 0))
                    norm['end_idx'] = item.get('end_idx', item.get('end_paragraph_idx', None))
                    norm['title'] = item.get('title', f"Chapter {norm['chapter_no']}")
                    normalized.append(norm)
                else:
                    normalized.append(item)
            data['chapter_map'] = normalized

    # 4. Normalize notes (string -> list, None/dict -> empty list)
    if data.get('notes') is None or isinstance(data.get('notes'), dict):
        data['notes'] = []
    elif isinstance(data['notes'], str):
        data['notes'] = [data['notes']]

    # 5. Ensure required fields have defaults
    if 'confidence' not in data:
        data['confidence'] = 0.7
    if 'section_order' not in data:
        data['section_order'] = []
    if 'chapter_map' not in data:
        data['chapter_map'] = []
    if not data.get('caption_rules'):
        data['caption_rules'] = {
            'figure_caption_prefix': 'Figure',
            'table_caption_prefix': 'Table'
        }

    return data


def _call_openai(stream):
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)

        prompt = f"{EXTRACTION_PROMPT}\n\nDATA:\n{json.dumps(stream, indent=None)}"
        print(f"[LLM/OpenAI] Prompt length: {len(prompt)} characters")

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant designed to output JSON. Return a flat JSON object with keys: doc_type, confidence, anchors, section_order, chapter_map, caption_rules, notes. Do NOT wrap in a parent key."},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" }
        )

        content = response.choices[0].message.content
        print(f"[LLM/OpenAI] Response received, length: {len(content) if content else 0} characters")

        parsed = json.loads(content)

        # Unwrap if nested in a single parent key
        if len(parsed) == 1:
            key = list(parsed.keys())[0]
            inner = parsed[key]
            if isinstance(inner, dict) and ('anchors' in inner or 'doc_type' in inner):
                parsed = inner

        # Normalize the response to fix common LLM inconsistencies
        parsed = _normalize_llm_response(parsed)

        result = ThesisStructure.model_validate(parsed)
        print(f"[LLM/OpenAI] Successfully parsed LLM response")
        return result
    except Exception as e:
        print(f"[LLM/OpenAI] API call failed: {type(e).__name__}: {str(e)}")
        raise

def _mock_response(stream):
    """
    Heuristic fallback for when LLM fails.
    Detects preliminary sections and main content start using keyword matching.
    """
    
    main_start = None
    abstract = None
    toc = None
    declaration = None
    dedication = None
    acknowledgement = None
    abbreviations = None
    
    for item in stream:
        # Skip empty paragraphs
        if item.get("is_empty", False):
            continue
            
        txt = item["text"].upper()
        score = item.get("approx_heading_score", 0)
        
        # Main content detection (highest priority)
        # Look for various chapter patterns: "CHAPTER 1", "Chapter 1:", "CHAPTER ONE", etc.
        if main_start is None:
            if "CHAPTER 1" in txt or "CHAPTER ONE" in txt or "CHAPTER I" in txt:
                main_start = item["idx"]
                print(f"[Mock] Found Chapter 1 at index {item['idx']}: {item['text'][:50]}")
        
        # Preliminary sections
        if ("ABSTRACT" in txt) and score > 0.3:
            if abstract is None:
                abstract = item["idx"]
        
        if ("CERTIFICATION" in txt or "DECLARATION" in txt) and score > 0.3:
            if declaration is None:
                declaration = item["idx"]
                
        if "DEDICATION" in txt and score > 0.3:
            if dedication is None:
                dedication = item["idx"]
                
        if ("ACKNOWLEDGEMENT" in txt or "ACKNOWLEDGMENT" in txt) and score > 0.3:
            if acknowledgement is None:
                acknowledgement = item["idx"]
            
        if "TABLE OF CONTENTS" in txt:
            if toc is None:
                toc = item["idx"]
        
        if ("ABBREVIATION" in txt or "LIST OF ABBREVIATION" in txt) and score > 0.3:
            if abbreviations is None:
                abbreviations = item["idx"]
    
    # If we still haven't found main content, default to 0
    if main_start is None:
        main_start = 0
        print(f"[Mock] WARNING: Could not find Chapter 1, defaulting to index 0")
    
    print(f"[Mock] Detected main_content_start_idx: {main_start}")
    print(f"[Mock] Detected declaration_idx: {declaration}")
    print(f"[Mock] Detected dedication_idx: {dedication}")
    print(f"[Mock] Detected acknowledgement_idx: {acknowledgement}")
    print(f"[Mock] Detected abstract_idx: {abstract}")
    print(f"[Mock] Detected abbreviations_idx: {abbreviations}")
            
    return ThesisStructure(
        doc_type="report",
        confidence=0.5,
        anchors={
            "cover_start_idx": 0,
            "title_page_idx": None,
            "declaration_idx": declaration,
            "dedication_idx": dedication,
            "acknowledgement_idx": acknowledgement,
            "abstract_idx": abstract,
            "toc_idx": toc,
            "lof_idx": None,
            "lot_idx": None,
            "abbreviations_idx": abbreviations,
            "main_content_start_idx": main_start,
            "references_idx": None,
            "appendix_idx": None
        },
        section_order=["COVER", "DECLARATION", "DEDICATION", "ACKNOWLEDGEMENT", "ABSTRACT", "TOC", "ABBREVIATIONS", "CHAPTERS"],
        chapter_map=[],
        caption_rules={"figure_caption_prefix": "Figure", "table_caption_prefix": "Table"},
        notes=["Generated by Mock Fallback with enhanced detection"]
    )
