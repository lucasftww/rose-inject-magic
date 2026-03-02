import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const RUB_TO_BRL = 0.055;

export type GameCategory = "valorant" | "lol" | "fortnite" | "minecraft";

interface LztConfig {
  markup_multiplier: number;
  max_fetch_price: number;
  markup_valorant: number;
  markup_lol: number;
  markup_fortnite: number;
  markup_minecraft: number;
}

export const useLztMarkup = () => {
  const { data: config } = useQuery({
    queryKey: ["lzt-config-markup"],
    queryFn: async (): Promise<LztConfig> => {
      const { data } = await supabase
        .from("lzt_config")
        .select("markup_multiplier, max_fetch_price, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
        .limit(1)
        .maybeSingle();
      return {
        markup_multiplier: (data as any)?.markup_multiplier ?? 1.5,
        max_fetch_price: (data as any)?.max_fetch_price ?? 500,
        markup_valorant: (data as any)?.markup_valorant ?? 1.5,
        markup_lol: (data as any)?.markup_lol ?? 1.5,
        markup_fortnite: (data as any)?.markup_fortnite ?? 1.5,
        markup_minecraft: (data as any)?.markup_minecraft ?? 1.5,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const markup = config?.markup_multiplier ?? 1.5;

  const MIN_PRICE_BRL = 20;

  const getMarkupForGame = (game?: GameCategory): number => {
    if (!config || !game) return markup;
    switch (game) {
      case "valorant": return config.markup_valorant;
      case "lol": return config.markup_lol;
      case "fortnite": return config.markup_fortnite;
      case "minecraft": return config.markup_minecraft;
      default: return markup;
    }
  };

  /**
   * Converts an LZT price to BRL with markup applied.
   * @param price - raw price from LZT
   * @param currency - price currency (default "rub")
   * @param game - optional game category for per-game markup
   * @returns price in BRL with markup
   */
  const calcPrice = (price: number, currency?: string, game?: GameCategory): number => {
    let brl = price;
    if (currency === "rub" || !currency) {
      brl = price * RUB_TO_BRL;
    }
    const gameMarkup = getMarkupForGame(game);
    const final = brl * gameMarkup;
    return final < MIN_PRICE_BRL ? MIN_PRICE_BRL : final;
  };

  /**
   * Formats the price as "R$ XX.XX"
   */
  const formatPrice = (price: number, currency?: string, game?: GameCategory): string => {
    return `R$ ${calcPrice(price, currency, game).toFixed(2)}`;
  };

  return { markup, calcPrice, formatPrice, getMarkupForGame, config };
};
