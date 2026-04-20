/**
 * Ordenação de cosméticos Fortnite para vitrine (cards) e galeria:
 * maior raridade primeiro; na mesma raridade, temporada de introdução mais antiga primeiro (OG).
 */

export type FortniteCosmeticDbRow = {
  name: string;
  image: string;
  /** `rarity.displayValue` / `rarity.value` (UI — ex. FortniteDetalhes). */
  rarityDisplay?: string;
  /** `rarity.value` da Fortnite API (lowercase). */
  rarityValue: string;
  /** Menor = temporada mais antiga no Capítulo X; 999999 = sem intro (ex.: loja). */
  ageKey: number;
};

const RARITY_SCORE: Record<string, number> = {
  mythic: 60,
  transcendent: 58,
  series: 55,
  legendary: 50,
  exotic: 45,
  epic: 35,
  rare: 25,
  uncommon: 15,
  common: 5,
};

export function raritySortScore(rarityValue: string): number {
  const v = String(rarityValue || "").toLowerCase().trim();
  if (v && RARITY_SCORE[v] != null) return RARITY_SCORE[v];
  return 8;
}

/** Extrai capítulo/temporada de introdução (Battle Pass / era). */
export function ageKeyFromIntroduction(introduction: unknown): number {
  if (!introduction || typeof introduction !== "object") return 999999;
  const o = introduction as Record<string, unknown>;
  const ch = parseInt(String(o.chapter ?? ""), 10);
  const se = parseInt(String(o.season ?? ""), 10);
  if (!Number.isFinite(ch) || ch < 0 || !Number.isFinite(se) || se < 0) return 999999;
  return ch * 100 + Math.min(se, 99);
}

export function metaFromFortniteApiItem(item: {
  rarity?: { value?: string };
  introduction?: unknown;
}): Pick<FortniteCosmeticDbRow, "rarityValue" | "ageKey"> {
  const rarityValue = String(item.rarity?.value || "").toLowerCase();
  return {
    rarityValue,
    ageKey: ageKeyFromIntroduction(item.introduction),
  };
}

/** Retorna &lt; 0 se `a` deve aparecer antes de `b` na vitrine. */
export function compareFortniteCardRows(a: FortniteCosmeticDbRow, b: FortniteCosmeticDbRow): number {
  const ra = raritySortScore(a.rarityValue);
  const rb = raritySortScore(b.rarityValue);
  if (ra !== rb) return rb - ra;
  if (a.ageKey !== b.ageKey) return a.ageKey - b.ageKey;
  return a.name.localeCompare(b.name, "pt-BR");
}
