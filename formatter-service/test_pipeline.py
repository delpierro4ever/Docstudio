# formatter-service/test_pipeline.py

from pipeline import run_pipeline

def main():
    input_path = r"C:\Users\Cephas\Documents\Programming\Student-Report-Formatter\sample.docx"  # <<— change this
    profile_id = "default"  # or any string for now

    output_bytes = run_pipeline(input_path=input_path, profile_id=profile_id)

    output_path = r"C:\Users\Cephas\Documents\Programming\Student-Report-Formatter\test1.docx"  # <<— change this
    with open(output_path, "wb") as f:
        f.write(output_bytes)

    print("✅ Pipeline finished. Output saved to:", output_path)

if __name__ == "__main__":
    main()
