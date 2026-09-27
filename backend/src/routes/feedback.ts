// backend/src/routes/feedback.ts

import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";

import { requireUser } from "../middleware/auth";
import { User } from "../models/user";
import { addFeedback } from "../stores/feedbackStore";
import { findJobById } from "../stores/jobStore";

const router = Router();

const MAX_COMMENT_CHARS = 4000;

/**
 * POST /feedback
 * Body: { jobId?, rating? (1-5), comment? } — at least a rating or a comment.
 */
router.post("/feedback", requireUser, (req: Request, res: Response) => {
  const user: User = res.locals.user;
  const { jobId, rating, comment } = req.body || {};

  const hasRating = rating !== undefined && rating !== null && rating !== "";
  const ratingNum = Number(rating);
  if (hasRating && !(Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5)) {
    return res.status(400).json({ error: "Rating must be a whole number from 1 to 5." });
  }

  const text = typeof comment === "string" ? comment.trim() : "";
  if (text.length > MAX_COMMENT_CHARS) {
    return res.status(400).json({ error: `Comment is too long (max ${MAX_COMMENT_CHARS} characters).` });
  }
  if (!hasRating && !text) {
    return res.status(400).json({ error: "Please add a rating or a comment." });
  }

  if (jobId) {
    const job = findJobById(String(jobId));
    if (!job || job.userId !== user.id) {
      return res.status(404).json({ error: "Document not found" });
    }
  }

  addFeedback({
    id: randomUUID(),
    userId: user.id,
    jobId: jobId ? String(jobId) : undefined,
    rating: hasRating ? ratingNum : undefined,
    comment: text || undefined,
    createdAt: new Date(),
  });

  return res.status(201).json({ message: "Thank you for your feedback!" });
});

export default router;
