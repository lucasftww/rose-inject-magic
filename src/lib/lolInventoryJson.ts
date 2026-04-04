import { isRecord } from "@/types/ticketChat";

/** Parse seguro de `lolInventory.Skin` serializado em JSON.stringify. */
export function parseLolSkinIdsFromJsonString(jsonStr: string): number[] {
  try {
    const raw: unknown = JSON.parse(jsonStr);
    if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n));
    if (isRecord(raw)) {
      return Object.values(raw)
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n));
    }
  } catch {
    /* ignore */
  }
  return [];
}

/** Parse seguro de `lolInventory.Champion` serializado. */
export function parseLolChampionIdsFromJsonString(jsonStr: string): number[] {
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  } catch {
    /* ignore */
  }
  return [];
}
