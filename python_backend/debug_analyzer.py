import sys
import os

# Add local directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from docx import Document
from app.core.analyzer import analyze_document

def test_analysis(doc_path):
    print(f"Analyzing {doc_path}...")
    try:
        doc = Document(doc_path)
        structure = analyze_document(doc)
        print("Structure Found:")
        print(f"  Main Content Start Index: {structure.main_content_start_index}")
        print(f"  Cover Page Range: {structure.cover_page_range}")
        print(f"  Prelims Found: {list(structure.prelim_content.keys())}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Point to the sample doc in the root
    sample_path = "../sample.docx" 
    if len(sys.argv) > 1:
        sample_path = sys.argv[1]
        
    test_analysis(sample_path)
