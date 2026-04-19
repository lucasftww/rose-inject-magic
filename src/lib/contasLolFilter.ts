import type { LztItem } from "./contasMarketTypes";

/** Drop obvious Valorant listings that leak into LoL API responses. */
export function isLikelyWrongGameInLolList(item: LztItem): boolean {
  const t = item.title || "";
  const smellsValorant =
    /\b(knives?|vandal|phantom|spectre|bulldog|operator|valorant)\b/i.test(t) &&
    !/\b(league|lol|champion|ranked|skins?)\b/i.test(t);
  if (!smellsValorant) return false;
  const hasLol =
    (item.riot_lol_skin_count ?? 0) >= 15 ||
    (item.riot_lol_champion_count ?? 0) >= 30 ||
    !!(
      item.lolInventory?.Skin &&
      (Array.isArray(item.lolInventory.Skin)
        ? item.lolInventory.Skin.length
        : Object.keys(item.lolInventory.Skin).length) > 0
    );
  return !hasLol;
}
