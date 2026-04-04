import { isRecord } from "@/types/ticketChat";

/** Subconjunto usado por `checkLztAvailability` na resposta `detail`. */
export type LztDetailItem = {
  item_id?: string | number;
  item_state?: string;
  buyer?: unknown;
  canBuyItem?: boolean;
  not_sold_before?: boolean;
  notSoldBefore?: boolean;
  sold_before?: boolean;
  soldBefore?: boolean;
};

/** Alinhado à edge `lzt-market` (shouldKeepItem): conta já vendida antes no LZT. */
export function itemFailsLztNotSoldBeforePolicy(item: Record<string, unknown>): boolean {
  if (item.not_sold_before === false || item.notSoldBefore === false) return true;
  if (item.sold_before === true || item.soldBefore === true) return true;
  return false;
}

export function parseLztDetailResponseItem(json: unknown): LztDetailItem | undefined {
  if (!isRecord(json)) return undefined;
  const itemRaw = json.item;
  if (!isRecord(itemRaw)) return undefined;
  return itemRaw as LztDetailItem;
}
