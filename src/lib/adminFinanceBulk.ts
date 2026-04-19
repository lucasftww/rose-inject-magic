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

type RpcErrorish = { message?: string; code?: string; details?: string; hint?: string } | null;

function rpcErrorBlob(err: RpcErrorish): string {
  if (!err) return "";
  return [err.message, err.details, err.hint].filter(Boolean).join(" ").toLowerCase();
}

/** Função RPC ausente / assinatura antiga no Postgres. */
function isRpcMissingError(err: RpcErrorish): boolean {
  if (!err?.message && !err?.code) return false;
  const m = rpcErrorBlob(err);
  return (
    m.includes("does not exist") ||
    m.includes("function public.admin_finance") ||
    err?.code === "42883" ||
    err?.code === "PGRST202"
  );
}

/**
 * Erros PostgREST frequentes em 400 (body/query inválido, cache de schema) ou 404 de função:
 * tentamos o mesmo dado via REST com RLS de admin em vez de deixar o painel quebrado.
 */
function isFinanceRpcFallbackError(err: RpcErrorish): boolean {
  if (!err) return false;
  const c = String(err.code || "");
  /** Sem permissão / JWT inválido: não mascarar com fallback REST (comportamento diferente do RPC). */
  if (c === "42501" || c === "PGRST301" || c === "PGRST302" || c === "PGRST303") return false;
  if (rpcErrorBlob(err).includes("forbidden")) return false;
  if (isRpcMissingError(err)) return true;
  if (c.startsWith("PGRST")) {
    const codes = new Set([
      "PGRST100",
      "PGRST102",
      "PGRST108",
      "PGRST118",
      "PGRST120",
      "PGRST200",
      "PGRST204",
      "PGRST203",
      "PGRST205",
    ]);
    if (codes.has(c)) return true;
  }
  if (rpcErrorBlob(err).includes("schema cache")) return true;
  return false;
}

/** PostgREST não encontrou overload com estes argumentos — tentar só defaults do SQL. */
function shouldRetryRpcWithoutNamedLimit(err: RpcErrorish): boolean {
  if (!err) return false;
  const c = String(err.code || "");
  const m = rpcErrorBlob(err);
  if (c === "PGRST203") return true;
  if (m.includes("no function matches")) return true;
  if (m.includes("could not find the function") && (m.includes("argument") || m.includes("parameter"))) return true;
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

  let { data, error } = await supabase.rpc("admin_finance_completed_payments", {
    p_limit: ADMIN_MAX_PAYMENTS_COMPLETED,
  });
  if (error && shouldRetryRpcWithoutNamedLimit(error)) {
    ({ data, error } = await supabase.rpc("admin_finance_completed_payments"));
  }
  if (!error && Array.isArray(data)) {
    return mapRows(data as Record<string, unknown>[]);
  }
  if (error && isFinanceRpcFallbackError(error)) {
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

  let { data, error } = await supabase.rpc("admin_finance_lzt_sales", {
    p_limit: ADMIN_MAX_LZT_SALES_ROWS,
  });
  if (error && shouldRetryRpcWithoutNamedLimit(error)) {
    ({ data, error } = await supabase.rpc("admin_finance_lzt_sales"));
  }
  if (!error && Array.isArray(data)) {
    return mapRows(data as Record<string, unknown>[]);
  }
  if (error && isFinanceRpcFallbackError(error)) {
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

  let { data, error } = await supabase.rpc("admin_finance_reseller_purchases", {
    p_limit: ADMIN_MAX_RESELLER_PURCHASES,
  });
  if (error && shouldRetryRpcWithoutNamedLimit(error)) {
    ({ data, error } = await supabase.rpc("admin_finance_reseller_purchases"));
  }
  if (!error && Array.isArray(data)) {
    return mapRows(data as Record<string, unknown>[]);
  }
  if (error && isFinanceRpcFallbackError(error)) {
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

  let { data, error } = await supabase.rpc("admin_finance_order_tickets", {
    p_limit: ADMIN_MAX_ORDER_TICKETS,
  });
  if (error && shouldRetryRpcWithoutNamedLimit(error)) {
    ({ data, error } = await supabase.rpc("admin_finance_order_tickets"));
  }
  if (!error && Array.isArray(data)) {
    return mapRows(data as Record<string, unknown>[]);
  }
  if (error && isFinanceRpcFallbackError(error)) {
    return fetchAllRows("order_tickets", {
      select: "id, product_id, product_plan_id, user_id, metadata, status, created_at, status_label",
      order: { column: "created_at", ascending: false },
      limit: ADMIN_MAX_ORDER_TICKETS,
    });
  }
  throw error ?? new Error("admin_finance_order_tickets");
}
