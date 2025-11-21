// backend/src/routes/login.ts

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { findUserByIdentifier } from "../stores/userStore";

const router = Router();

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({
        error: "identifier and password are required",
      });
    }

    const user = findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // In future: generate JWT here and return { user, token }
    const { passwordHash: _, ...safeUser } = user;
    return res.json(safeUser);
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
