// The three formatting categories offered on the upload page, and the
// backend documentType values they map to. Thesis has a level (which only
// affects pricing); Report and Quick Format map to a single type each.

export type Category = "thesis" | "report" | "quick";

export const THESIS_LEVELS = [
  { value: "undergraduate", label: "Undergraduate Thesis" },
  { value: "masters", label: "Masters Thesis" },
  { value: "phd", label: "PhD Thesis" },
];

export const CATEGORY_DOC_TYPE: Record<Exclude<Category, "thesis">, string> = {
  report: "report",
  quick: "print_ready",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  report: "Report",
  print_ready: "Quick Format",
  ...Object.fromEntries(THESIS_LEVELS.map((l) => [l.value, l.label])),
};

export function docTypeLabel(type: string): string {
  return DOC_TYPE_LABELS[type] ?? type;
}
