// backend/src/services/pythonFormatterClient.ts

import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

export interface PythonFormatterRequest {
  filePath: string;
  profileId: string;
  documentType?: string;
}

/**
 * Error from the formatter-service. `status` is the HTTP status to send
 * the client: 422 when the upload itself is unusable (bad DOCX), 502 when
 * the formatter failed or could not be reached.
 */
export class FormatterError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "FormatterError";
  }
}

const FORMATTER_URL =
  (process.env.FORMATTER_URL || "http://localhost:8082").replace(/\/$/, "") +
  "/format";

// LLM classification can try several models; allow generous time but
// never hang forever.
const FORMATTER_TIMEOUT_MS = Number(process.env.FORMATTER_TIMEOUT_MS) || 300_000;

/**
 * Call the Python formatter-service FastAPI endpoint.
 * Returns the formatted DOCX as a Buffer; throws FormatterError.
 */
export async function callPythonFormatter(
  params: PythonFormatterRequest
): Promise<Buffer> {
  const { filePath, profileId, documentType = "report" } = params;

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    throw new FormatterError(`Input file not found at: ${absPath}`, 500);
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(absPath));
  form.append("profileId", profileId);
  form.append("documentType", documentType);

  try {
    const res = await axios.post(FORMATTER_URL, form, {
      headers: form.getHeaders(),
      responseType: "arraybuffer",
      timeout: FORMATTER_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return Buffer.from(res.data as ArrayBuffer);
  } catch (err: any) {
    if (err?.response) {
      const detail = extractDetail(err.response.data);
      const status = err.response.status === 422 ? 422 : 502;
      throw new FormatterError(
        detail || `Formatter returned HTTP ${err.response.status}`,
        status
      );
    }
    if (err?.code === "ECONNABORTED") {
      throw new FormatterError("Formatting timed out. Please try again.", 504);
    }
    throw new FormatterError(
      `Formatter service unreachable at ${FORMATTER_URL} (${err?.code || err?.message})`,
      502
    );
  }
}

function extractDetail(data: unknown): string | undefined {
  try {
    const text = Buffer.from(data as ArrayBuffer).toString("utf-8");
    const parsed = JSON.parse(text);
    return typeof parsed?.detail === "string" ? parsed.detail : undefined;
  } catch {
    return undefined;
  }
}
