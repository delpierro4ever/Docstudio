import requests
import time
import os

BASE_URL = "http://localhost:8000"

def test_flow():
    # Use the actual sample.docx from examples folder
    sample_path = r"C:\Users\Cephas\Documents\Programming\Student-Report-Formatter\examples\sample.docx"
    
    if not os.path.exists(sample_path):
        print(f"ERROR: Sample file not found at {sample_path}")
        return
    
    print(f"Using sample file: {sample_path}")
    
    # 2. Upload
    print("Uploading...")
    with open(sample_path, "rb") as f:
        files = {"file": f}
        data = {"documentType": "report", "profileId": "standard"}
        res = requests.post(f"{BASE_URL}/documents", files=files, data=data)
    
    if res.status_code != 200:
        print(f"Upload failed: {res.text}")
        return
    
    job = res.json()["job"]
    job_id = job["id"]
    print(f"Job created: {job_id}")
    
    # 3. Poll for completion
    print("Polling...")
    for _ in range(20): # wait up to 20s
        res = requests.get(f"{BASE_URL}/documents/{job_id}")
        if res.status_code != 200:
            print(f"Poll failed: {res.text}")
            break
        
        job_status = res.json()["status"]
        print(f"Status: {job_status}")
        if job_status == "done":
            break
        time.sleep(1)
        
    if job_status != "done":
        print("Job did not finish in time")
        return

    # 4. Download
    print("Downloading...")
    res = requests.get(f"{BASE_URL}/documents/{job_id}/download", stream=True)
    
    print(f"Status Code: {res.status_code}")
    print("Headers:")
    for k, v in res.headers.items():
        print(f"  {k}: {v}")
        
    if res.status_code == 200:
        with open(f"downloaded_{job_id}.docx", "wb") as f:
            for chunk in res.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Downloaded to downloaded_{job_id}.docx")
        print(f"File size: {os.path.getsize(f'downloaded_{job_id}.docx')} bytes")
    else:
        print("Download failed")
        print(res.text)

if __name__ == "__main__":
    try:
        test_flow()
    except Exception as e:
        print(f"Error: {e}")
