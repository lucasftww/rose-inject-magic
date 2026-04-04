import { isRecord } from "@/types/ticketChat";

/** Subconjunto usado no admin / vendas para `order_tickets.metadata` (JSON). */
export type OrderTicketMetadata = {
  type?: string;
  lzt_item_id?: string | number;
  title?: string;
  account_name?: string;
  account_image?: string | null;
  price_paid?: number;
  price?: number;
  sell_price?: number;
  game?: string;
  game_name?: string;
  is_free?: boolean;
  robot_game_id?: string | number;
  duration_days?: number;
  plan_price?: number;
  amount_spent?: number;
  duration?: number;
  /** Mensagem de falha (ex.: entrega Robot) */
  error?: string;
  key?: string;
  download_url?: string;
  file_name?: string;
};

export function asOrderTicketMetadata(meta: unknown): OrderTicketMetadata {
  if (isRecord(meta)) {
    return meta as OrderTicketMetadata;
  }
  return {};
}
