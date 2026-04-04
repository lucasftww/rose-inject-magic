import { isRecord } from "@/types/ticketChat";

/** Subconjunto usado por `checkLztAvailability` na resposta `detail`. */
export type LztDetailItem = {
  item_id?: string | number;
  item_state?: string;
  buyer?: unknown;
  canBuyItem?: boolean;
};

export function parseLztDetailResponseItem(json: unknown): LztDetailItem | undefined {
  if (!isRecord(json)) return undefined;
  const itemRaw = json.item;
  if (!isRecord(itemRaw)) return undefined;
  return itemRaw as LztDetailItem;
}
