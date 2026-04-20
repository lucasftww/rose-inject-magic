import { safeJsonFetch } from "@/lib/apiUtils";
import type { DDragonChampionJson, DDragonVersionList } from "@/lib/edgeFunctionTypes";

const STORAGE_KEY = "royal-lol-champ-key-map-v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

type Stored = { savedAt: number; entries: [number, string][] };

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadFromStorage(): Map<number, string> | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || typeof parsed.savedAt !== "number" || !Array.isArray(parsed.entries)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (parsed.entries.length < 20) return null;
    return new Map(parsed.entries);
  } catch {
    return null;
  }
}

function saveToStorage(map: Map<number, string>): void {
  if (!canUseStorage() || map.size < 20) return;
  try {
    const payload: Stored = { savedAt: Date.now(), entries: [...map.entries()] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

/** Champion key numérico → id interno Data Dragon (LoL cards / skins). Cache local 7d. */
export async function fetchLolChampKeyMap(): Promise<Map<number, string>> {
  const cached = loadFromStorage();
  if (cached) return cached;
  try {
    const versions = await safeJsonFetch<DDragonVersionList>("https://ddragon.leagueoflegends.com/api/versions.json");
    const version = versions[0];
    if (!version) return new Map();

    const data = await safeJsonFetch<DDragonChampionJson>(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
    );
    const map = new Map<number, string>();
    const champions = data.data ?? {};
    for (const [internalName, champ] of Object.entries(champions)) {
      const keyStr = champ.key;
      if (!keyStr) continue;
      const parsed = parseInt(keyStr, 10);
      if (Number.isFinite(parsed)) map.set(parsed, internalName);
    }
    saveToStorage(map);
    return map;
  } catch (err) {
    console.warn("Failed to fetch LoL champ map:", err);
    return new Map();
  }
}
