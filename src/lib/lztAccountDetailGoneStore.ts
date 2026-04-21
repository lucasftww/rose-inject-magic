const STORAGE_KEY = "royal_lzt_detail_gone_v1";
const MAX_IDS = 800;

export type GoneAccountDetailKey = `${string}:${string}`;

function parseStored(raw: string | null): GoneAccountDetailKey[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is GoneAccountDetailKey => typeof x === "string" && x.includes(":"));
  } catch {
    return [];
  }
}

export function rememberAccountDetailGone(key: GoneAccountDetailKey): void {
  if (typeof window === "undefined") return;
  try {
    const prev = parseStored(sessionStorage.getItem(STORAGE_KEY));
    const next = [key, ...prev.filter((k) => k !== key)];
    while (next.length > MAX_IDS) next.pop();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readAccountDetailGoneKeys(): Set<GoneAccountDetailKey> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(parseStored(sessionStorage.getItem(STORAGE_KEY)));
  } catch {
    return new Set();
  }
}
