export type GameCategory = "valorant" | "lol" | "fortnite" | "minecraft";

const MIN_PRICE_BRL = 20;

export const useLztMarkup = () => {
  /**
   * Fallback only — prefer using item.price_brl from the API.
   */
  const calcPrice = (price: number, currency?: string, _game?: GameCategory): number => {
    const RUB_TO_BRL = 0.055;
    let brl = price;
    if (currency === "rub" || !currency) {
      brl = price * RUB_TO_BRL;
    }
    // Generic 3.0x fallback — should rarely be used since API provides price_brl
    const final = brl * 3.0;
    return final < MIN_PRICE_BRL ? MIN_PRICE_BRL : final;
  };

  const formatPrice = (price: number, currency?: string, game?: GameCategory): string => {
    return `R$ ${calcPrice(price, currency, game).toFixed(2)}`;
  };

  /**
   * Format a pre-calculated BRL price (from API's price_brl field).
   * This is the PREFERRED method — uses server-side markup.
   */
  const formatPriceBrl = (priceBrl: number): string => {
    return `R$ ${priceBrl.toFixed(2)}`;
  };

  /**
   * Smart price formatter: uses price_brl if available, falls back to calcPrice.
   */
  const getDisplayPrice = (item: { price: number; price_currency?: string; price_brl?: number }, game?: GameCategory): string => {
    if (item.price_brl && item.price_brl > 0) {
      return formatPriceBrl(item.price_brl);
    }
    return formatPrice(item.price, item.price_currency, game);
  };

  /**
   * Smart price calculator: uses price_brl if available, falls back to calcPrice.
   */
  const getPrice = (item: { price: number; price_currency?: string; price_brl?: number }, game?: GameCategory): number => {
    if (item.price_brl && item.price_brl > 0) {
      return item.price_brl;
    }
    return calcPrice(item.price, item.price_currency, game);
  };

  return { calcPrice, formatPrice, formatPriceBrl, getDisplayPrice, getPrice, getMarkupForGame: () => 3.0, config: null, markup: 3.0 };
};
