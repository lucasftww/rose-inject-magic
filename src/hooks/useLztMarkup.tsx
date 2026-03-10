export type GameCategory = "valorant" | "lol" | "fortnite" | "minecraft";

const MIN_PRICE_BRL = 20;

export const useLztMarkup = () => {
  /**
   * If the item has price_brl from the API, use it directly.
   * Otherwise fall back to a basic calculation (for display only).
   */
  const calcPrice = (price: number, currency?: string, _game?: GameCategory): number => {
    // This is a fallback only — the edge function now returns price_brl
    const RUB_TO_BRL = 0.055;
    let brl = price;
    if (currency === "rub" || !currency) {
      brl = price * RUB_TO_BRL;
    }
    // Use a generic 1.5x fallback markup for display if API didn't provide price_brl
    const final = brl * 1.5;
    return final < MIN_PRICE_BRL ? MIN_PRICE_BRL : final;
  };

  const formatPrice = (price: number, currency?: string, game?: GameCategory): string => {
    return `R$ ${calcPrice(price, currency, game).toFixed(2)}`;
  };

  /**
   * Format a pre-calculated BRL price (from API's price_brl field)
   */
  const formatPriceBrl = (priceBrl: number): string => {
    return `R$ ${priceBrl.toFixed(2)}`;
  };

  return { calcPrice, formatPrice, formatPriceBrl, getMarkupForGame: () => 1.5, config: null, markup: 1.5 };
};
