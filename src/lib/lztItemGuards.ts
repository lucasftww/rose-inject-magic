/**
 * Re-export da implementação em `supabase/functions/_shared/lztItemGuards.ts`
 * (uma única fonte de verdade — evita drift entre Edge e cliente).
 */

export {
  normalizeLztItemState,
  isLztItemStateSoldOrRemoved,
  isLztItemStateAwaiting,
  hasLztBuyerAssigned,
  hasLztItemBuyerAssigned,
} from "../../supabase/functions/_shared/lztItemGuards.ts";
