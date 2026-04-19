/** Barrel: preço LZT partilhado entre Edge (Deno) e app (Vite). */
export {
  DEFAULT_LZT_FX,
  DEFAULT_MARKUP,
  MIN_PRICE_BRL,
  getContentCeilingBrl,
  getContentFloorBrl,
  getDisplayedPriceBrl,
  itemFailsNotSoldBeforePolicy,
  shouldKeepItem,
  type LztFxRates,
} from "../../supabase/functions/_shared/lztPricingModel.ts";
