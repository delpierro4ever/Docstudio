// backend/src/routes/admin.ts
//
// Read-only overview for the operator during the testing period: usage,
// failures and user feedback. Protected by the ADMIN_KEY environment
// variable (sent as the x-admin-key header); disabled when it is unset.

import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";

import { allFeedback } from "../stores/feedbackStore";
import { allJobs } from "../stores/jobStore";
import { allUsers } from "../stores/userStore";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return res.status(404).json({ error: "Not found" });
  }
  const given = String(req.headers["x-admin-key"] || "");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Invalid admin key" });
  }
  next();
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

router.get("/admin/overview", requireAdmin, (_req: Request, res: Response) => {
  const users = allUsers();
  const jobs = allJobs();
  const feedback = allFeedback();
  const userById = new Map(users.map((u) => [u.id, u]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const who = (userId: string) => {
    const u = userById.get(userId);
    return u ? { name: u.fullName, email: u.email, phone: u.phone } : null;
  };
  const day = (d: Date) => d.toISOString().slice(0, 10);

  const ratings = feedback.filter((f) => f.rating !== undefined).map((f) => f.rating as number);

  return res.json({
    generatedAt: new Date(),
    totals: {
      users: users.length,
      jobs: jobs.length,
      feedback: feedback.length,
      averageRating: ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
    },
    jobsByType: countBy(jobs, (j) => j.documentType),
    jobsByStatus: countBy(jobs, (j) => j.status),
    signupsByDay: countBy(users, (u) => day(u.createdAt)),
    jobsByDay: countBy(jobs, (j) => day(j.createdAt)),
    feedback: feedback
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((f) => {
        const job = f.jobId ? jobById.get(f.jobId) : undefined;
        return {
          id: f.id,
          createdAt: f.createdAt,
          rating: f.rating ?? null,
          comment: f.comment ?? null,
          user: who(f.userId),
          job: job
            ? { id: job.id, documentType: job.documentType, originalName: job.originalName || null, status: job.status }
            : null,
        };
      }),
    recentFailures: jobs
      .filter((j) => j.status === "error")
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 50)
      .map((j) => ({
        id: j.id,
        at: j.updatedAt,
        documentType: j.documentType,
        originalName: j.originalName || null,
        errorMessage: j.errorMessage || null,
        user: who(j.userId),
      })),
    users: users
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((u) => ({
        name: u.fullName,
        email: u.email,
        phone: u.phone,
        joined: u.createdAt,
        documents: jobs.filter((j) => j.userId === u.id).length,
      })),
  });
});

export default router;
