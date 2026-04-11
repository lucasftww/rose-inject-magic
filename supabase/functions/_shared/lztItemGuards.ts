/**
 * Fonte única para Edge + app (re-export em `src/lib/lztItemGuards.ts`).
 * Contas LZT podem ter `item_state` `stickied`, `pre_active`, etc. e continuam listadas.
 */

export function normalizeLztItemState(state: unknown): string {
  if (state == null || state === "") return "";
  return String(state).toLowerCase().trim();
}

/** Conta vendida / removida do mercado (não confundir com `stickied` / `pre_active`). */
export function isLztItemStateSoldOrRemoved(state: unknown): boolean {
  const s = normalizeLztItemState(state);
  return s === "paid" || s === "closed" || s === "deleted";
}

/** Ainda não publicada na busca (ver docs LZT: awaiting). */
export function isLztItemStateAwaiting(state: unknown): boolean {
  return normalizeLztItemState(state) === "awaiting";
}

/**
 * Objeto `buyer` preenchido de forma significativa.
 * Objeto vazio `{}` não conta.
 */
export function hasLztBuyerAssigned(buyer: unknown): boolean {
  if (buyer == null || buyer === false) return false;
  if (typeof buyer === "string") return buyer.trim().length > 0;
  if (typeof buyer === "number") return Number.isFinite(buyer) && buyer > 0;
  if (Array.isArray(buyer)) return buyer.length > 0;
  if (typeof buyer === "object") {
    const o = buyer as Record<string, unknown>;
    const uid = o.user_id ?? o.userId ?? o.id;
    if (uid != null && String(uid) !== "" && String(uid) !== "0") return true;
    const un = o.username;
    if (typeof un === "string" && un.trim() !== "") return true;
    return false;
  }
  return Boolean(buyer);
}

/**
 * Conta já vendida: `buyer` aninhado ou campos espelhados no item (variações da API LZT).
 */
export function hasLztItemBuyerAssigned(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  if (hasLztBuyerAssigned(o.buyer)) return true;
  const bu = o.buyer_username ?? o.buyerUsername;
  if (typeof bu === "string" && bu.trim() !== "") return true;
  const bid = o.buyer_user_id ?? o.buyerUserId ?? o.buyer_id ?? o.buyerId;
  if (bid != null && String(bid).trim() !== "" && String(bid) !== "0") return true;
  return false;
}
