/** Session-only optimistic cache so /admin re-entries skip the double-RPC spinner (re-verified in background). */
const STORAGE_KEY = "royal_admin_guard_v1";
const TTL_MS = 8 * 60 * 1000; // 8 minutes — balance UX vs role-revocation latency

type Stored = { uid: string; ts: number };

export function readAdminGuardCache(userId: string): boolean | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as Stored;
    if (row.uid !== userId || typeof row.ts !== "number") return null;
    if (Date.now() - row.ts > TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return true;
  } catch {
    return null;
  }
}

export function writeAdminGuardCache(userId: string, ok: boolean) {
  try {
    if (!ok) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: Stored = { uid: userId, ts: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearAdminGuardCache() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
