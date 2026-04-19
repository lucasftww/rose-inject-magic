import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_LZT_FX,
  DEFAULT_MARKUP,
  getDisplayedPriceBrl,
  type LztFxRates,
} from "@/lib/lztPricingModel";

export type GameCategory = "valorant" | "lol" | "fortnite" | "minecraft";

type LztPriceInput = {
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

type StorefrontPricing = LztFxRates & {
  fallbackMarkup: number;
  markupByGame: Record<GameCategory, number>;
};

function toMarkup(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/** Query key partilhada com prefetch em `App` (Contas / detalhes). */
export const LZT_STOREFRONT_PRICING_QUERY_KEY = ["lzt-storefront-pricing"] as const;

async function fetchAwesomeFxCappedMs(timeoutMs: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const tid = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,RUB-BRL", { signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    window.clearTimeout(tid);
  }
}

export async function fetchStorefrontPricing(): Promise<StorefrontPricing> {
  const [fxRes, cfgRes] = await Promise.all([
    fetchAwesomeFxCappedMs(2000),
    supabase
      .from("lzt_config")
      .select("markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
      .limit(1)
      .maybeSingle(),
  ]);

  let rub = DEFAULT_LZT_FX.rub;
  let usd = DEFAULT_LZT_FX.usd;
  if (fxRes && fxRes.ok) {
    try {
      const fxData = await fxRes.json();
      const usdBid = Number(fxData?.USDBRL?.bid);
      const rubBid = Number(fxData?.RUBBRL?.bid);
      if (usdBid > 0) usd = usdBid;
      if (rubBid > 0) rub = rubBid;
    } catch {
      /* keep defaults */
    }
  }

  const row = cfgRes.data;
  const fb = toMarkup(row?.markup_multiplier, DEFAULT_MARKUP);

  return {
    rub,
    usd,
    fallbackMarkup: fb,
    markupByGame: {
      valorant: toMarkup(row?.markup_valorant, fb),
      lol: toMarkup(row?.markup_lol, fb),
      fortnite: toMarkup(row?.markup_fortnite, fb),
      minecraft: toMarkup(row?.markup_minecraft, fb),
    },
  };
}

function itemRowFromPriceInput(input: LztPriceInput): Record<string, unknown> {
  return {
    price: input.price,
    price_currency: input.price_currency,
  };
}

type LztPricingContext = { rates: LztFxRates; markup: number };

/**
 * Fallback BRL quando `price_brl` falha — alinhado ao modelo `getDisplayedPriceBrl` da edge.
 * Sem `ctx`, usa FX/markup padrão (testes e primeiro paint).
 */
export function calcLztFallbackBrl(
  price: number,
  currency?: string,
  game?: GameCategory,
  ctx?: LztPricingContext,
): number {
  const rates = ctx?.rates ?? DEFAULT_LZT_FX;
  const markup = ctx?.markup ?? DEFAULT_MARKUP;
  const item = itemRowFromPriceInput({ price, price_currency: currency });
  return getDisplayedPriceBrl(item, undefined, game, markup, rates);
}

export function getLztItemBrlPrice(item: LztPriceInput, game?: GameCategory, ctx?: LztPricingContext): number {
  if (isValidPriceBrl(item.price_brl)) return item.price_brl;
  const rates = ctx?.rates ?? DEFAULT_LZT_FX;
  const markup = ctx?.markup ?? DEFAULT_MARKUP;
  return getDisplayedPriceBrl(itemRowFromPriceInput(item), undefined, game, markup, rates);
}

export const useLztMarkup = () => {
  const { data: pricing } = useQuery({
    queryKey: LZT_STOREFRONT_PRICING_QUERY_KEY,
    queryFn: fetchStorefrontPricing,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const rub = pricing?.rub ?? DEFAULT_LZT_FX.rub;
  const usd = pricing?.usd ?? DEFAULT_LZT_FX.usd;
  const fallbackMarkup = pricing?.fallbackMarkup ?? DEFAULT_MARKUP;
  const mv = pricing?.markupByGame?.valorant ?? fallbackMarkup;
  const ml = pricing?.markupByGame?.lol ?? fallbackMarkup;
  const mf = pricing?.markupByGame?.fortnite ?? fallbackMarkup;
  const mm = pricing?.markupByGame?.minecraft ?? fallbackMarkup;

  const rates = useMemo(() => ({ rub, usd }), [rub, usd]);

  const markupForGame = useCallback(
    (game?: GameCategory) => {
      if (!game) return fallbackMarkup;
      return game === "valorant" ? mv : game === "lol" ? ml : game === "fortnite" ? mf : mm;
    },
    [mv, ml, mf, mm, fallbackMarkup],
  );

  const pricingCtx = useCallback(
    (game?: GameCategory): LztPricingContext => ({ rates, markup: markupForGame(game) }),
    [rates, markupForGame],
  );

  const formatPriceBrl = useCallback((priceBrl: number): string => {
    if (!Number.isFinite(priceBrl)) return "R$ —";
    return `R$ ${priceBrl.toFixed(2)}`;
  }, []);

  const calcPrice = useCallback(
    (price: number, currency?: string, game?: GameCategory): number =>
      calcLztFallbackBrl(price, currency, game, pricingCtx(game)),
    [pricingCtx],
  );

  const formatPrice = useCallback(
    (price: number, currency?: string, game?: GameCategory): string => {
      const brl = calcLztFallbackBrl(coalesceNum(price), currency, game, pricingCtx(game));
      if (!Number.isFinite(brl)) return "R$ —";
      return `R$ ${brl.toFixed(2)}`;
    },
    [pricingCtx],
  );

  const getDisplayPrice = useCallback(
    (item: LztPriceInput, game?: GameCategory): string => {
      if (isValidPriceBrl(item.price_brl)) {
        return formatPriceBrl(item.price_brl);
      }
      return formatPrice(coalesceNum(item.price), item.price_currency, game);
    },
    [formatPrice, formatPriceBrl],
  );

  const getPrice = useCallback(
    (item: LztPriceInput, game?: GameCategory): number => getLztItemBrlPrice(item, game, pricingCtx(game)),
    [pricingCtx],
  );

  return useMemo(
    () => ({
      calcPrice,
      formatPrice,
      formatPriceBrl,
      getDisplayPrice,
      getPrice,
      getMarkupForGame: markupForGame,
      config: pricing ?? null,
      markup: fallbackMarkup,
      rates,
    }),
    [calcPrice, formatPrice, formatPriceBrl, getDisplayPrice, getPrice, markupForGame, pricing, fallbackMarkup, rates],
  );
};
