/**
 * Shared Valorant rank map, rarity data, and skin fetching utilities.
 * Centralizes duplicated data from Index, Contas, and ContaDetalhes pages.
 */

import rankFerro from "@/assets/rank-ferro.png";
import rankBronze from "@/assets/rank-bronze.png";
import rankPrata from "@/assets/rank-prata.png";
import rankOuro from "@/assets/rank-ouro.png";
import rankPlatina from "@/assets/rank-platina.png";
import rankDiamante from "@/assets/rank-diamante.png";
import rankAscendente from "@/assets/rank-ascendente.png";
import rankImortal from "@/assets/rank-imortal.png";
import rankRadianteNew from "@/assets/rank-radiante-new.png";
import rankUnranked from "@/assets/rank-unranked.png";

import raritySelect from "@/assets/rarity-select.png";
import rarityDeluxe from "@/assets/rarity-deluxe.png";
import rarityPremium from "@/assets/rarity-premium.png";
import rarityUltra from "@/assets/rarity-ultra.png";
import rarityExclusive from "@/assets/rarity-exclusive.png";

// ─── Rank images (re-exported for convenience) ───
export {
  rankFerro, rankBronze, rankPrata, rankOuro, rankPlatina,
  rankDiamante, rankAscendente, rankImortal, rankRadianteNew,
  rankUnranked,
};

// ─── Valorant rank map (used by Index, Contas, ContaDetalhes) ───
export const rankMap: Record<number, { name: string; img: string }> = {
  0: { name: "Unranked", img: rankUnranked },
  1: { name: "Unranked", img: rankUnranked },
  2: { name: "Unranked", img: rankUnranked },
  3: { name: "Ferro 1", img: rankFerro },
  4: { name: "Ferro 2", img: rankFerro },
  5: { name: "Ferro 3", img: rankFerro },
  6: { name: "Bronze 1", img: rankBronze },
  7: { name: "Bronze 2", img: rankBronze },
  8: { name: "Bronze 3", img: rankBronze },
  9: { name: "Prata 1", img: rankPrata },
  10: { name: "Prata 2", img: rankPrata },
  11: { name: "Prata 3", img: rankPrata },
  12: { name: "Ouro 1", img: rankOuro },
  13: { name: "Ouro 2", img: rankOuro },
  14: { name: "Ouro 3", img: rankOuro },
  15: { name: "Platina 1", img: rankPlatina },
  16: { name: "Platina 2", img: rankPlatina },
  17: { name: "Platina 3", img: rankPlatina },
  18: { name: "Diamante 1", img: rankDiamante },
  19: { name: "Diamante 2", img: rankDiamante },
  20: { name: "Diamante 3", img: rankDiamante },
  21: { name: "Ascendente 1", img: rankAscendente },
  22: { name: "Ascendente 2", img: rankAscendente },
  23: { name: "Ascendente 3", img: rankAscendente },
  24: { name: "Imortal 1", img: rankImortal },
  25: { name: "Imortal 2", img: rankImortal },
  26: { name: "Imortal 3", img: rankImortal },
  27: { name: "Radiante", img: rankRadianteNew },
};

// ─── Rarity ───
export const RARITY_PRIORITY: Record<string, number> = {
  "411e4a55-4e59-7757-41f0-86a53f101bb5": 5, // Exclusive
  "e046854e-406c-37f4-6571-7a8baeeb93ab": 4, // Ultra
  "60bca009-4182-7998-dee7-b8a2558dc369": 3, // Premium
  "12683d76-48d7-84a3-4e09-6985794f0445": 2, // Deluxe
  "0cebb8be-46d7-c12a-d306-e9907bfc5a25": 1, // Select
};

export const rarityMap: Record<string, { name: string; img: string; color: string }> = {
  "0cebb8be-46d7-c12a-d306-e9907bfc5a25": { name: "Select", img: raritySelect, color: "hsl(210, 55%, 60%)" },
  "12683d76-48d7-84a3-4e09-6985794f0445": { name: "Deluxe", img: rarityDeluxe, color: "hsl(170, 55%, 45%)" },
  "60bca009-4182-7998-dee7-b8a2558dc369": { name: "Premium", img: rarityPremium, color: "hsl(330, 50%, 55%)" },
  "e046854e-406c-37f4-6571-7a8baeeb93ab": { name: "Ultra", img: rarityUltra, color: "hsl(45, 70%, 55%)" },
  "411e4a55-4e59-7757-41f0-86a53f101bb5": { name: "Exclusive", img: rarityExclusive, color: "hsl(25, 65%, 55%)" },
};

// ─── Skin entry type & fetcher ───
export type SkinEntry = { name: string; image: string; rarity: number };

export const fetchAllValorantSkins = async (): Promise<Map<string, SkinEntry>> => {
  const { loadValorantSkinsMapFromStorage, saveValorantSkinsMapToStorage } = await import(
    "@/lib/valorantSkinsCache",
  );
  const fromLs = loadValorantSkinsMapFromStorage();
  if (fromLs) return fromLs;

  const map = new Map<string, SkinEntry>();

  try {
    const [skinsRes, agentsRes, buddiesRes] = await Promise.all([
      fetch("https://valorant-api.com/v1/weapons/skins?language=pt-BR"),
      fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=pt-BR"),
      fetch("https://valorant-api.com/v1/buddies?language=pt-BR"),
    ]);

    if (skinsRes.ok) {
      const data = await skinsRes.json();
      for (const s of data.data || []) {
        const image = s.levels?.[0]?.displayIcon || s.displayIcon || s.chromas?.[0]?.fullRender;
        if (!image) continue;
        const rarity = RARITY_PRIORITY[s.contentTierUuid?.toLowerCase()] || 0;
        const entry: SkinEntry = { name: s.displayName, image, rarity };
        if (s.uuid) map.set(s.uuid.toLowerCase(), entry);
        for (const level of s.levels || []) {
          if (level.uuid) map.set(level.uuid.toLowerCase(), entry);
        }
        for (const chroma of s.chromas || []) {
          if (chroma.uuid) map.set(chroma.uuid.toLowerCase(), entry);
        }
      }
    }
    if (agentsRes.ok) {
      const data = await agentsRes.json();
      for (const a of data.data || []) {
        const image = a.displayIcon || a.fullPortrait || a.bustPortrait;
        if (!image || !a.uuid) continue;
        map.set(a.uuid.toLowerCase(), { name: a.displayName, image, rarity: 0 });
      }
    }
    if (buddiesRes.ok) {
      const data = await buddiesRes.json();
      for (const b of data.data || []) {
        const image = b.displayIcon;
        if (!image || !b.uuid) continue;
        const entry: SkinEntry = { name: b.displayName, image, rarity: 0 };
        if (b.uuid) map.set(b.uuid.toLowerCase(), entry);
        for (const level of b.levels || []) {
          if (level.uuid) map.set(level.uuid.toLowerCase(), entry);
        }
      }
    }
  } catch (e: unknown) {
    console.warn("valorant-api parallel fetch failed:", e);
  }

  saveValorantSkinsMapToStorage(map);
  return map;
};
