// backend/src/stores/feedbackStore.ts

import fs from "fs";
import path from "path";

import { DATA_DIR } from "../config/paths";
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");

export interface Feedback {
  id: string;
  userId: string;
  jobId?: string;      // set when the feedback is about one formatted document
  rating?: number;     // 1-5
  comment?: string;
  createdAt: Date;
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Feedback[] {
  try {
    if (!fs.existsSync(FEEDBACK_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(FEEDBACK_FILE, "utf-8")) as any[];
    return parsed.map((f) => ({ ...f, createdAt: new Date(f.createdAt) }));
  } catch {
    return [];
  }
}

let feedback: Feedback[] = load();

export function addFeedback(entry: Feedback): void {
  feedback.push(entry);
  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback, null, 2), "utf-8");
  } catch (err) {
    console.error("[feedbackStore] Failed to persist feedback:", err);
  }
}

export function allFeedback(): Feedback[] {
  return feedback;
}
