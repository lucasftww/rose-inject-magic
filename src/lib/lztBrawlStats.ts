/**
 * Extrai estatísticas Brawl Stars do JSON cru do LZT (listagem/detalhe).
 * Manter alinhado com `supabase/functions/_shared/lztPricingModel.ts` (`brawlstarsListedBrawlerCount` e ramo brawlstars em `getContentFloorBrl`).
 */

function finiteNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Contagem de brawlers — a listagem LZT às vezes só envia arrays (`brawlers`, `supercell_brawlers`). */
export function brawlersCountFromLztItem(o: Record<string, unknown>): number {
  const fromFields = finiteNum(
    o.brawlers_count ?? o.brawl_brawlers_count ?? o.supercell_brawlers_count ?? o.brawler_count ?? 0,
  );
  if (fromFields > 0) return Math.max(0, Math.trunc(fromFields));
  if (Array.isArray(o.brawler)) return o.brawler.filter((x) => x != null && x !== "").length;
  if (Array.isArray(o.brawlers)) return o.brawlers.filter((x) => x != null && x !== "").length;
  const sb = o.supercell_brawlers;
  if (Array.isArray(sb)) return sb.filter((x) => x != null && x !== "").length;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) return Object.keys(sb as Record<string, unknown>).length;
  return Math.max(0, Math.trunc(fromFields));
}

export function brawlTrophiesFromLztItem(o: Record<string, unknown>): number {
  const cups = finiteNum(
    o.brawl_cups ?? o.brawl_cup ?? o.brawl_trophies ?? o.supercell_brawl_cup ?? 0,
  );
  return Math.max(0, Math.trunc(cups));
}

export function brawlLevelFromLztItem(o: Record<string, unknown>): number {
  const lvl = finiteNum(o.brawl_level ?? 0);
  return Math.max(0, Math.min(Math.trunc(lvl), 999));
}
