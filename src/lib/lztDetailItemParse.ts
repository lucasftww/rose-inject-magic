import { isRecord } from "@/types/ticketChat";

/** Subconjunto usado por `checkLztAvailability` na resposta `detail`. */
export type LztDetailItem = {
  item_id?: string | number;
  item_state?: string;
  buyer?: unknown;
  buyer_username?: string;
  buyer_user_id?: string | number;
  canBuyItem?: boolean;
  not_sold_before?: boolean;
  notSoldBefore?: boolean;
  sold_before?: boolean;
  soldBefore?: boolean;
};

/** Alinhado à edge `lzt-market` (shouldKeepItem): conta já vendida antes no LZT. */
export function itemFailsLztNotSoldBeforePolicy(item: Record<string, unknown>): boolean {
  const nsb = item.not_sold_before ?? item.notSoldBefore;
  if (nsb === false || nsb === 0 || nsb === "0") return true;
  const sb = item.sold_before ?? item.soldBefore;
  if (sb === true || sb === 1 || sb === "1") return true;
  return false;
}

export function parseLztDetailResponseItem(json: unknown): LztDetailItem | undefined {
  if (!isRecord(json)) return undefined;
  const itemRaw = json.item;
  if (!isRecord(itemRaw)) return undefined;
  return itemRaw as LztDetailItem;
}
