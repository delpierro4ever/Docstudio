# formatter-service/formatting/llm_client.py

import json
import os
import requests
import re
from typing import Dict, Any, Optional
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

class LLMStructureClient:
    """Client for calling LLM API to structure document content."""
    
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.base_url = base_url or os.getenv("LLM_API_URL", "https://openrouter.ai/api/v1/chat/completions")
        
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not found in environment variables or passed as argument")
            
        logger.info(f"LLM Client initialized with base URL: {self.base_url}")
    
    def structure_document(self, extracted: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call LLM to structure the extracted document content.
        
        Args:
            extracted: Output from extract_for_model()
            
        Returns:
            Structured JSON document following the schema
        """
        logger.info("Starting document structuring with LLM...")
        
        try:
            prompt = self._build_prompt(extracted)
            response = self._call_llm_api(prompt)
            structured_doc = self._parse_response(response)
            logger.info("Document structuring completed successfully")
            return structured_doc
        except Exception as e:
            logger.error(f"LLM structuring failed: {e}")
            logger.info("Using fallback structure")
            return self._create_fallback_structure(extracted)
    
    def _build_prompt(self, extracted: Dict[str, Any]) -> str:
        """Build the LLM prompt with extracted content."""
        # Truncate very long documents to avoid token limits
        truncated_extracted = self._truncate_extracted_data(extracted)
        
        prompt = f"""You are DocStudio, a document structuring assistant for University of Buea. Your task is to analyze a university thesis/document and restructure it into a clean, standardized JSON format.

# EXTRACTED DOCUMENT CONTENT:
{json.dumps(truncated_extracted, indent=2)}

# CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON matching the exact schema below - no other text
2. Preserve ALL original content exactly - do not modify, add, or remove any text
3. Classify content into appropriate sections based on context, formatting, and heading candidates
4. Use hierarchical numbering for chapters (1, 1.1, 1.1.1, etc.)
5. Place tables and figures in their logical chapter positions

# UNIVERSITY OF BUEA STRUCTURE:
- PRELIMINARIES: Dedication, Acknowledgement, Abstract, Table of Contents, List of Tables, List of Figures
- MAIN CHAPTERS: Introduction, Literature Review, Methodology, Results, Discussion, Conclusion
- END MATTER: References, Appendices

# JSON SCHEMA:
{self._get_json_schema()}

# CONTENT PLACEMENT RULES:
- If text looks like dedication (short, personal), place in preliminaries.dedication
- If text thanks people/institutions, place in preliminaries.acknowledgement  
- If text summarizes the work, place in preliminaries.abstract
- Use "is_heading_candidate": true and formatting clues to identify chapter titles
- Tables/figures should be placed in the chapter where they logically belong
- References should be collected at the end

Output ONLY the JSON object, no other text or explanations:"""
        
        return prompt
    
    def _truncate_extracted_data(self, extracted: Dict[str, Any]) -> Dict[str, Any]:
        """Truncate very long documents to avoid token limits."""
        max_paragraphs = 1000
        max_tables = 50
        
        truncated = extracted.copy()
        
        if len(extracted["paragraphs"]) > max_paragraphs:
            logger.warning(f"Truncating paragraphs from {len(extracted['paragraphs'])} to {max_paragraphs}")
            truncated["paragraphs"] = extracted["paragraphs"][:max_paragraphs]
            
        if len(extracted["tables"]) > max_tables:
            logger.warning(f"Truncating tables from {len(extracted['tables'])} to {max_tables}")
            truncated["tables"] = extracted["tables"][:max_tables]
            
        return truncated
    
    def _get_json_schema(self) -> str:
        """Return the JSON schema description for the LLM."""
        return '''
{
  "meta": {
    "title": "string (extract from document)",
    "author": "string (extract from document)", 
    "university": "University of Buea",
    "program": "string (extract if found)",
    "year": "string (extract if found)"
  },
  "preliminaries": {
    "dedication": ["string array - preserve exact text"],
    "acknowledgement": ["string array - preserve exact text"], 
    "abstract": ["string array - preserve exact text"],
    "table_of_contents": ["string array - preserve exact text"],
    "list_of_tables": ["string array - preserve exact text"],
    "list_of_figures": ["string array - preserve exact text"]
  },
  "abbreviations": [
    {
      "short": "string",
      "full": "string"
    }
  ],
  "chapters": [
    {
      "number": "string (e.g., '1', '2.1')",
      "title": "string",
      "paragraphs": ["string array - preserve exact text in order"],
      "subsections": [
        {
          "number": "string",
          "title": "string", 
          "paragraphs": ["string array - preserve exact text"]
        }
      ],
      "tables": [
        {
          "label": "string (e.g., 'Table 1.1')",
          "title": "string",
          "content": "string (from extracted table text)"
        }
      ],
      "figures": [
        {
          "label": "string (e.g., 'Figure 1.1')", 
          "title": "string",
          "description": "string"
        }
      ]
    }
  ],
  "references": ["string array - preserve exact text"],
  "appendices": [
    {
      "label": "string (e.g., 'Appendix A')",
      "title": "string",
      "content": ["string array - preserve exact text"]
    }
  ]
}
'''
    
    def _call_llm_api(self, prompt: str) -> str:
        """Call the LLM API and return the response text."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://docstudio.com",  # Required by OpenRouter
            "X-Title": "DocStudio Formatter"  # Optional but recommended
        }
        
        # Using powerful models - ordered by capability (most powerful first)
        powerful_models = [
            "anthropic/claude-3-opus",  # Most powerful, most expensive
            "anthropic/claude-3-sonnet", # Very powerful, good balance
            "openai/gpt-4",             # GPT-4 via OpenRouter
            "google/gemini-pro"         # Alternative powerful model
        ]
        
        # Try models in order until one works
        for model in powerful_models:
            try:
                return self._call_specific_model(model, prompt, headers)
            except Exception as e:
                logger.warning(f"Model {model} failed: {e}. Trying next model...")
                continue
                
        raise Exception("All models failed. Please check your API key and connectivity.")
    
    def _call_specific_model(self, model: str, prompt: str, headers: dict) -> str:
        """Call a specific model with the given prompt."""
        logger.info(f"Attempting to call model: {model}")
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a precise document structuring assistant. You MUST output only valid JSON without any additional text, explanations, or markdown formatting."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            "temperature": 0.1,  # Low temperature for consistent JSON
            "max_tokens": 8000,  # Increased for large documents
            "response_format": { "type": "json_object" }
        }
        
        response = requests.post(self.base_url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        return result["choices"][0]["message"]["content"]
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse the LLM response into a structured dictionary."""
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            # Try to extract JSON from malformed response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass
            raise ValueError(f"LLM returned invalid JSON: {response_text[:500]}...")
    
    def _create_fallback_structure(self, extracted: Dict[str, Any]) -> Dict[str, Any]:
        """Create a basic fallback structure if LLM fails."""
        paragraphs = [p["text"] for p in extracted["paragraphs"]]
        
        return {
            "meta": {
                "title": "Document",
                "author": "Unknown",
                "university": "University of Buea",
                "program": "Unknown",
                "year": ""
            },
            "preliminaries": {
                "dedication": [],
                "acknowledgement": [],
                "abstract": paragraphs[:3] if len(paragraphs) > 3 else paragraphs,
                "table_of_contents": [],
                "list_of_tables": [],
                "list_of_figures": []
            },
            "abbreviations": [],
            "chapters": [
                {
                    "number": "1",
                    "title": "Main Content",
                    "paragraphs": paragraphs,
                    "subsections": [],
                    "tables": [],
                    "figures": []
                }
            ],
            "references": [],
            "appendices": []
        }


# Convenience function
def structure_document(extracted: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function to structure document using LLM."""
    client = LLMStructureClient()
    return client.structure_document(extracted)


# Test function
def test_llm_client():
    """Test the LLM client with sample data."""
    print("🧪 Testing LLM Client...")
    
    try:
        # Sample test data
        test_data = {
            "paragraphs": [
                {
                    "index": 0,
                    "text": "DESIGN AND IMPLEMENTATION OF A SMART CAMPUS SYSTEM",
                    "bold": True,
                    "italic": False,
                    "centered": True,
                    "font_size": 16.0,
                    "is_heading_candidate": True
                },
                {
                    "index": 1, 
                    "text": "by John Doe",
                    "bold": False,
                    "italic": False,
                    "centered": True,
                    "font_size": 12.0,
                    "is_heading_candidate": False
                },
                {
                    "index": 2,
                    "text": "CHAPTER ONE",
                    "bold": True,
                    "italic": False,
                    "centered": True,
                    "font_size": 14.0,
                    "is_heading_candidate": True
                },
                {
                    "index": 3,
                    "text": "INTRODUCTION",
                    "bold": True,
                    "italic": False,
                    "centered": True,
                    "font_size": 14.0,
                    "is_heading_candidate": True
                },
                {
                    "index": 4,
                    "text": "This thesis presents the design and implementation of a smart campus system for University of Buea.",
                    "bold": False,
                    "italic": False,
                    "centered": False,
                    "font_size": 12.0,
                    "is_heading_candidate": False
                }
            ],
            "tables": [
                {
                    "index": 0,
                    "text": "Parameter | Value | Unit\nTemperature | 25 | °C\nHumidity | 60 | %",
                    "row_count": 3,
                    "column_count": 3
                }
            ],
            "images": []
        }
        
        client = LLMStructureClient()
        print("✅ LLM Client initialized successfully")
        
        result = client.structure_document(test_data)
        print("✅ Document structuring completed")
        print(f"✅ Generated structure with {len(result.get('chapters', []))} chapters")
        print(f"✅ Meta title: {result.get('meta', {}).get('title', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


if __name__ == "__main__":
    # Run test when file is executed directly
    test_llm_client()