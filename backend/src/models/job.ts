export type JobStatus = "pending" | "processing" | "done" | "error";

export type DocumentType = "report" | "undergraduate" | "masters" | "phd" | "print_ready";

export interface Job {
  id: string;
  userId: string;
  profileId: string;
  documentType: DocumentType;

  status: JobStatus;

  inputPath: string;
  outputPath?: string;

  isFree: boolean;
  priceCfa?: number;

  centerId?: string;        // 👈 NEW: which documentation center (if any)

  pages?: number;
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}
