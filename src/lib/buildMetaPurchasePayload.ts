import type { CartItem } from "@/hooks/useCart";
import { normalizeGameSlug } from "@/lib/gameSlug";

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

  return { contentName, contentIds, contents, value, ...(contentCategory ? { contentCategory } : {}) };
}
