// backend/src/routes/documents.ts

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID as uuidv4 } from "crypto";

import { getTextProfiles } from "../config/formattingRules";
import {
  callPythonFormatter,
  FormatterError,
} from "../services/pythonFormatterClient";
import { getPriceForDocumentType } from "../config/pricingRules";
import { billingEnabled, dailyJobLimit, maxUploadBytes } from "../config/limits";
import { requireUser } from "../middleware/auth";
import { UPLOAD_DIR } from "../config/paths";

import { DocumentType, Job } from "../models/job";
import { User } from "../models/user";
import {
  addJob,
  findJobsByUser,
  findJobById,
  updateJob,
} from "../stores/jobStore";
import { saveUser } from "../stores/userStore";

const router = Router();

const uploadDir = UPLOAD_DIR;
const formattedDir = path.join(uploadDir, "formatted");
fs.mkdirSync(formattedDir, { recursive: true });

const DOCUMENT_TYPES: DocumentType[] = ["report", "undergraduate", "masters", "phd", "print_ready"];

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: maxUploadBytes(), files: 1 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".docx") {
      return cb(new Error("Only Word .docx files are supported."));
    }
    cb(null, true);
  },
});

/** multer as middleware, turning its errors into 400/413 JSON. */
function uploadSingleDocx(req: Request, res: Response, next: NextFunction) {
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
function publicJob(job: Job) {
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
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function downloadName(job: Job): string {
  const base = job.originalName
    ? path.basename(job.originalName, path.extname(job.originalName))
    : `${job.documentType}-${job.id}`;
  return `${base} (formatted).docx`;
}

/** The signed-in user's job, or an error response already sent. */
function ownJob(req: Request, res: Response): Job | undefined {
  const user: User = res.locals.user;
  const job = findJobById(req.params.id);
  if (!job || job.userId !== user.id) {
    res.status(404).json({ error: "Document not found" });
    return undefined;
  }
  return job;
}

/**
 * Run the formatter for a job and persist the outcome (status, output
 * path or error) through the job store. Returns the HTTP status to
 * report on failure, or null on success.
 */
async function formatJob(job: Job): Promise<number | null> {
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

// ------------------------------------------------------
// POST /documents → upload + format
// ------------------------------------------------------
router.post(
  "/documents",
  requireUser,
  uploadSingleDocx,
  async (req: Request, res: Response) => {
    const user: User = res.locals.user;
    const discardUpload = () => req.file && fs.rm(req.file.path, { force: true }, () => {});
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { profileId, documentType } = req.body;

      if (!getTextProfiles().some((p) => p.id === profileId)) {
        discardUpload();
        return res.status(400).json({ error: "Invalid profileId" });
      }

      if (!DOCUMENT_TYPES.includes(documentType)) {
        discardUpload();
        return res.status(400).json({
          error: `Invalid documentType. Use one of: ${DOCUMENT_TYPES.join(", ")}`,
        });
      }

      const limit = dailyJobLimit();
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const recent = findJobsByUser(user.id).filter((j) => j.createdAt.getTime() > since);
      if (limit > 0 && recent.length >= limit) {
        discardUpload();
        return res.status(429).json({
          error: `You have reached the limit of ${limit} documents per day. Please try again tomorrow.`,
        });
      }

      // Pricing. With billing off (testing period) every document is free.
      let isFree = true;
      let priceCfa = 0;
      if (billingEnabled()) {
        isFree = user.freeRemaining > 0;
        if (!isFree) {
          const pricing = getPriceForDocumentType(documentType);
          if (!pricing) {
            discardUpload();
            return res.status(400).json({
              error: `No pricing configured for documentType: ${documentType}`,
            });
          }
          priceCfa = pricing.basePriceCfa;
        }
      }

      const job: Job = {
        id: uuidv4(),
        userId: user.id,
        profileId,
        documentType,
        originalName: req.file.originalname,
        status: "processing",
        inputPath: req.file.path,
        outputPath: undefined,
        isFree,
        priceCfa,
        centerId: user.centerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addJob(job);

      const failStatus = await formatJob(job);
      if (failStatus !== null) {
        return res
          .status(failStatus)
          .json({ error: job.errorMessage || "Failed to format document", job: publicJob(job) });
      }

      if (billingEnabled() && job.isFree && user.freeRemaining > 0) {
        user.freeRemaining -= 1;
        user.updatedAt = new Date();
        saveUser(user);
      }

      return res.status(201).json({ message: "Job created", job: publicJob(job) });
    } catch (error) {
      console.error("Error creating job:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ------------------------------------------------------
// GET /documents → list the signed-in user's jobs
// ------------------------------------------------------
router.get("/documents", requireUser, (_req: Request, res: Response) => {
  const user: User = res.locals.user;
  const jobs = findJobsByUser(user.id)
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return res.json(jobs.map(publicJob));
});

// ------------------------------------------------------
// GET /documents/:id → job details
// ------------------------------------------------------
router.get("/documents/:id", requireUser, (req: Request, res: Response) => {
  const job = ownJob(req, res);
  if (!job) return;
  return res.json(publicJob(job));
});

// ------------------------------------------------------
// POST /documents/:id/reformat → re-run the formatter
// ------------------------------------------------------
router.post("/documents/:id/reformat", requireUser, async (req: Request, res: Response) => {
  try {
    const job = ownJob(req, res);
    if (!job) return;

    if (!job.inputPath || !fs.existsSync(job.inputPath)) {
      return res.status(404).json({ error: "Original file not found for this document" });
    }

    updateJob(job.id, { status: "processing", errorMessage: undefined });

    const failStatus = await formatJob(job);
    if (failStatus !== null) {
      return res
        .status(failStatus)
        .json({ error: job.errorMessage || "Failed to reformat document", job: publicJob(job) });
    }

    // Reformatting is never charged again
    return res.json({ message: "Document reformatted successfully", job: publicJob(job) });
  } catch (error) {
    console.error("Error reformatting job:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------
// GET /documents/:id/download → formatted docx
// ------------------------------------------------------
router.get("/documents/:id/download", requireUser, (req: Request, res: Response) => {
  const job = ownJob(req, res);
  if (!job) return;

  if (job.status !== "done" || !job.outputPath) {
    return res.status(400).json({ error: "This document is not ready yet" });
  }
  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: "Formatted file not found" });
  }
  return res.download(job.outputPath, downloadName(job));
});

export default router;
