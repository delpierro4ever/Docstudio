// backend/src/routes/guest.ts
//
// "Try before you sign up". A visitor formats one document without an
// account and sees preview images of the result; the .docx itself is
// only downloadable after they register or log in, which moves the job
// into their account (claimGuestJobs).
//
// The visitor is identified by a random token in an HttpOnly cookie; jobs
// store only its SHA-256. Trials are limited per IP address and overall
// per day (they cost LLM calls), and unclaimed ones are deleted after
// GUEST_RETENTION_HOURS.

import { Router, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";

import { getTextProfiles } from "../config/formattingRules";
import { getPriceForDocumentType } from "../config/pricingRules";
import {
  billingEnabled,
  guestDailyLimit,
  guestGlobalDailyLimit,
  guestRetentionHours,
  guestTrialEnabled,
} from "../config/limits";
import { readCookie, SECURE } from "../middleware/auth";
import { Job } from "../models/job";
import { User } from "../models/user";
import {
  DOCUMENT_TYPES,
  formatJob,
  publicJob,
  removeJobFiles,
  uploadSingleDocx,
} from "../services/jobs";
import { previewImagePath, renderPreview } from "../services/previewRenderer";
import { addJob, allJobs, findJobById, removeJob, updateJob } from "../stores/jobStore";
import { saveUser } from "../stores/userStore";

const router = Router();

const GUEST_COOKIE = "ds_guest";
const DAY_MS = 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** The hashed guest id from the request's cookie, if any. */
function guestIdOf(req: Request): string | undefined {
  const token = readCookie(req, GUEST_COOKIE);
  return token ? sha256(token) : undefined;
}

function guestCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: SECURE, path: "/" };
}

/** The request's guest id, issuing a new guest cookie when there is none. */
function ensureGuest(req: Request, res: Response): string {
  const existing = guestIdOf(req);
  if (existing) return existing;
  const token = crypto.randomBytes(32).toString("base64url");
  res.cookie(GUEST_COOKIE, token, { ...guestCookieOptions(), maxAge: guestRetentionHours() * 60 * 60 * 1000 });
  return sha256(token);
}

/** This visitor's unclaimed trial job, or an error response already sent. */
function guestJob(req: Request, res: Response): Job | undefined {
  const guestId = guestIdOf(req);
  const job = findJobById(req.params.id);
  if (!guestId || !job || job.userId || job.guestId !== guestId) {
    res.status(404).json({ error: "This preview has expired or belongs to another browser." });
    return undefined;
  }
  return job;
}

// ------------------------------------------------------
// POST /try → format a document without an account
// ------------------------------------------------------
router.post("/try", uploadSingleDocx, async (req: Request, res: Response) => {
  const discardUpload = () => req.file && fs.rm(req.file.path, { force: true }, () => {});
  try {
    if (!guestTrialEnabled()) {
      discardUpload();
      return res.status(403).json({ error: "Trying without an account is not available right now. Please create an account." });
    }
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

    const ipHash = sha256(req.ip || "unknown");
    const since = Date.now() - DAY_MS;
    const recentTrials = allJobs().filter((j) => j.guestIpHash && j.createdAt.getTime() > since);
    const perVisitor = guestDailyLimit();
    const overall = guestGlobalDailyLimit();
    if (perVisitor > 0 && recentTrials.filter((j) => j.guestIpHash === ipHash).length >= perVisitor) {
      discardUpload();
      return res.status(429).json({
        error: `You have used your free ${perVisitor === 1 ? "try" : `${perVisitor} tries`} for today. Create a free account to keep formatting.`,
      });
    }
    if (overall > 0 && recentTrials.length >= overall) {
      discardUpload();
      return res.status(429).json({
        error: "Too many people are trying DocStudio right now. Create a free account to format your document.",
      });
    }

    const job: Job = {
      id: crypto.randomUUID(),
      guestId: ensureGuest(req, res),
      guestIpHash: ipHash,
      profileId,
      documentType,
      originalName: req.file.originalname,
      status: "processing",
      inputPath: req.file.path,
      outputPath: undefined,
      isFree: true,
      priceCfa: 0,
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

    await renderPreview(job);
    return res.status(201).json({ message: "Document formatted", job: publicJob(job) });
  } catch (error) {
    console.error("Error creating trial job:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------
// GET /try/:id → this visitor's trial job
// ------------------------------------------------------
router.get("/try/:id", (req: Request, res: Response) => {
  const job = guestJob(req, res);
  if (!job) return;
  return res.json(publicJob(job));
});

// ------------------------------------------------------
// GET /try/:id/preview/:n → preview page image n (1-based)
// ------------------------------------------------------
router.get("/try/:id/preview/:n", (req: Request, res: Response) => {
  const job = guestJob(req, res);
  if (!job) return;
  const file = previewImagePath(job, Number(req.params.n));
  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ error: "Preview page not found" });
  }
  res.setHeader("Cache-Control", "private, max-age=3600");
  return res.sendFile(file);
});

/**
 * Move the visitor's trial jobs into `user`'s account (called on
 * register and login) and forget the guest cookie. Charges them like a
 * normal upload when billing is on. Returns the claimed job ids, newest
 * first.
 */
export function claimGuestJobs(req: Request, res: Response, user: User): string[] {
  const guestId = guestIdOf(req);
  if (!guestId) return [];
  res.clearCookie(GUEST_COOKIE, guestCookieOptions());

  const jobs = allJobs()
    .filter((j) => j.guestId === guestId && !j.userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const job of jobs) {
    let isFree = true;
    let priceCfa = 0;
    if (billingEnabled() && job.status === "done") {
      if (user.freeRemaining > 0) {
        user.freeRemaining -= 1;
        user.updatedAt = new Date();
        saveUser(user);
      } else {
        isFree = false;
        priceCfa = getPriceForDocumentType(job.documentType)?.basePriceCfa ?? 0;
      }
    }
    updateJob(job.id, { userId: user.id, centerId: user.centerId, guestId: undefined, isFree, priceCfa });
  }
  return jobs.map((j) => j.id);
}

/** Delete trial jobs nobody claimed within the retention period. */
export function sweepExpiredGuestJobs(): void {
  const cutoff = Date.now() - guestRetentionHours() * 60 * 60 * 1000;
  for (const job of allJobs().filter((j) => j.guestId && !j.userId && j.createdAt.getTime() < cutoff)) {
    removeJobFiles(job);
    removeJob(job.id);
  }
}

export default router;
