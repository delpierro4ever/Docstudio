// backend/src/stores/sessionStore.ts
//
// Login sessions. The browser holds a random token in an HttpOnly cookie;
// only its SHA-256 hash is stored here, so a leaked sessions.json cannot
// be replayed.

import crypto from "crypto";
import fs from "fs";
import path from "path";

import { DATA_DIR } from "../config/paths";
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface Session {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function load(): Session[] {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8")) as Session[];
    return parsed.filter((s) => s.expiresAt > Date.now());
  } catch {
    return [];
  }
}

function save(): void {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
  } catch (err) {
    console.error("[sessionStore] Failed to persist sessions:", err);
  }
}

let sessions: Session[] = load();

/** Create a session for a user; returns the raw token for the cookie. */
export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions = sessions.filter((s) => s.expiresAt > Date.now());
  sessions.push({ tokenHash: hash(token), userId, expiresAt: Date.now() + SESSION_TTL_MS });
  save();
  return token;
}

/** The user id for a valid, unexpired token. */
export function findSessionUserId(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const tokenHash = hash(token);
  const session = sessions.find((s) => s.tokenHash === tokenHash);
  if (!session || session.expiresAt <= Date.now()) return undefined;
  return session.userId;
}

export function deleteSession(token: string | undefined): void {
  if (!token) return;
  const tokenHash = hash(token);
  const before = sessions.length;
  sessions = sessions.filter((s) => s.tokenHash !== tokenHash);
  if (sessions.length !== before) save();
}
