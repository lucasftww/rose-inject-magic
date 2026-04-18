/**
 * Leituras em massa para Finance/Overview via RPC no Postgres (1 round-trip, usa índices).
 * Se a migração `admin_finance_rpc_bulk_fetch` ainda não estiver aplicada, faz fallback para `fetchAllRows`.
 */
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import {
  ADMIN_MAX_LZT_SALES_ROWS,
  ADMIN_MAX_ORDER_TICKETS,
  ADMIN_MAX_PAYMENTS_COMPLETED,
  ADMIN_MAX_RESELLER_PURCHASES,
} from "@/lib/adminDataLimits";

function isRpcMissingError(err: { message?: string; code?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("does not exist") || m.includes("function public.admin_finance") || err.code === "42883";
}

export interface AdminPaymentFinanceRow {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  cart_snapshot: Json | null;
  payment_method: string | null;
  discount_amount: number;
  user_id: string;
}

export async function fetchAdminCompletedPaymentsBulk(): Promise<AdminPaymentFinanceRow[]> {
  const { data, error } = await supabase.rpc("admin_finance_completed_payments", {
    p_limit: ADMIN_MAX_PAYMENTS_COMPLETED,
  });
  if (!error && Array.isArray(data)) {
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      amount: Number(r.amount),
      status: String(r.status ?? ""),
      created_at: String(r.created_at ?? ""),
      paid_at: r.paid_at != null ? String(r.paid_at) : null,
      cart_snapshot: (r.cart_snapshot ?? null) as Json | null,
      payment_method: r.payment_method != null ? String(r.payment_method) : null,
      discount_amount: Number(r.discount_amount ?? 0),
      user_id: String(r.user_id),
    }));
  }
  if (error && isRpcMissingError(error)) {
    return fetchAllRows<AdminPaymentFinanceRow>("payments", {
      select: "id, amount, status, created_at, paid_at, cart_snapshot, payment_method, discount_amount, user_id",
      filters: [{ column: "status", op: "eq", value: "COMPLETED" }],
      order: { column: "paid_at", ascending: false },
      limit: ADMIN_MAX_PAYMENTS_COMPLETED,
    });
  }
  throw error ?? new Error("admin_finance_completed_payments");
}

export interface AdminLztSaleBulkRow {
  buy_price: number;
  sell_price: number;
  profit: number;
  created_at: string;
  game: string | null;
}

export async function fetchAdminLztSalesBulk(): Promise<AdminLztSaleBulkRow[]> {
  const { data, error } = await supabase.rpc("admin_finance_lzt_sales", {
    p_limit: ADMIN_MAX_LZT_SALES_ROWS,
  });
  if (!error && Array.isArray(data)) {
    return (data as Record<string, unknown>[]).map((r) => ({
      buy_price: Number(r.buy_price ?? 0),
      sell_price: Number(r.sell_price ?? 0),
      profit: Number(r.profit ?? 0),
      created_at: String(r.created_at ?? ""),
      game: r.game != null ? String(r.game) : null,
    }));
  }
  if (error && isRpcMissingError(error)) {
    return fetchAllRows<AdminLztSaleBulkRow>("lzt_sales", {
      select: "buy_price, sell_price, profit, created_at, game",
      order: { column: "created_at", ascending: false },
      limit: ADMIN_MAX_LZT_SALES_ROWS,
    });
  }
  throw error ?? new Error("admin_finance_lzt_sales");
}

export interface AdminResellerPurchaseBulkRow {
  original_price: number;
  paid_price: number;
  created_at: string;
}

export async function fetchAdminResellerPurchasesBulk(): Promise<AdminResellerPurchaseBulkRow[]> {
  const { data, error } = await supabase.rpc("admin_finance_reseller_purchases", {
    p_limit: ADMIN_MAX_RESELLER_PURCHASES,
  });
  if (!error && Array.isArray(data)) {
    return (data as Record<string, unknown>[]).map((r) => ({
      original_price: Number(r.original_price ?? 0),
      paid_price: Number(r.paid_price ?? 0),
      created_at: String(r.created_at ?? ""),
    }));
  }
  if (error && isRpcMissingError(error)) {
    return fetchAllRows<AdminResellerPurchaseBulkRow>("reseller_purchases", {
      select: "original_price, paid_price, created_at",
      order: { column: "created_at", ascending: false },
      limit: ADMIN_MAX_RESELLER_PURCHASES,
    });
  }
  throw error ?? new Error("admin_finance_reseller_purchases");
}

export async function fetchAdminOrderTicketsBulk(): Promise<
  Array<{
    id: string;
    product_id: string;
    product_plan_id: string;
    user_id: string;
    metadata: Json | null;
    status: string | null;
    created_at: string | null;
    status_label: string | null;
  }>
> {
  const { data, error } = await supabase.rpc("admin_finance_order_tickets", {
    p_limit: ADMIN_MAX_ORDER_TICKETS,
  });
  if (!error && Array.isArray(data)) {
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      product_id: String(r.product_id),
      product_plan_id: String(r.product_plan_id),
      user_id: String(r.user_id),
      metadata: (r.metadata ?? null) as Json | null,
      status: r.status != null ? String(r.status) : null,
      created_at: r.created_at != null ? String(r.created_at) : null,
      status_label: r.status_label != null ? String(r.status_label) : null,
    }));
  }
  if (error && isRpcMissingError(error)) {
    return fetchAllRows("order_tickets", {
      select: "id, product_id, product_plan_id, user_id, metadata, status, created_at, status_label",
      order: { column: "created_at", ascending: false },
      limit: ADMIN_MAX_ORDER_TICKETS,
    });
  }
  throw error ?? new Error("admin_finance_order_tickets");
}
