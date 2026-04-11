import type { Database, Tables } from "@/integrations/supabase/types";
import type { OrderTicketMetadata } from "@/types/orderTicketMetadata";
import { registerCacheInvalidator } from "@/lib/adminCache";

export type OrderTicketRow = Database["public"]["Tables"]["order_tickets"]["Row"];

export interface SaleTicket extends Omit<OrderTicketRow, "metadata"> {
  metadata: OrderTicketMetadata | null;
  product_name?: string;
  product_image?: string | null;
  plan_name?: string;
  plan_price?: number;
  username?: string | null;
  email?: string | null;
  stock_content?: string | null;
}

let _cachedSales: SaleTicket[] | null = null;
let _salesCacheTs = 0;

export const SALES_CACHE_TTL = 3 * 60 * 1000;

export function getSalesCache(): { tickets: SaleTicket[] | null; ts: number } {
  return { tickets: _cachedSales, ts: _salesCacheTs };
}

export function setSalesCacheData(tickets: SaleTicket[]): void {
  _cachedSales = tickets;
  _salesCacheTs = Date.now();
}

function invalidateSalesCache(): void {
  _cachedSales = null;
  _salesCacheTs = 0;
}

registerCacheInvalidator(invalidateSalesCache);
