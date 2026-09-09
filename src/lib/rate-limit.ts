/**
 * In-memory rate limiting / abuse protection.
 *
 * NOTE: state lives in the process, so this is PER-INSTANCE. Behind multiple serverless instances a
 * production deployment should swap these for a shared store (e.g. Upstash Redis). This is adequate
 * for a single-instance demo and gives a real ceiling in development.
 */

// --- Concurrent agent runs per org -------------------------------------------
const MAX_CONCURRENT_RUNS_PER_ORG = 3;
const activeRunsByOrg = new Map<string, number>();

/** Try to reserve a run slot for an org. Returns false when the org is at its concurrency cap. */
export function acquireRunSlot(orgId: string): boolean {
  const n = activeRunsByOrg.get(orgId) ?? 0;
  if (n >= MAX_CONCURRENT_RUNS_PER_ORG) return false;
  activeRunsByOrg.set(orgId, n + 1);
  return true;
}

/** Release a previously-acquired run slot. Safe to call once per successful acquire. */
export function releaseRunSlot(orgId: string): void {
  const n = activeRunsByOrg.get(orgId) ?? 0;
  if (n <= 1) activeRunsByOrg.delete(orgId);
  else activeRunsByOrg.set(orgId, n - 1);
}

// --- Failed-login throttling (by identifier, e.g. email) ---------------------
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 15 * 60 * 1000; // 15 minutes

type Attempt = { count: number; blockedUntil: number };
const loginAttempts = new Map<string, Attempt>();

/** True when the identifier is currently locked out from further login attempts. */
export function isLoginBlocked(key: string): boolean {
  const a = loginAttempts.get(key);
  if (!a) return false;
  if (a.blockedUntil > Date.now()) return true;
  if (a.blockedUntil !== 0) loginAttempts.delete(key); // block expired
  return false;
}

/** Record a failed attempt; locks the identifier out after MAX_LOGIN_ATTEMPTS. */
export function recordLoginFailure(key: string): void {
  const a = loginAttempts.get(key) ?? { count: 0, blockedUntil: 0 };
  a.count += 1;
  if (a.count >= MAX_LOGIN_ATTEMPTS) {
    a.blockedUntil = Date.now() + LOGIN_BLOCK_MS;
    a.count = 0;
  }
  loginAttempts.set(key, a);
}

/** Clear the failure counter for an identifier (call on successful login). */
export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}
