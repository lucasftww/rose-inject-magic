import type { CartItem } from "@/hooks/useCart";
import { normalizeGameSlug } from "@/lib/gameSlug";

/** Fingerprint estável do carrinho para deduplicar `InitiateCheckout` (localStorage partilhado entre abas, TTL 7d em `metaPixel`). */
export function buildCartFingerprintForMetaIc(
  items: Pick<CartItem, "productId" | "quantity" | "price">[],
): string {
  if (items.length === 0) return "";
  return [...items]
    .map((i) => {
      const id = String(i.productId || "").trim();
      const qty = Math.max(1, Math.floor(Number(i.quantity) || 1));
      const price = Number.isFinite(i.price) && i.price >= 0 ? i.price : 0;
      return `${id}:${qty}:${price.toFixed(4)}`;
    })
    .sort()
    .join("|");
}

/** Payload alinhado com `trackPurchase` / CAPI `pix-payment` para carrinhos multi-linha. */
export function buildMetaPurchasePayloadFromCartItems(
  items: CartItem[],
  value: number,
): {
  contentName: string;
  contentIds: string[];
  contents: { id: string; quantity: number }[];
  value: number;
  contentCategory?: string;
  section?: "contas" | "produtos" | "multi";
} | null {
  if (items.length === 0) return null;
  const contentIds = items.map((i) => i.productId).filter(Boolean);
  if (contentIds.length === 0) return null;
  const contents = items.map((i) => ({
    id: i.productId,
    quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
  }));
  const contentName =
    items.length === 1
      ? items[0].productName
      : (() => {
          const joined = items.map((i) => i.productName).join(", ");
          return joined.length <= 500 ? joined : `${items.length} produtos — ${joined.slice(0, 420)}…`;
        })();

  // Derive a stable content_category slug from cart items.
  const gameNames = items
    .map((i) => normalizeGameSlug(i.lztGame || i.gameName))
    .filter((g): g is string => !!g);
  const uniqueGames = [...new Set(gameNames)];
  const contentCategory = uniqueGames.length === 1
    ? uniqueGames[0]
    : uniqueGames.length > 1
      ? "multi"
      : undefined;
  const allContas = items.every((i) => i.type === "lzt-account");
  const allProdutos = items.every((i) => i.type !== "lzt-account");
  const section: "contas" | "produtos" | "multi" = allContas ? "contas" : allProdutos ? "produtos" : "multi";

  return {
    contentName,
    contentIds,
    contents,
    value,
    section,
    ...(contentCategory ? { contentCategory } : {}),
  };
}
