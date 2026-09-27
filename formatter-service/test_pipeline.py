# formatter-service/test_pipeline.py
#
# Run the full pipeline on a DOCX from the command line:
#   python test_pipeline.py [input.docx] [output.docx] [profileId]

import sys

from pipeline import run_pipeline


def main():
    input_path = sys.argv[1] if len(sys.argv) > 1 else "sample.docx"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "sample_formatted.docx"
    profile_id = sys.argv[3] if len(sys.argv) > 3 else "default"

    output_bytes = run_pipeline(input_path=input_path, profile_id=profile_id)

    with open(output_path, "wb") as f:
        f.write(output_bytes)

    print("✅ Pipeline finished. Output saved to:", output_path)


if __name__ == "__main__":
    main()
