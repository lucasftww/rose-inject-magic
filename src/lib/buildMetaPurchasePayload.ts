import type { CartItem } from "@/hooks/useCart";

/** Payload alinhado com `trackPurchase` / CAPI `pix-payment` para carrinhos multi-linha. */
export function buildMetaPurchasePayloadFromCartItems(
  items: CartItem[],
  value: number,
): {
  contentName: string;
  contentIds: string[];
  contents: { id: string; quantity: number }[];
  value: number;
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
  return { contentName, contentIds, contents, value };
}
