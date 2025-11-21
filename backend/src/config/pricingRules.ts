import path from "path";
import fs from "fs";

export interface DocumentTypePricing {
  label: string;
  basePriceCfa: number;
}

export interface PricingRulesFile {
  currency: string;
  documentTypePricing: Record<string, DocumentTypePricing>;
}

const pricingPath = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "pricingRules.json"
);

let cachedPricing: PricingRulesFile | null = null;

export function loadPricingRules(): PricingRulesFile {
  if (cachedPricing) return cachedPricing;

  const raw = fs.readFileSync(pricingPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!parsed.documentTypePricing) {
    throw new Error("Invalid pricingRules.json: missing documentTypePricing");
  }

  cachedPricing = parsed as PricingRulesFile;
  return cachedPricing;
}

export function getPriceForDocumentType(
  documentType: string
): DocumentTypePricing | null {
  const rules = loadPricingRules();
  const entry = rules.documentTypePricing[documentType];
  return entry || null;
}
