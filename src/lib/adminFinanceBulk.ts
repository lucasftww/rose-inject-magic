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
import { devWarnAdminRpc, isAuthLikeRpcError } from "@/lib/adminFinancePostgrest";

/** Após 1ª falha recuperável, evita novos POST /rpc/* (400 no Network) até invalidar cache admin. */
const FINANCE_BULK_REST_ONLY_KEY = "rose_admin_finance_bulk_rest_only";

export function clearFinanceBulkRpcRestHint(): void {
  try {
    sessionStorage.removeItem(FINANCE_BULK_REST_ONLY_KEY);
  } catch {
    /* private mode / SSR */
  }
}

function readFinanceBulkRestOnly(): boolean {
  try {
    return sessionStorage.getItem(FINANCE_BULK_REST_ONLY_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFinanceBulkRestOnly(): void {
  try {
    sessionStorage.setItem(FINANCE_BULK_REST_ONLY_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Qualquer falha de RPC que não seja sessão/JWT → mesmo dado via REST (RLS admin). */
function shouldFallbackRestForFinanceBulk(error: RpcErrorish): boolean {
  return Boolean(error) && !isAuthLikeRpcError(error);
}

/** Evita 2× o mesmo POST quando Finance + Overview montam em paralelo antes do cache. */
let inFlightCompletedPayments: Promise<AdminPaymentFinanceRow[]> | null = null;
let inFlightLztSales: Promise<AdminLztSaleBulkRow[]> | null = null;
let inFlightResellerPurchases: Promise<AdminResellerPurchaseBulkRow[]> | null = null;
let inFlightOrderTickets: Promise<
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
> | null = null;

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
  const restArgs = {
    select: "id, amount, status, created_at, paid_at, cart_snapshot, payment_method, discount_amount, user_id" as const,
    filters: [{ column: "status", op: "eq" as const, value: "COMPLETED" }],
    order: { column: "paid_at" as const, ascending: false },
    limit: ADMIN_MAX_PAYMENTS_COMPLETED,
  };

  if (readFinanceBulkRestOnly()) {
    return fetchAllRows<AdminPaymentFinanceRow>("payments", restArgs);
  }

  if (inFlightCompletedPayments) return inFlightCompletedPayments;

  inFlightCompletedPayments = (async (): Promise<AdminPaymentFinanceRow[]> => {
    try {
      let { data, error } = await supabase.rpc(rpcName, {
        p_limit: ADMIN_MAX_PAYMENTS_COMPLETED,
      });
      if (error) devWarnAdminRpc("bulk", rpcName, "RPC com p_limit", error);
      if (!error && Array.isArray(data)) {
        return mapRows(data as Record<string, unknown>[]);
      }
      if (shouldFallbackRestForFinanceBulk(error)) {
        devWarnAdminRpc("bulk", rpcName, "fallback REST", error);
        const rows = await fetchAllRows<AdminPaymentFinanceRow>("payments", restArgs);
        writeFinanceBulkRestOnly();
        return rows;
      }
      throw error ?? new Error("admin_finance_completed_payments");
    } finally {
      inFlightCompletedPayments = null;
    }
  })();

  return inFlightCompletedPayments;
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
  const restArgs = {
    select: "buy_price, sell_price, profit, created_at, game" as const,
    order: { column: "created_at" as const, ascending: false },
    limit: ADMIN_MAX_LZT_SALES_ROWS,
  };

  if (readFinanceBulkRestOnly()) {
    return fetchAllRows<AdminLztSaleBulkRow>("lzt_sales", restArgs);
  }

  if (inFlightLztSales) return inFlightLztSales;

  inFlightLztSales = (async (): Promise<AdminLztSaleBulkRow[]> => {
    try {
      let { data, error } = await supabase.rpc(rpcName, {
        p_limit: ADMIN_MAX_LZT_SALES_ROWS,
      });
      if (error) devWarnAdminRpc("bulk", rpcName, "RPC com p_limit", error);
      if (!error && Array.isArray(data)) {
        return mapRows(data as Record<string, unknown>[]);
      }
      if (shouldFallbackRestForFinanceBulk(error)) {
        devWarnAdminRpc("bulk", rpcName, "fallback REST", error);
        const rows = await fetchAllRows<AdminLztSaleBulkRow>("lzt_sales", restArgs);
        writeFinanceBulkRestOnly();
        return rows;
      }
      throw error ?? new Error("admin_finance_lzt_sales");
    } finally {
      inFlightLztSales = null;
    }
  })();

  return inFlightLztSales;
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
  const restArgs = {
    select: "original_price, paid_price, created_at" as const,
    order: { column: "created_at" as const, ascending: false },
    limit: ADMIN_MAX_RESELLER_PURCHASES,
  };

  if (readFinanceBulkRestOnly()) {
    return fetchAllRows<AdminResellerPurchaseBulkRow>("reseller_purchases", restArgs);
  }

  if (inFlightResellerPurchases) return inFlightResellerPurchases;

  inFlightResellerPurchases = (async (): Promise<AdminResellerPurchaseBulkRow[]> => {
    try {
      let { data, error } = await supabase.rpc(rpcName, {
        p_limit: ADMIN_MAX_RESELLER_PURCHASES,
      });
      if (error) devWarnAdminRpc("bulk", rpcName, "RPC com p_limit", error);
      if (!error && Array.isArray(data)) {
        return mapRows(data as Record<string, unknown>[]);
      }
      if (shouldFallbackRestForFinanceBulk(error)) {
        devWarnAdminRpc("bulk", rpcName, "fallback REST", error);
        const rows = await fetchAllRows<AdminResellerPurchaseBulkRow>("reseller_purchases", restArgs);
        writeFinanceBulkRestOnly();
        return rows;
      }
      throw error ?? new Error("admin_finance_reseller_purchases");
    } finally {
      inFlightResellerPurchases = null;
    }
  })();

  return inFlightResellerPurchases;
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
  const restArgs = {
    select: "id, product_id, product_plan_id, user_id, metadata, status, created_at, status_label" as const,
    order: { column: "created_at" as const, ascending: false },
    limit: ADMIN_MAX_ORDER_TICKETS,
  };

  if (readFinanceBulkRestOnly()) {
    return fetchAllRows("order_tickets", restArgs);
  }

  if (inFlightOrderTickets) return inFlightOrderTickets;

  inFlightOrderTickets = (async () => {
    try {
      let { data, error } = await supabase.rpc(rpcName, {
        p_limit: ADMIN_MAX_ORDER_TICKETS,
      });
      if (error) devWarnAdminRpc("bulk", rpcName, "RPC com p_limit", error);
      if (!error && Array.isArray(data)) {
        return mapRows(data as Record<string, unknown>[]);
      }
      if (shouldFallbackRestForFinanceBulk(error)) {
        devWarnAdminRpc("bulk", rpcName, "fallback REST", error);
        const rows = await fetchAllRows("order_tickets", restArgs);
        writeFinanceBulkRestOnly();
        return rows;
      }
      throw error ?? new Error("admin_finance_order_tickets");
    } finally {
      inFlightOrderTickets = null;
    }
  })();

  return inFlightOrderTickets;
}
