import type { FortniteCosmeticDbRow } from "@/lib/fortniteCosmeticSort";

const STORAGE_KEY = "royal-fn-cosmetics-map-v2";
/** Alinhado ao `staleTime` longo do useQuery em Contas — evita ~1,5 MB gzip em visitas recentes. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

type Stored = {
  savedAt: number;
  entries: [string, FortniteCosmeticDbRow][];
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadFortniteCosmeticsMapFromStorage(): Map<string, FortniteCosmeticDbRow> | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || typeof parsed.savedAt !== "number" || !Array.isArray(parsed.entries)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (parsed.entries.length < 500) return null;
    return new Map(parsed.entries);
  } catch {
    return null;
  }
}

export function saveFortniteCosmeticsMapToStorage(map: Map<string, FortniteCosmeticDbRow>): void {
  if (!canUseStorage() || map.size < 500) return;
  try {
    const payload: Stored = { savedAt: Date.now(), entries: [...map.entries()] };
    const s = JSON.stringify(payload);
    if (s.length > 4_500_000) return;
    window.localStorage.setItem(STORAGE_KEY, s);
  } catch {
    /* quota ou modo privado */
  }
}

/** Deixa o 1º GET `lzt-market` e paint competirem menos com o download grande da Fortnite API. */
export function waitForIdleBeforeHeavyFetch(timeoutMs = 2600): Promise<void> {
  return new Promise((resolve) => {
    const w = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => resolve(), { timeout: timeoutMs });
    } else {
      window.setTimeout(resolve, 0);
    }
  });
}
