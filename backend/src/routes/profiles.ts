// backend/src/routes/profiles.ts

import { Router, Request, Response } from "express";
import { getTextProfiles } from "../config/formattingRules"

const router = Router();

// GET /profiles
router.get("/profiles", (req: Request, res: Response) => {
  try {
    const profiles = getTextProfiles();

    // Only expose safe info to frontend (no low-level rules)
    const publicProfiles = profiles.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
    }));

    return res.json(publicProfiles);
  } catch (error) {
    console.error("Error loading profiles:", error);
    return res.status(500).json({ error: "Failed to load profiles" });
  }
});

export default router;
