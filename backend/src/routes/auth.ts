// backend/src/routes/auth.ts

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomUUID as uuidv4 } from "crypto";

import { User } from "../models/user";
import {
  addUser,
  findUserByIdentifier,
  findUserByEmail,
  findUserByPhone,
} from "../stores/userStore";
import { currentUser, signIn, signOut } from "../middleware/auth";
import { claimGuestJobs } from "./guest";


const router = Router();

/** The user fields safe to send to the browser. */
function publicUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    centerId: user.centerId || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Failed-login throttle: at most MAX_FAILURES per identifier+IP per window.
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

function tooManyFailures(key: string): boolean {
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= Date.now()) return false;
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string): void {
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    failures.set(key, { count: 1, resetAt: Date.now() + FAILURE_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/**
 * POST /auth/register
 * Body: { fullName, email, phone, password }
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res
        .status(400)
        .json({ error: "fullName, email, phone and password are required" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if email or phone already exists
    const existingByEmail = findUserByEmail(email);
    if (existingByEmail) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const existingByPhone = findUserByPhone(phone);
    if (existingByPhone) {
      return res.status(400).json({ error: "Phone already in use" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser: User = {
      id: uuidv4(),
      fullName,
      email,
      phone,
      passwordHash,
      role: "individual",     // 👈 default role
      centerId: undefined,    // 👈 not attached to any center yet
      freeRemaining: 2,       // 👈 free docs
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addUser(newUser);
    signIn(res, newUser);
    const claimedJobIds = claimGuestJobs(req, res, newUser);

    return res.status(201).json({ ...publicUser(newUser), claimedJobIds });
  } catch (error) {
    console.error("Error in /auth/register:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /auth/login
 * Body: { identifier, password }
 * identifier can be email OR phone
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { identifier, email, phone, password } = req.body || {};

    const loginId: string | undefined = identifier || email || phone;

    if (!loginId || !password) {
      return res
        .status(400)
        .json({ error: "identifier/email/phone and password are required" });
    }

    const throttleKey = `${String(loginId).toLowerCase()}|${req.ip}`;
    if (tooManyFailures(throttleKey)) {
      return res
        .status(429)
        .json({ error: "Too many failed attempts. Please wait 15 minutes and try again." });
    }

    const user = findUserByIdentifier(loginId);
    const passwordMatch = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !passwordMatch) {
      recordFailure(throttleKey);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    failures.delete(throttleKey);
    signIn(res, user);
    const claimedJobIds = claimGuestJobs(req, res, user);
    return res.json({ ...publicUser(user), claimedJobIds });
  } catch (error) {
    console.error("Error in /auth/login:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /auth/me — the signed-in user (session cookie)
 */
router.get("/me", (req: Request, res: Response) => {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Not signed in" });
  }
  return res.json(publicUser(user));
});

/**
 * POST /auth/logout — end the current session
 */
router.post("/logout", (req: Request, res: Response) => {
  signOut(req, res);
  return res.status(204).end();
});

export default router;
