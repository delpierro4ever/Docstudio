// backend/src/routes/auth.ts

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

import { User } from "../models/user";
import {
  addUser,
  findUserByIdentifier,
  findUserByEmail,
  findUserByPhone,
  findUserById,
} from "../stores/userStore";


const router = Router();

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

    return res.status(201).json({
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      centerId: newUser.centerId || null,
      freeRemaining: newUser.freeRemaining,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    });
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

    const user = findUserByIdentifier(loginId);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      centerId: user.centerId || null,
      freeRemaining: user.freeRemaining,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Error in /auth/login:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /auth/me
 * Header: x-user-id
 */
router.get("/me", (req: Request, res: Response) => {
  const userId = req.headers["x-user-id"] as string;

  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id header" });
  }

  const user = findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    centerId: user.centerId || null,
    freeRemaining: user.freeRemaining,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});


export default router;
