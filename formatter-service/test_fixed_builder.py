# formatter-service/test_fixed_builder.py

import os
import sys
sys.path.append(os.path.dirname(__file__))

try:
    from formatting import build_docx_from_structure
    print("✅ Builder import successful!")
    
    # Quick test
    sample_data = {
        "meta": {"title": "Test Document"},
        "preliminaries": {"abstract": ["Test abstract"]},
        "chapters": [{"number": "1", "title": "Test", "paragraphs": ["Hello world"]}]
    }
    
    doc = build_docx_from_structure(sample_data)
    doc.save("fixed_test.docx")
    print("✅ Builder works! Check fixed_test.docx")
    
except Exception as e:
    print(f"❌ Import failed: {e}")
    import traceback
    traceback.print_exc()