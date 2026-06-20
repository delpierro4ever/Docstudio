"""
Simple test script to verify the backend processing pipeline works end-to-end
"""
from docx import Document
from app.extraction.doc_parser import extract_paragraph_stream
from app.intelligence.llm_client import analyze_structure_with_llm
from app.formatting.rebuilder import rebuild_document
import os

def test_pipeline():
    print("\n" + "="*60)
    print("Testing DocStudio Backend Pipeline")
    print("="*60 + "\n")
    
    # Use existing test document
    input_path = "synthetic_test.docx"
    output_path = "test_output_formatted.docx"
    
    if not os.path.exists(input_path):
        print(f"ERROR: Test file '{input_path}' not found!")
        print("Please ensure synthetic_test.docx exists in the python_backend directory")
        return False
    
    try:
        # Stage 1: Load document
        print("[1/4] Loading document...")
        doc = Document(input_path)
        print(f"      ✓ Loaded {len(doc.paragraphs)} paragraphs")
        
        # Stage 2: Extract paragraph stream
        print("\n[2/4] Extracting paragraph stream...")
        stream = extract_paragraph_stream(doc)
        print(f"      ✓ Extracted {len(stream)} paragraph metadata items")
        
        # Stage 3: LLM Analysis
        print("\n[3/4] Analyzing structure with LLM...")
        metadata = analyze_structure_with_llm(stream)
        print(f"      ✓ Analysis complete")
        print(f"      - Document type: {metadata.doc_type}")
        print(f"      - Confidence: {metadata.confidence}")
        print(f"      - Main content starts at: {metadata.anchors.main_content_start_idx}")
        
        # Stage 4: Rebuild document
        print("\n[4/4] Rebuilding document with formatting...")
        new_doc = rebuild_document(doc, metadata)
        print(f"      ✓ Document rebuilt")
        
        # Save output
        print(f"\n[SAVE] Saving to {output_path}...")
        new_doc.save(output_path)
        print(f"       ✓ Saved successfully")
        
        print("\n" + "="*60)
        print("✓ PIPELINE TEST SUCCESSFUL!")
        print("="*60 + "\n")
        return True
        
    except Exception as e:
        import traceback
        print("\n" + "="*60)
        print("✗ PIPELINE TEST FAILED!")
        print("="*60)
        print(f"\nError: {type(e).__name__}: {str(e)}")
        print("\nFull traceback:")
        print(traceback.format_exc())
        print("="*60 + "\n")
        return False

if __name__ == "__main__":
    success = test_pipeline()
    exit(0 if success else 1)
