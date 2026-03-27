export type GameCategory = "valorant" | "lol" | "fortnite" | "minecraft";

const MIN_PRICE_BRL = 20;

export const useLztMarkup = () => {
  /**
   * Fallback only — prefer using item.price_brl from the API.
   */
  const calcPrice = (price: number, currency?: string, _game?: GameCategory): number => {
    const RUB_TO_BRL = 0.055;
    const USD_TO_BRL = 6.10;
    const MARKUP = 3.0;
    const cur = String(currency || "rub").toLowerCase();
    
    let brl = price;
    if (cur === "rub") brl = price * RUB_TO_BRL * MARKUP;
    else if (cur === "usd") brl = price * USD_TO_BRL * MARKUP;
    else brl = price * 2.00; // BRL: increased to 2.00 for 50% margin
    
    // Safety: ensure minimum 50% margin even on fallback calculations
    const costBrl = cur === "rub" ? price * RUB_TO_BRL : cur === "usd" ? price * USD_TO_BRL : price;
    const minPrice = costBrl * 2.00; // Guarantee 50% margin
    if (brl < minPrice) brl = minPrice;


    return brl < MIN_PRICE_BRL ? MIN_PRICE_BRL : brl;
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
