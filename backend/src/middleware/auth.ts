// backend/src/middleware/auth.ts
//
// Cookie-based authentication. requireUser rejects requests without a
// valid session and exposes the signed-in user as res.locals.user.

import { NextFunction, Request, Response } from "express";
import { User } from "../models/user";
import { findUserById } from "../stores/userStore";
import {
  createSession,
  deleteSession,
  findSessionUserId,
  SESSION_TTL_MS,
} from "../stores/sessionStore";

const COOKIE_NAME = "ds_session";

// Set COOKIE_SECURE=true when the site is served over HTTPS.
const SECURE = process.env.COOKIE_SECURE === "true";

function readSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function currentUser(req: Request): User | undefined {
  const userId = findSessionUserId(readSessionToken(req));
  return userId ? findUserById(userId) : undefined;
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Please sign in again." });
  }
  res.locals.user = user;
  next();
}

/** Start a session for `user` and set its cookie on the response. */
export function signIn(res: Response, user: User): void {
  const token = createSession(user.id);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE,
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function signOut(req: Request, res: Response): void {
  deleteSession(readSessionToken(req));
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: SECURE, path: "/" });
}
