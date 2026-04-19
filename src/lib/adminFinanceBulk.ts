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
import type { RpcErrorish } from "@/lib/adminFinancePostgrest";
import {
  devWarnAdminRpc,
  isAdminRpcPostgrestFallbackError,
  isAuthLikeRpcError,
  normRpcCode,
  rpcErrorBlob,
} from "@/lib/adminFinancePostgrest";

/** PostgREST não encontrou overload com estes argumentos — tentar só defaults do SQL. */
function shouldRetryRpcWithoutNamedLimit(err: RpcErrorish): boolean {
  if (!err || isAuthLikeRpcError(err)) return false;
  const c = normRpcCode(err);
  const m = rpcErrorBlob(err);
  if (c === "PGRST203" || c === "PGRST204" || c === "PGRST205") return true;
  if (c === "42725") return true;
  if (m.includes("no function matches")) return true;
  if (m.includes("could not find the function")) return true;
  if (m.includes("does not exist") && m.includes("function") && m.includes("admin_finance")) return true;
  if (m.includes("unexpected") && (m.includes("parameter") || m.includes("argument"))) return true;
  if (m.includes("unknown") && (m.includes("parameter") || m.includes("argument"))) return true;
  if (m.includes("not match") && m.includes("function")) return true;
  if (m.includes("overload")) return true;
  return false;
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
  const mapRows = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
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

  const rpcName = "admin_finance_completed_payments";
  let { data, error } = await supabase.rpc(rpcName, {
    p_limit: ADMIN_MAX_PAYMENTS_COMPLETED,
  });
  if (error) devWarnAdminRpc("bulk", rpcName, "RPC com p_limit", error);
  if (error && shouldRetryRpcWithoutNamedLimit(error)) {
    ({ data, error } = await supabase.rpc(rpcName));
    if (error) devWarnAdminRpc("bulk", rpcName, "RPC sem p_limit (retry)", error);
  }
  if (!error && Array.isArray(data)) {
    return mapRows(data as Record<string, unknown>[]);
  }
  if (error && isAdminRpcPostgrestFallbackError(error)) {
    devWarnAdminRpc("bulk", rpcName, "fallback REST", error);
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
  const mapRows = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
      buy_price: Number(r.buy_price ?? 0),
      sell_price: Number(r.sell_price ?? 0),
      profit: Number(r.profit ?? 0),
      created_at: String(r.created_at ?? ""),
      game: r.game != null ? String(r.game) : null,
    }));

  const rpcName = "admin_finance_lzt_sales";
  let { data, error } = await supabase.rpc(rpcName, {
    p_limit: ADMIN_MAX_LZT_SALES_ROWS,
  });
  if (error) devWarnAdminRpc("bulk", rpcName, "RPC com p_limit", error);
  if (error && shouldRetryRpcWithoutNamedLimit(error)) {
    ({ data, error } = await supabase.rpc(rpcName));
    if (error) devWarnAdminRpc("bulk", rpcName, "RPC sem p_limit (retry)", error);
  }
  if (!error && Array.isArray(data)) {
    return mapRows(data as Record<string, unknown>[]);
  }
  if (error && isAdminRpcPostgrestFallbackError(error)) {
    devWarnAdminRpc("bulk", rpcName, "fallback REST", error);
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
  const mapRows = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
      original_price: Number(r.original_price ?? 0),
      paid_price: Number(r.paid_price ?? 0),
      created_at: String(r.created_at ?? ""),
    }));

  const rpcName = "admin_finance_reseller_purchases";
  let { data, error } = await supabase.rpc(rpcName, {
    p_limit: ADMIN_MAX_RESELLER_PURCHASES,
  });
  if (error) devWarnAdminRpc("bulk", rpcName, "RPC com p_limit", error);
  if (error && shouldRetryRpcWithoutNamedLimit(error)) {
    ({ data, error } = await supabase.rpc(rpcName));
    if (error) devWarnAdminRpc("bulk", rpcName, "RPC sem p_limit (retry)", error);
  }
  if (!error && Array.isArray(data)) {
    return mapRows(data as Record<string, unknown>[]);
  }
  if (error && isAdminRpcPostgrestFallbackError(error)) {
    devWarnAdminRpc("bulk", rpcName, "fallback REST", error);
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
  const mapRows = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
      id: String(r.id),
      product_id: String(r.product_id),
      product_plan_id: String(r.product_plan_id),
      user_id: String(r.user_id),
      metadata: (r.metadata ?? null) as Json | null,
      status: r.status != null ? String(r.status) : null,
      created_at: r.created_at != null ? String(r.created_at) : null,
      status_label: r.status_label != null ? String(r.status_label) : null,
    }));

  const rpcName = "admin_finance_order_tickets";
  let { data, error } = await supabase.rpc(rpcName, {
    p_limit: ADMIN_MAX_ORDER_TICKETS,
  });
  if (error) devWarnAdminRpc("bulk", rpcName, "RPC com p_limit", error);
  if (error && shouldRetryRpcWithoutNamedLimit(error)) {
    ({ data, error } = await supabase.rpc(rpcName));
    if (error) devWarnAdminRpc("bulk", rpcName, "RPC sem p_limit (retry)", error);
  }
  if (!error && Array.isArray(data)) {
    return mapRows(data as Record<string, unknown>[]);
  }
  if (error && isAdminRpcPostgrestFallbackError(error)) {
    devWarnAdminRpc("bulk", rpcName, "fallback REST", error);
    return fetchAllRows("order_tickets", {
      select: "id, product_id, product_plan_id, user_id, metadata, status, created_at, status_label",
      order: { column: "created_at", ascending: false },
      limit: ADMIN_MAX_ORDER_TICKETS,
    });
  }
  throw error ?? new Error("admin_finance_order_tickets");
}
