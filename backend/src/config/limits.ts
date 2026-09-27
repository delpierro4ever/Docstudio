// backend/src/config/limits.ts
//
// Operational switches, read from the environment at call time.

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Charging for documents (free quota, then per-type prices). Off by
 * default: during the testing period every document is free.
 */
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

/** Documents one user may submit per rolling 24 hours (0 = unlimited). */
export function dailyJobLimit(): number {
  return envInt("DAILY_JOB_LIMIT", 30);
}

export function maxUploadBytes(): number {
  return envInt("MAX_UPLOAD_MB", 25) * 1024 * 1024;
}

/** Visitors may format a document without an account ("try it first"). */
export function guestTrialEnabled(): boolean {
  return process.env.GUEST_TRIAL_ENABLED !== "false";
}

/** Trial documents one visitor (IP address) may format per 24 hours. */
export function guestDailyLimit(): number {
  return envInt("GUEST_DAILY_LIMIT", 2);
}

/** Trial documents all visitors together may format per 24 hours. */
export function guestGlobalDailyLimit(): number {
  return envInt("GUEST_GLOBAL_DAILY_LIMIT", 100);
}

/** Unclaimed trial documents are deleted after this many hours. */
export function guestRetentionHours(): number {
  return envInt("GUEST_RETENTION_HOURS", 48);
}
