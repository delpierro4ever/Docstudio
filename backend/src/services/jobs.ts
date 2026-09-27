// backend/src/services/jobs.ts
//
// Pieces shared by the signed-in document routes and the guest "try it"
// routes: the upload middleware, the formatter run, and the job fields
// that may be sent to the browser.

import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { callPythonFormatter, FormatterError } from "./pythonFormatterClient";
import { maxUploadBytes } from "../config/limits";
import { UPLOAD_DIR } from "../config/paths";
import { DocumentType, Job } from "../models/job";
import { updateJob } from "../stores/jobStore";

export const formattedDir = path.join(UPLOAD_DIR, "formatted");
export const previewsDir = path.join(UPLOAD_DIR, "previews");
fs.mkdirSync(formattedDir, { recursive: true });
fs.mkdirSync(previewsDir, { recursive: true });

export const DOCUMENT_TYPES: DocumentType[] = ["report", "undergraduate", "masters", "phd", "print_ready"];

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: maxUploadBytes(), files: 1 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".docx") {
      return cb(new Error("Only Word .docx files are supported."));
    }
    cb(null, true);
  },
});

/** multer as middleware, turning its errors into 400/413 JSON. */
export function uploadSingleDocx(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      const mb = Math.round(maxUploadBytes() / (1024 * 1024));
      return res.status(413).json({ error: `File is too large (maximum ${mb} MB).` });
    }
    return res.status(400).json({ error: (err as Error).message || "Upload failed" });
  });
}

/** The job fields safe to send to the browser (no server file paths). */
export function publicJob(job: Job) {
  return {
    id: job.id,
    documentType: job.documentType,
    profileId: job.profileId,
    originalName: job.originalName || null,
    status: job.status,
    errorMessage: job.errorMessage || null,
    isFree: job.isFree,
    priceCfa: job.priceCfa,
    centerId: job.centerId || null,
    pageCount: job.pages ?? null,
    previewPages: job.previewPages ?? [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function downloadName(job: Job): string {
  const base = job.originalName
    ? path.basename(job.originalName, path.extname(job.originalName))
    : `${job.documentType}-${job.id}`;
  return `${base} (formatted).docx`;
}

/**
 * Run the formatter for a job and persist the outcome (status, output
 * path or error) through the job store. Returns the HTTP status to
 * report on failure, or null on success.
 */
export async function formatJob(job: Job): Promise<number | null> {
  try {
    const formattedBuffer = await callPythonFormatter({
      filePath: job.inputPath,
      profileId: job.profileId,
      documentType: job.documentType,
    });

    const outputPath = path.join(formattedDir, `${job.id}.docx`);
    fs.writeFileSync(outputPath, formattedBuffer);

    updateJob(job.id, { status: "done", outputPath, errorMessage: undefined });
    return null;
  } catch (err: any) {
    console.error(`Formatter failed for job ${job.id}:`, err?.message || err);
    updateJob(job.id, {
      status: "error",
      errorMessage: err?.message || "Formatter error",
    });
    return err instanceof FormatterError ? err.status : 500;
  }
}

/** Delete a job's uploaded, formatted and preview files. */
export function removeJobFiles(job: Job): void {
  for (const file of [job.inputPath, job.outputPath]) {
    if (file) fs.rm(file, { force: true }, () => {});
  }
  fs.rm(path.join(previewsDir, job.id), { recursive: true, force: true }, () => {});
}
