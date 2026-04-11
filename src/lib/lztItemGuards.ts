/**
 * Regras alinhadas ao comportamento real da LZT: contas podem ter `item_state`
 * `stickied`, `pre_active`, `discount_requests`, etc. e continuam listadas.
 * Manter em sync com `supabase/functions/_shared/lztItemGuards.ts`.
 */

export function normalizeLztItemState(state: unknown): string {
  if (state == null || state === "") return "";
  return String(state).toLowerCase().trim();
}

export function isLztItemStateSoldOrRemoved(state: unknown): boolean {
  const s = normalizeLztItemState(state);
  return s === "paid" || s === "closed" || s === "deleted";
}

export function isLztItemStateAwaiting(state: unknown): boolean {
  return normalizeLztItemState(state) === "awaiting";
}

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
