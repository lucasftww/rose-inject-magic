import type { CartItem } from "@/hooks/useCart";
import { normalizeGameSlug } from "@/lib/gameSlug";
import { inferLztListingGameSlug } from "@/lib/lztListingGameInference";

/**
 * Payload único para **InitiateCheckout** (checkout) e **Purchase** (pedido sucesso / CAPI):
 * regras tipo “IC - Contas - Fortnite” e “Purchase - Contas - Fortnite” usam `section` + `content_category`.
 *
 * Carrinhos antigos / snapshots sem `lztGame`: inferência por `productName` / `planName` (`inferLztListingGameSlug`).
 */
function gameCategorySlugForMetaItem(item: CartItem): string | null {
  const trimmedLzt = typeof item.lztGame === "string" ? item.lztGame.trim() : "";
  const fromFields = normalizeGameSlug(trimmedLzt || item.gameName);
  if (fromFields) return fromFields;
  if (item.type === "lzt-account") return inferLztListingGameSlug(item.productName, item.planName);
  return null;
}

/** `game` na URL de `/pedido/sucesso` — mesma lógica que `content_category` (incl. inferência pelo nome em contas LZT). Regras de conversão na Meta por URL (`game=fortnite`) dependem disso. */
export function deriveGameQueryParamFromCartItems(cartItems: CartItem[]): string | null {
  const games = cartItems.map((i) => gameCategorySlugForMetaItem(i)).filter((g): g is string => !!g);
  const unique = [...new Set(games)];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) return "multi";
  if (cartItems.every((i) => i.type !== "lzt-account")) return "produto";
  return null;
}

/** Fingerprint estável do carrinho para deduplicar `InitiateCheckout` (localStorage partilhado entre abas, TTL curto em `metaPixel`). */
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

  // Derive a stable content_category slug from cart items (campos + inferência por nome).
  const gameNames = items.map((i) => gameCategorySlugForMetaItem(i)).filter((g): g is string => !!g);
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
