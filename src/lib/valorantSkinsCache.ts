/** Alinhado a `SkinEntry` em `valorantData.ts` (evita import circular). */
type CachedSkinEntry = { name: string; image: string; rarity: number };

const STORAGE_KEY = "royal-val-skins-map-v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

type Stored = { savedAt: number; entries: [string, CachedSkinEntry][] };

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadValorantSkinsMapFromStorage(): Map<string, CachedSkinEntry> | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || typeof parsed.savedAt !== "number" || !Array.isArray(parsed.entries)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (parsed.entries.length < 100) return null;
    return new Map(parsed.entries);
  } catch {
    return null;
  }
}

export function saveValorantSkinsMapToStorage(map: Map<string, CachedSkinEntry>): void {
  if (!canUseStorage() || map.size < 100) return;
  try {
    const payload: Stored = { savedAt: Date.now(), entries: [...map.entries()] };
    const s = JSON.stringify(payload);
    if (s.length > 4_500_000) return;
    window.localStorage.setItem(STORAGE_KEY, s);
  } catch {
    /* quota */
  }
}
