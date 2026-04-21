/**
 * Heurística partilhada: slug de jogo para Meta (`content_category`), snapshot de pagamento (`lztGame`)
 * e carrinho restaurado do localStorage quando `lztGame`/`gameName` faltam.
 * Mantém regex alinhada a `buildMetaPurchasePayload` / `pix-payment`.
 */
export function inferLztListingGameSlug(...parts: unknown[]): string | null {
  const combined = parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join(" ");
  if (!combined.trim()) return null;
  const n = combined
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!n.trim()) return null;
  if (/\bfortnite\b|v-?bucks|vbucks|battle\s*royale/.test(n)) return "fortnite";
  if (/\bminecraft\b|hypixel|minecoins?|skyblock/.test(n)) return "minecraft";
  if (/\bleague\s+of\s+legends\b|\blol\b|champion|summoner/.test(n)) return "lol";
  if (/\bvalorant\b|radiante|radiant|immortal|\bvp\b|vandal|phantom/.test(n)) return "valorant";
  return null;
}
