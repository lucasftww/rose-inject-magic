import type { Json, Tables } from "@/integrations/supabase/types";

/** Mensagem de `ticket_messages` no formato usado pelo chat (UI). */
export type TicketChatMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
};

export function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function jsonOrNull(v: unknown): Json | null {
  if (v === null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v as Json;
  if (isRecord(v)) return v as Json;
  return null;
}

export function mapTicketMessageRow(row: Tables<"ticket_messages">): TicketChatMessage {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    sender_id: row.sender_id,
    sender_role: row.sender_role ?? "",
    message: row.message,
    created_at: row.created_at ?? "",
  };
}

export function mapTicketMessageRows(
  rows: Tables<"ticket_messages">[] | null | undefined,
): TicketChatMessage[] {
  return (rows ?? []).map(mapTicketMessageRow);
}

/** Payload `new` do Realtime (formato linha, sem garantia de tipo). */
export function parseTicketMessageRealtime(x: unknown): TicketChatMessage | null {
  if (!isRecord(x)) return null;
  if (
    typeof x.id !== "string" ||
    typeof x.ticket_id !== "string" ||
    typeof x.sender_id !== "string" ||
    typeof x.message !== "string"
  ) {
    return null;
  }
  return {
    id: x.id,
    ticket_id: x.ticket_id,
    sender_id: x.sender_id,
    sender_role: typeof x.sender_role === "string" ? x.sender_role : "",
    message: x.message,
    created_at: typeof x.created_at === "string" ? x.created_at : "",
  };
}

export function parseTicketMessageDeleteId(oldRow: unknown): string | undefined {
  if (!isRecord(oldRow)) return undefined;
  const id = oldRow.id;
  return typeof id === "string" ? id : undefined;
}

export type OrderTicketTableRow = Tables<"order_tickets">;

/**
 * Campos do payload Realtime `new` em `order_tickets` (UPDATE pode ser parcial).
 * Fazer merge com o estado atual: `{ ...prev, ...patch }`.
 */
export function parseOrderTicketRealtimePatch(x: unknown): Partial<Tables<"order_tickets">> | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== "string") return null;
  const patch: Partial<Tables<"order_tickets">> = { id: x.id };
  if (typeof x.user_id === "string") patch.user_id = x.user_id;
  if (typeof x.product_id === "string") patch.product_id = x.product_id;
  if (typeof x.product_plan_id === "string") patch.product_plan_id = x.product_plan_id;
  if ("status" in x) patch.status = x.status === null || typeof x.status === "string" ? x.status : null;
  if ("status_label" in x)
    patch.status_label = x.status_label === null || typeof x.status_label === "string" ? x.status_label : null;
  if ("metadata" in x) patch.metadata = jsonOrNull(x.metadata);
  if ("stock_item_id" in x)
    patch.stock_item_id =
      x.stock_item_id === null || typeof x.stock_item_id === "string" ? x.stock_item_id : null;
  if ("created_at" in x)
    patch.created_at = x.created_at === null || typeof x.created_at === "string" ? x.created_at : null;
  return patch;
}
