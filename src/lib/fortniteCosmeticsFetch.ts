import { safeJsonFetch } from "@/lib/apiUtils";
import type { FortniteCosmeticItem, FortniteCosmeticsResponse } from "@/lib/edgeFunctionTypes";
import { metaFromFortniteApiItem, type FortniteCosmeticDbRow } from "@/lib/fortniteCosmeticSort";
import {
  loadFortniteCosmeticsMapFromStorage,
  saveFortniteCosmeticsMapToStorage,
  waitForIdleBeforeHeavyFetch,
} from "@/lib/fortniteCosmeticsCache";

/**
 * Mapa id → metadados BR (Fortnite API v2). Partilhado entre Contas e FortniteDetalhes;
 * cache local + idle em `fortniteCosmeticsCache`.
 */
export async function fetchFortniteCosmeticsBrMap(): Promise<Map<string, FortniteCosmeticDbRow>> {
  const fromLs = loadFortniteCosmeticsMapFromStorage();
  if (fromLs) return fromLs;
  try {
    await waitForIdleBeforeHeavyFetch();
    const data = await safeJsonFetch<FortniteCosmeticsResponse>(
      "https://fortnite-api.com/v2/cosmetics/br?language=pt-BR",
    );
    const map = new Map<string, FortniteCosmeticDbRow>();
    const raw = data.data;
    const list: FortniteCosmeticItem[] = Array.isArray(raw) ? raw : raw?.items ?? [];
    for (const item of list) {
      const image = item.images?.smallIcon || item.images?.icon || item.images?.featured;
      if (image && item.id) {
        const meta = metaFromFortniteApiItem(item);
        const rarityDisplay = String(item.rarity?.displayValue || item.rarity?.value || "").trim();
        map.set(item.id.toLowerCase(), {
          name: item.name || item.id,
          image,
          ...(rarityDisplay ? { rarityDisplay } : {}),
          rarityValue: meta.rarityValue,
          ageKey: meta.ageKey,
        });
      }
    }
    saveFortniteCosmeticsMapToStorage(map);
    return map;
  } catch (err) {
    console.warn("Failed to fetch Fortnite cosmetics (BR):", err);
    return new Map();
  }
}
