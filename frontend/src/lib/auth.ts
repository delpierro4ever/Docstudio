// Authentication is a server session held in an HttpOnly cookie, which
// scripts cannot read. localStorage only keeps the signed-in user's id as
// a hint so pages can redirect to /login without a round trip; the
// server is the source of truth and answers 401 when the session is gone.

import { API_BASE } from "@/lib/api";

export function saveUserId(id: string) {
  localStorage.setItem("userId", id);
}

export function getUserId(): string | null {
  return localStorage.getItem("userId");
}

/** Forget the local hint only (e.g. after the server reported 401). */
export function clearUserId() {
  localStorage.removeItem("userId");
}

/** End the server session and forget the local hint. */
export async function logout() {
  clearUserId();
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    // The cookie expires on its own; nothing else to do offline.
  }
}
