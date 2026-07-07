// backend/src/routes/documents.ts

import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

import { extractPreviewHtml } from "../services/preview";

import { findUserById, saveUser } from "../stores/userStore";
import { getTextProfiles } from "../config/formattingRules";
import { callPythonFormatter } from "../services/pythonFormatterClient";
import { getPriceForDocumentType } from "../config/pricingRules";

import { Job } from "../models/job";
import {
  addJob,
  findJobsByUser,
  findJobById,
  findJobsByCenter,
} from "../stores/jobStore";

import { User } from "../models/user";

const router = Router();

// Where uploads go
const uploadDir = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
});

// ------------------------------------------------------
// POST /documents → upload + format
// ------------------------------------------------------
router.post(
  "/documents",
  upload.single("file"),
  async (req: Request, res: Response) => {
     console.log("📥 POST /documents hit!"); // ← ADD THIS
    console.log("File:", req.file); // ← ADD THIS
    console.log("Body:", req.body); // ← ADD THIS
    try {
      const userId = req.headers["x-user-id"] as string;
      const user: User | undefined = findUserById(userId);

      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { profileId, documentType } = req.body;

      // Validate profileId
      const profiles = getTextProfiles();
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) {
        return res.status(400).json({ error: "Invalid profileId" });
      }

      // Validate documentType
      const allowedTypes = ["report", "undergraduate", "masters", "phd", "print_ready"];
      if (!documentType || !allowedTypes.includes(documentType)) {
        return res.status(400).json({
          error:
            "Invalid documentType. Use one of: report, undergraduate, masters, phd, print_ready",
        });
      }

      const isFree = user.freeRemaining > 0;

      // Compute price based on document type (for now, flat per type)
      let priceCfa: number | undefined = undefined;

      if (!isFree) {
        const pricing = getPriceForDocumentType(documentType);
        if (!pricing) {
          return res.status(400).json({
            error: `No pricing configured for documentType: ${documentType}`,
          });
        }
        priceCfa = pricing.basePriceCfa;
      } else {
        priceCfa = 0;
      }

      // 1) Create job
      const job: Job = {
        id: uuidv4(),
        userId: user.id,
        profileId,
        documentType,
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

      // 2) Call Python formatter
      let formattedBuffer: Buffer;
      try {
        formattedBuffer = await callPythonFormatter({
          filePath: job.inputPath,
          profileId: job.profileId,
          documentType: job.documentType,
        });
      } catch (err: any) {
        console.error("Error calling Python formatter:", err);
        job.status = "error";
        job.errorMessage = err?.message || "Formatter error";
        job.updatedAt = new Date();

        return res
          .status(500)
          .json({ error: "Failed to format document", job });
      }

      // 3) Save formatted DOCX
      const formattedDir = path.join(uploadDir, "formatted");
      if (!fs.existsSync(formattedDir)) {
        fs.mkdirSync(formattedDir, { recursive: true });
      }

      const outputFile = `${job.id}.docx`;
      const outputPath = path.join(formattedDir, outputFile);

      fs.writeFileSync(outputPath, formattedBuffer);

      // 4) Update job
      job.outputPath = outputPath;
      job.status = "done";
      job.updatedAt = new Date();

      // Free credit deduction
      if (job.isFree && user.freeRemaining > 0) {
        user.freeRemaining -= 1;
        user.updatedAt = new Date();
        saveUser(user);
      }

      return res.status(201).json({
        message: "Job created",
        job,
      });
    } catch (error) {
      console.error("Error creating job:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ------------------------------------------------------
// GET /documents → list user jobs
// ------------------------------------------------------
router.get("/documents", (req: Request, res: Response) => {
  try {
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "Missing x-user-id header" });
    }

    const jobs = findJobsByUser(userId);

    const response = jobs.map((job) => ({
      id: job.id,
      documentType: job.documentType,
      profileId: job.profileId,
      status: job.status,
      isFree: job.isFree,
      priceCfa: job.priceCfa,
      centerId: job.centerId || null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));

    return res.json(response);
  } catch (error) {
    console.error("Error listing jobs:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------
// GET /documents/:id → detailed job info
// ------------------------------------------------------
router.get("/documents/:id", (req: Request, res: Response) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const jobId = req.params.id;

    const job = findJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(job);
  } catch (error) {
    console.error("Error getting job:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------
// GET /documents/:id/preview → HTML preview from original docx
// ------------------------------------------------------
router.get(
  "/documents/:id/preview",
  async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const jobId = req.params.id;

      const user = findUserById(userId);
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const job = findJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.userId !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!job.inputPath || !fs.existsSync(job.inputPath)) {
        return res
          .status(404)
          .json({ error: "Original file not found for this job" });
      }

      const previewHtml = await extractPreviewHtml(job.inputPath);

      return res.json({
        previewHtml: previewHtml ?? null,
      });
    } catch (error) {
      console.error("Error generating preview:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ------------------------------------------------------
// POST /documents/:id/reformat → re-run Python formatter
// ------------------------------------------------------
router.post(
  "/documents/:id/reformat",
  async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const jobId = req.params.id;

      const user = findUserById(userId);
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const job = findJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.userId !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!job.inputPath || !fs.existsSync(job.inputPath)) {
        return res
          .status(404)
          .json({ error: "Original file not found for this job" });
      }

      // Mark processing
      job.status = "processing";
      job.errorMessage = undefined;
      job.updatedAt = new Date();

      // Call Python formatter again
      let formattedBuffer: Buffer;
      try {
        formattedBuffer = await callPythonFormatter({
          filePath: job.inputPath,
          profileId: job.profileId,
          documentType: job.documentType,
        });
      } catch (err: any) {
        console.error("Error re-running Python formatter:", err);
        job.status = "error";
        job.errorMessage = err?.message || "Formatter error";
        job.updatedAt = new Date();
        return res
          .status(500)
          .json({ error: "Failed to reformat document", job });
      }

      // Ensure formatted directory exists
      const formattedDir = path.join(uploadDir, "formatted");
      if (!fs.existsSync(formattedDir)) {
        fs.mkdirSync(formattedDir, { recursive: true });
      }

      const outputFile = `${job.id}.docx`;
      const outputPath = path.join(formattedDir, outputFile);

      fs.writeFileSync(outputPath, formattedBuffer);

      job.outputPath = outputPath;
      job.status = "done";
      job.updatedAt = new Date();

      // We do NOT change freeRemaining or priceCfa for reformatting

      return res.json({
        message: "Document reformatted successfully",
        job,
      });
    } catch (error) {
      console.error("Error reformatting job:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ------------------------------------------------------
// GET /documents/:id/download → download formatted docx
// ------------------------------------------------------
router.get("/documents/:id/download", (req: Request, res: Response) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const jobId = req.params.id;

    const user = findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const job = findJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.userId !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (job.status !== "done" || !job.outputPath) {
      return res
        .status(400)
        .json({ error: "Job not completed or no output file" });
    }

    if (!fs.existsSync(job.outputPath)) {
      return res.status(404).json({ error: "Formatted file not found" });
    }

    const downloadName = `${job.documentType}-${job.id}.docx`;
    return res.download(job.outputPath, downloadName);
  } catch (error) {
    console.error("Error downloading file:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
