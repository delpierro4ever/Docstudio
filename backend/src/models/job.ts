export type JobStatus = "pending" | "processing" | "done" | "error";

export type DocumentType = "report" | "undergraduate" | "masters" | "phd" | "print_ready";

export interface Job {
  id: string;
  userId?: string;          // unset while the job belongs to a guest

  // "Try before you sign up": a visitor's job, identified by the SHA-256
  // of their guest cookie until they register or log in and claim it.
  guestId?: string;
  guestIpHash?: string;     // for the per-visitor daily trial limit
  profileId: string;
  documentType: DocumentType;

  status: JobStatus;

  originalName?: string;   // file name as uploaded

  inputPath: string;
  outputPath?: string;

  isFree: boolean;
  priceCfa?: number;

  centerId?: string;        // 👈 NEW: which documentation center (if any)

  pages?: number;
  previewPages?: number[];  // page numbers rendered as preview images (1.png…)
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}
