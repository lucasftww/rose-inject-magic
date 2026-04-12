/**
 * Modelo de preço LZT (listagem, detalhe, checkout) — uma fonte para Edge + app (Vite).
 * Mantém paridade com a lógica histórica em `lzt-market` (piso/teto por conteúdo, margem mínima).
 */
import { hasLztItemBuyerAssigned } from "./lztItemGuards.ts";

export const MIN_PRICE_BRL = 20;
export const DEFAULT_MARKUP = 3.0;

export type LztFxRates = { rub: number; usd: number };

/** Fallbacks alinhados ao edge antes do fetch FX. */
export const DEFAULT_LZT_FX: LztFxRates = { rub: 0.055, usd: 5.16 };

export type LztItemLike = Record<string, unknown>;

export function getContentFloorBrl(item: LztItemLike, gameType?: string): number {
  if (gameType === "fortnite") {
    const skins = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
    const vbucks = Math.min(Number(item.fortnite_vbucks || item.fortnite_balance || 0), 50000);
    const level = Math.min(Number(item.fortnite_level || 0), 500);
    return skins * 0.35 + vbucks * 0.005 + level * 0.1;
  }
  if (gameType === "lol") {
    const skins = Number(item.riot_lol_skin_count || 0);
    const champs = Number(item.riot_lol_champion_count || 0);
    const level = Math.min(Number(item.riot_lol_level || 0), 350);
    return skins * 0.5 + champs * 0.15 + level * 0.1;
  }
  if (gameType === "minecraft") {
    const capes = Number(item.minecraft_capes_count || 0);
    const level = Math.min(Number(item.minecraft_hypixel_level || 0), 300);
    const hasJava = Number(item.minecraft_java || 0);
    const hasBedrock = Number(item.minecraft_bedrock || 0);
    return capes * 2 + level * 0.1 + hasJava * 3 + hasBedrock * 3;
  }
  const skins = Number(item.riot_valorant_skin_count || 0);
  const knives = Number(item.riot_valorant_knife || item.riot_valorant_knife_count || 0);
  const level = Math.min(Number(item.riot_valorant_level || 0), 500);
  return skins * 0.6 + knives * 5 + level * 0.08;
}

export function getContentCeilingBrl(item: LztItemLike, gameType?: string): number {
  if (gameType === "fortnite") {
    const skins = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
    const vbucks = Math.min(Number(item.fortnite_vbucks || item.fortnite_balance || 0), 50000);
    const level = Math.min(Number(item.fortnite_level || 0), 999);
    const ceiling = skins * 10 + vbucks * 0.02 + level * 0.5;
    return Math.max(ceiling, MIN_PRICE_BRL);
  }
  if (gameType === "lol") {
    const skins = Number(item.riot_lol_skin_count || 0);
    const champs = Number(item.riot_lol_champion_count || 0);
    const level = Math.min(Number(item.riot_lol_level || 0), 500);
    const rank = String(item.riot_lol_rank || "").toUpperCase();
    let ceiling = skins * 2.5 + champs * 0.8 + level * 0.3;
    if (rank.includes("MASTER") || rank.includes("GRANDMASTER") || rank.includes("CHALLENGER")) ceiling += 120;
    else if (rank.includes("DIAMOND")) ceiling += 60;
    else if (rank.includes("EMERALD")) ceiling += 40;
    else if (rank.includes("PLATINUM")) ceiling += 25;
    else if (rank.includes("GOLD")) ceiling += 15;
    return Math.max(ceiling, MIN_PRICE_BRL);
  }
  if (gameType === "minecraft") {
    const capes = Number(item.minecraft_capes_count || 0);
    const level = Math.min(Number(item.minecraft_hypixel_level || 0), 300);
    const hasJava = Number(item.minecraft_java || 0);
    const hasBedrock = Number(item.minecraft_bedrock || 0);
    const hasDungeons = Number(item.minecraft_dungeons || 0);
    const hasLegends = Number(item.minecraft_legends || 0);
    let ceiling = capes * 15 + level * 0.5 + hasJava * 20 + hasBedrock * 15 + hasDungeons * 10 + hasLegends * 10;
    const rankStr = String(item.minecraft_hypixel_rank || "").toUpperCase();
    if (rankStr.includes("MVP+")) ceiling += 40;
    else if (rankStr.includes("MVP")) ceiling += 25;
    else if (rankStr.includes("VIP+")) ceiling += 15;
    else if (rankStr.includes("VIP")) ceiling += 8;
    return Math.max(ceiling, MIN_PRICE_BRL);
  }
  const skins = Number(item.riot_valorant_skin_count || 0);
  const knives = Number(item.riot_valorant_knife || item.riot_valorant_knife_count || 0);
  const agents = Number(item.riot_valorant_agent_count || 0);
  const level = Math.min(Number(item.riot_valorant_level || 0), 500);
  const rank = Number(item.riot_valorant_rank || 0);
  const vp = Number(item.riot_valorant_wallet_vp || 0);
  const invValue = Number(item.riot_valorant_inventory_value || 0);

  let ceiling = skins * 5 + knives * 30 + agents * 1.5 + level * 0.15 + vp * 0.01;
  if (invValue > 0) ceiling += invValue * 0.003;

  if (rank >= 27) ceiling += 150;
  else if (rank >= 24) ceiling += 80;
  else if (rank >= 21) ceiling += 50;
  else if (rank >= 18) ceiling += 35;
  else if (rank >= 15) ceiling += 20;
  else if (rank >= 12) ceiling += 10;

  return Math.max(ceiling, MIN_PRICE_BRL);
}

/**
 * Preço final em BRL (vitrine + validação server-side sem lock de cliente).
 */
export function getDisplayedPriceBrl(
  item: LztItemLike,
  overridePrice: number | undefined,
  gameType: string | undefined,
  markup?: number,
  rates: LztFxRates = DEFAULT_LZT_FX,
): number {
  if (typeof overridePrice === "number" && overridePrice > 0) return Math.round(overridePrice * 100) / 100;

  const activeMarkup = markup != null && Number.isFinite(markup) && markup >= 1 ? markup : DEFAULT_MARKUP;
  const rub = rates.rub > 0 ? rates.rub : DEFAULT_LZT_FX.rub;
  const usd = rates.usd > 0 ? rates.usd : DEFAULT_LZT_FX.usd;

  const currency = String(item.price_currency || "rub").toLowerCase();
  const rawPrice = Number(item.price || 0);

  let costBrl: number;
  let rawMarkedUp: number;

  if (currency === "rub") {
    costBrl = rawPrice * rub;
    rawMarkedUp = costBrl * activeMarkup;
  } else if (currency === "usd") {
    costBrl = rawPrice * usd;
    rawMarkedUp = costBrl * activeMarkup;
  } else {
    costBrl = rawPrice;
    rawMarkedUp = rawPrice * activeMarkup;
  }

  let final = rawMarkedUp;

  const contentFloor = getContentFloorBrl(item, gameType);
  if (final < contentFloor) final = contentFloor;

  const contentCeiling = getContentCeilingBrl(item, gameType);
  const effectiveCeiling = Math.max(contentCeiling, rawMarkedUp);
  if (final > effectiveCeiling) final = effectiveCeiling;

  const minMarginPrice = costBrl * 2.0;
  if (final < minMarginPrice) final = minMarginPrice;

  const MIN_PROFIT_BRL = 20.0;
  const safeProfitPrice = costBrl + MIN_PROFIT_BRL;
  if (final < safeProfitPrice) final = safeProfitPrice;

  return final < MIN_PRICE_BRL ? MIN_PRICE_BRL : Math.round(final * 100) / 100;
}

export function itemFailsNotSoldBeforePolicy(item: LztItemLike): boolean {
  const nsb = item.not_sold_before ?? item.notSoldBefore;
  if (nsb === false || nsb === 0 || nsb === "0") return true;
  const sb = item.sold_before ?? item.soldBefore;
  if (sb === true || sb === 1 || sb === "1") return true;
  return false;
}

export function shouldKeepItem(
  item: LztItemLike,
  gameType: string,
  _displayedPriceBrl: number,
  opts?: { skipValueGate?: boolean; skipMinSkins?: boolean; skipCanBuyCheck?: boolean },
  rates: LztFxRates = DEFAULT_LZT_FX,
): boolean {
  if (hasLztItemBuyerAssigned(item)) return false;
  if (!opts?.skipCanBuyCheck && item.canBuyItem === false) return false;
  if (itemFailsNotSoldBeforePolicy(item)) return false;

  if (!opts?.skipMinSkins) {
    const isValorant = gameType === "riot" || gameType === "valorant";
    if (isValorant) {
      const skins = Number(item.riot_valorant_skin_count || 0);
      if (skins < 5) return false;
    }
    if (gameType === "lol") {
      const skins = Number(item.riot_lol_skin_count || 0);
      if (skins < 10) return false;
    }
    if (gameType === "fortnite") {
      const skins = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
      if (skins < 10) return false;
    }
  }

  if (opts?.skipValueGate) return true;

  const rub = rates.rub > 0 ? rates.rub : DEFAULT_LZT_FX.rub;
  const usd = rates.usd > 0 ? rates.usd : DEFAULT_LZT_FX.usd;
  const currency = String(item.price_currency || "rub").toLowerCase();
  const rawPrice = Number(item.price || 0);
  const costBrl = currency === "rub" ? rawPrice * rub
    : currency === "usd" ? rawPrice * usd
    : rawPrice;
  if (costBrl > 0) {
    const contentCeiling = getContentCeilingBrl(item, gameType);
    const valueGateRatio = gameType === "fortnite" ? 0.2 : 0.4;
    if (contentCeiling < costBrl * valueGateRatio) return false;
  }

  return true;
}
