# formatter-service/formatting/extractor_wrapper.py

from .extractor.base_extractor import DocumentExtractor

# Create singleton instance
_extractor = DocumentExtractor()

# Re-export the same functions as before
def extract_for_model(input_path: str):
    return _extractor.extract_for_model(input_path)

def extract_original_tables(input_path: str):
    return _extractor.extract_original_tables(input_path)

def extract_original_images(input_path: str):
    return _extractor.extract_original_images(input_path)