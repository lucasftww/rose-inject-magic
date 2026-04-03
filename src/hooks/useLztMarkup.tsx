import { useCallback, useMemo } from "react";

export type GameCategory = "valorant" | "lol" | "fortnite" | "minecraft";

const MIN_PRICE_BRL = 20;

export type LztPriceInput = {
  price?: number;
  price_currency?: string;
  price_brl?: number;
};

function isValidPriceBrl(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function coalesceNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Fallback BRL when `price_brl` from the API is missing — keep in sync with edge `lzt-market` heuristics as much as practical.
 */
export function calcLztFallbackBrl(price: number, currency?: string, _game?: GameCategory): number {
  const raw = coalesceNum(price);
  const RUB_TO_BRL = 0.055;
  const USD_TO_BRL = 6.10;
  const MARKUP = 3.0;
  const cur = String(currency || "rub").toLowerCase();

  let brl = raw;
  if (cur === "rub") brl = raw * RUB_TO_BRL * MARKUP;
  else if (cur === "usd") brl = raw * USD_TO_BRL * MARKUP;
  else brl = raw * 2.0;

  const costBrl = cur === "rub" ? raw * RUB_TO_BRL : cur === "usd" ? raw * USD_TO_BRL : raw;
  const minPrice = costBrl * 2.0;
  if (brl < minPrice) brl = minPrice;

  return brl < MIN_PRICE_BRL ? MIN_PRICE_BRL : brl;
}

/**
 * Numeric BRL for display/sorting — prefers API `price_brl`, else fallback conversion.
 */
export function getLztItemBrlPrice(item: LztPriceInput, game?: GameCategory): number {
  if (isValidPriceBrl(item.price_brl)) return item.price_brl;
  return calcLztFallbackBrl(coalesceNum(item.price), item.price_currency, game);
}

export const useLztMarkup = () => {
  const formatPriceBrl = useCallback((priceBrl: number): string => {
    if (!Number.isFinite(priceBrl)) return "R$ —";
    return `R$ ${priceBrl.toFixed(2)}`;
  }, []);

  const calcPrice = useCallback((price: number, currency?: string, game?: GameCategory): number => calcLztFallbackBrl(price, currency, game), []);

  const formatPrice = useCallback((price: number, currency?: string, game?: GameCategory): string => {
    return `R$ ${calcLztFallbackBrl(coalesceNum(price), currency, game).toFixed(2)}`;
  }, []);

  const getDisplayPrice = useCallback(
    (item: LztPriceInput, game?: GameCategory): string => {
      if (isValidPriceBrl(item.price_brl)) {
        return formatPriceBrl(item.price_brl);
      }
      return formatPrice(coalesceNum(item.price), item.price_currency, game);
    },
    [formatPrice, formatPriceBrl],
  );

  const getPrice = useCallback((item: LztPriceInput, game?: GameCategory): number => getLztItemBrlPrice(item, game), []);

  return useMemo(
    () => ({
      calcPrice,
      formatPrice,
      formatPriceBrl,
      getDisplayPrice,
      getPrice,
      getMarkupForGame: () => 3.0,
      config: null,
      markup: 3.0,
    }),
    [calcPrice, formatPrice, formatPriceBrl, getDisplayPrice, getPrice],
  );
};
