import type { CartItem } from "@/hooks/useCart";
import { normalizeGameSlug } from "@/lib/gameSlug";
import { inferLztListingGameSlug } from "@/lib/lztListingGameInference";

/** Payload enviado ao `pix-payment` — mantido puro para testes e paridade com Checkout. */
export function buildCartSnapshotFromItems(items: CartItem[]): Record<string, unknown>[] {
  return items.map((i) => {
    const base: Record<string, unknown> = {
      productId: i.productId,
      productName: i.productName,
      productImage: i.productImage,
      planId: i.planId,
      planName: i.planName,
      quantity: i.quantity,
    };
    if (i.type === "lzt-account") {
      base.type = i.type;
      base.lztItemId = i.lztItemId;
      const trimmedLzt = typeof i.lztGame === "string" ? i.lztGame.trim() : "";
      const fromSlug = normalizeGameSlug(trimmedLzt || i.gameName);
      const inferred = inferLztListingGameSlug(i.productName, i.planName);
      const resolvedGame = fromSlug || inferred || "";
      base.lztGame = resolvedGame;
      if (typeof i.gameName === "string" && i.gameName.trim()) base.gameName = i.gameName.trim();
      else if (resolvedGame) base.gameName = resolvedGame;
      base.price = i.price;
      base.lztPrice = i.lztPrice;
      base.lztCurrency = i.lztCurrency;
      if (i.skinsCount != null) base.skinsCount = i.skinsCount;
    } else {
      base.price = i.price;
      if (typeof i.gameName === "string" && i.gameName.trim()) base.gameName = i.gameName.trim();
    }
    return base;
  });
}
