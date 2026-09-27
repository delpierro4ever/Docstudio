// backend/src/config/paths.ts
//
// Where runtime data lives. Defaults to backend/data and backend/uploads;
// override with DATA_DIR / UPLOAD_DIR (e.g. to keep production data
// outside the code checkout, or to isolate tests).

import path from "path";

const BACKEND_ROOT = path.join(__dirname, "..", "..");

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(BACKEND_ROOT, "data"));
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(BACKEND_ROOT, "uploads"));
