from docx import Document
from app.core.analyzer import analyze_document
from app.core.structure_builder import rebuild_preliminaries
from app.core.sections import apply_section_breaks_and_numbering
import sys

def run_pipeline(input_path, output_path):
    print(f"Loading {input_path}...")
    doc = Document(input_path)
    
    print("Analyzing structure...")
    structure = analyze_document(doc)
    print(f"  Main Content starts at: {structure.main_content_start_index}")
    
    print("Rebuilding preliminaries (Inserting TOC/LOF/LOT)...")
    rebuild_preliminaries(doc, structure)
    
    # Note: re-analyze or just trust indices?
    # Inserting paragraphs shifts indices. 
    # `rebuild_preliminaries` added paragraphs BEFORE `main_content_start_index`.
    # So the OLD `main_content_start_index` is now shifted by N paragraphs.
    # However, `apply_section_breaks_and_numbering` relies on the index of Chapter 1.
    # We MUST re-analyze OR return the new offset from rebuild.
    
    # Let's simple re-analyze to be safe and robust.
    print("Re-analyzing to find new Chapter 1 index...")
    structure_v2 = analyze_document(doc)
    print(f"  New Main Content starts at: {structure_v2.main_content_start_index}")
    
    print("Applying section breaks and numbering...")
    apply_section_breaks_and_numbering(doc, structure_v2.main_content_start_index)
    
    print(f"Saving to {output_path}...")
    doc.save(output_path)
    print("Done.")

if __name__ == "__main__":
    run_pipeline("synthetic_test.docx", "synthetic_formatted.docx")
