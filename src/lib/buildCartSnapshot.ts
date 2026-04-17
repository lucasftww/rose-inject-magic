import type { CartItem } from "@/hooks/useCart";

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
      base.lztGame = i.lztGame || "";
      if (typeof i.gameName === "string" && i.gameName.trim()) base.gameName = i.gameName.trim();
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
