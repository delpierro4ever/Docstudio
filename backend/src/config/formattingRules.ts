// backend/src/config/formattingRules.ts

import path from "path";
import fs from "fs";

export interface TextProfile {
  id: string;
  name: string;
  description?: string;
  // we can add more settings later (margins, fonts, etc.)
  [key: string]: any;
}

export interface FormattingRulesFile {
  defaultProfileId: string;
  textProfiles: TextProfile[];
}

// Path to backend/config/formattingRules.json (NOT src/)
const rulesPath = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "formattingRules.json"
);

let cachedRules: FormattingRulesFile | null = null;

// Load and cache JSON file
export function loadFormattingRules(): FormattingRulesFile {
  if (cachedRules) return cachedRules;

  const raw = fs.readFileSync(rulesPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!parsed.textProfiles || !Array.isArray(parsed.textProfiles)) {
    throw new Error("Invalid formattingRules.json: missing textProfiles array");
  }

  cachedRules = parsed as FormattingRulesFile;
  return cachedRules;
}

// 👉 This is the function documents.ts should call
export function getTextProfiles(): TextProfile[] {
  const rules = loadFormattingRules();
  return rules.textProfiles;
}
