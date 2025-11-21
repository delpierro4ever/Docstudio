// backend/src/services/pythonFormatterClient.ts

import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

export interface PythonFormatterRequest {
  filePath: string;
  profileId: string;
}

/**
 * Call the Python formatter-service FastAPI endpoint.
 * Returns the formatted DOCX as a Buffer.
 */
export async function callPythonFormatter(
  params: PythonFormatterRequest
): Promise<Buffer> {
  const { filePath, profileId } = params;

  // Sanity check
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Input file not found at: ${absPath}`);
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(absPath));
  form.append("profileId", profileId);

  const url = "http://localhost:8082/format"; // 👈 must match your uvicorn port

  const res = await axios.post(url, form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
    // avoid hanging forever:
    timeout: 60_000, // 60 seconds
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `Python formatter returned HTTP ${res.status}: ${res.statusText}`
    );
  }

  // axios with responseType "arraybuffer" gives a raw ArrayBuffer
  return Buffer.from(res.data as ArrayBuffer);
}
