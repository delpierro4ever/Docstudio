// backend/src/routes/centers.ts

import { Router, Request, Response } from "express";
import { randomUUID as uuidv4 } from "crypto";
import { saveUser } from "../stores/userStore";
import { requireUser } from "../middleware/auth";
import { addCenter, findCenterById } from "../stores/centerStore";
import { findJobsByCenter } from "../stores/jobStore";
import { User } from "../models/user";
import { Center } from "../models/center";

const router = Router();

// POST /centers → create a documentation center for current user
router.post("/centers", requireUser, (req: Request, res: Response) => {
  try {
    const user: User = res.locals.user;

    const { name, phone, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Center name is required" });
    }

    // Only individual users can create a center (for now)
    if (user.role !== "individual" && user.role !== "center-admin") {
      return res.status(403).json({ error: "Not allowed to create a center" });
    }

    const center: Center = {
      id: uuidv4(),
      name,
      phone: phone || user.phone,
      address,
      email: user.email,
      ownerUserId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addCenter(center);

    // Turn this user into a center-admin and link to the center
    user.role = "center-admin";
    user.centerId = center.id;
    user.updatedAt = new Date();
    saveUser(user);

    const { passwordHash: _omit, ...safeUser } = user;
    return res.status(201).json({
      message: "Center created",
      center,
      user: safeUser,
    });
  } catch (error) {
    console.error("Error creating center:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /centers/me → get center for current user
router.get("/centers/me", requireUser, (req: Request, res: Response) => {
  try {
    const user: User = res.locals.user;

    if (!user.centerId) {
      return res.status(404).json({ error: "User is not attached to any center" });
    }

    const center = findCenterById(user.centerId);
    if (!center) {
      return res.status(404).json({ error: "Center not found" });
    }

    return res.json({ center, role: user.role });
  } catch (error) {
    console.error("Error getting center:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /centers/me/jobs → list all jobs for this center
router.get("/centers/me/jobs", requireUser, (req: Request, res: Response) => {
  try {
    const user: User = res.locals.user;

    if (!user.centerId) {
      return res.status(404).json({ error: "User is not attached to any center" });
    }

    const jobs = findJobsByCenter(user.centerId);

    return res.json(
      jobs.map((job) => ({
        id: job.id,
        documentType: job.documentType,
        profileId: job.profileId,
        status: job.status,
        isFree: job.isFree,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }))
    );
  } catch (error) {
    console.error("Error listing center jobs:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
