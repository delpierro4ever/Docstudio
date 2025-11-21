# formatter-service/test_builder.py

import os
import sys

# Add the current directory to Python path
sys.path.append(os.path.dirname(__file__))

from formatting import build_docx_from_structure

def test_builder():
    print("🧪 Testing Document Builder...")
    
    try:
        # Create sample structured data (simulating LLM output)
        sample_structured_doc = {
            "meta": {
                "title": "Design and Implementation of Smart Campus System",
                "author": "John Doe", 
                "university": "University of Buea",
                "program": "Computer Engineering",
                "year": "2024"
            },
            "preliminaries": {
                "abstract": [
                    "This thesis presents the design and implementation of a smart campus system for University of Buea.",
                    "The system aims to automate various campus processes and improve efficiency."
                ],
                "dedication": ["I dedicate this work to my family."],
                "acknowledgement": ["I thank my supervisor for their guidance."]
            },
            "abbreviations": [
                {"short": "UB", "full": "University of Buea"},
                {"short": "GDP", "full": "Gross Domestic Product"}
            ],
            "chapters": [
                {
                    "number": "1",
                    "title": "Introduction",
                    "paragraphs": [
                        "This chapter introduces the research problem and objectives.",
                        "The background of the study is discussed in detail."
                    ]
                },
                {
                    "number": "2", 
                    "title": "Literature Review",
                    "paragraphs": [
                        "This chapter reviews existing literature on smart campus systems.",
                        "Various approaches and methodologies are analyzed."
                    ]
                }
            ],
            "references": [
                "Author A. (2020). Smart Campus Systems. Journal of Computing.",
                "Author B. (2021). IoT in Education. International Conference."
            ],
            "appendices": [
                {
                    "label": "Appendix A",
                    "title": "Survey Questionnaire", 
                    "content": ["The survey questions used in this research..."]
                }
            ]
        }
        
        print("1. Testing builder with sample structured data...")
        doc = build_docx_from_structure(sample_structured_doc)
        
        print(f"   ✅ Document created successfully")
        print(f"   ✅ Number of paragraphs: {len(doc.paragraphs)}")
        
        # Check if key sections were created
        paragraph_texts = [p.text for p in doc.paragraphs]
        
        # Check for title
        has_title = any("SMART CAMPUS SYSTEM" in text.upper() for text in paragraph_texts)
        print(f"   ✅ Title page created: {has_title}")
        
        # Check for abstract
        has_abstract = any("ABSTRACT" in text.upper() for text in paragraph_texts)
        print(f"   ✅ Abstract section: {has_abstract}")
        
        # Check for TOC
        has_toc = any("TABLE OF CONTENTS" in text.upper() for text in paragraph_texts)
        print(f"   ✅ Table of Contents: {has_toc}")
        
        # Check for chapters
        has_chapters = any("CHAPTER 1" in text.upper() for text in paragraph_texts)
        print(f"   ✅ Chapters created: {has_chapters}")
        
        # Check for references
        has_references = any("REFERENCES" in text.upper() for text in paragraph_texts)
        print(f"   ✅ References section: {has_references}")
        
        # Check for abbreviations
        has_abbreviations = any("ABBREVIATIONS" in text.upper() for text in paragraph_texts)
        print(f"   ✅ Abbreviations section: {has_abbreviations}")
        
        # Save the document for manual inspection
        output_path = "test_output.docx"
        doc.save(output_path)
        print(f"   📄 Document saved as: {output_path}")
        
        print("\n🎉 Builder test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Builder test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_builder()