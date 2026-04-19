import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { useCallback } from "react";
import { invalidateAdminCache } from "@/lib/adminCache";
import { safeJsonFetch } from "@/lib/apiUtils";
import type { PixPaymentVerifyResult } from "@/lib/edgeFunctionTypes";
import {
  mapProductStatusRows,
  parseAdminProductsWithPlans,
  type AdminProductWithPlansRow,
  type ProductStatusListItem,
} from "@/types/supabaseQueryResults";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import type { Tables } from "@/integrations/supabase/types";
import { fetchAdminTicketsList } from "@/lib/adminTicketsListFetch";
import { fetchAdminLztBundle, fetchAdminLztPriceOverrides } from "@/lib/adminLztFetch";
import {
  fetchAdminRobotProjectBundle,
  type RobotProjectSalesPeriod,
} from "@/lib/adminRobotProjectFetch";
import { isRecord } from "@/types/ticketChat";
import { devWarnAdminRpc, isAdminRpcPostgrestFallbackError } from "@/lib/adminFinancePostgrest";

export type { RobotProjectSalesPeriod } from "@/lib/adminRobotProjectFetch";

/**
 * Shared admin data hooks using React Query.
 * Queries with the same key are deduplicated across all mounted tabs,
 * preventing redundant network requests when switching between admin tabs.
 */

const ADMIN_STALE_TIME = 3 * 60 * 1000; // 3 minutes
const ADMIN_HEAVY_STALE_TIME = 10 * 60 * 1000; // 10 minutes — alinhado com adminCache + Finance/Overview

// ─── Products (id, name) — used by CouponsTab, ResellersTab, ScratchCardTab ───
export function useAdminProductsList() {
  return useQuery({
    queryKey: ["admin", "products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

// ─── Products with plans — used by StockTab, ProductsTab ───
export function useAdminProductsWithPlans() {
  return useQuery({
    queryKey: ["admin", "products-with-plans"],
    queryFn: async (): Promise<AdminProductWithPlansRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, sort_order, active, description, features_text, game_id, status, status_label, status_updated_at, robot_game_id, robot_markup_percent, product_plans(*)")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return parseAdminProductsWithPlans(data ?? []);
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

// ─── Games (id, name) — used by ProductsTab, SalesTab ───
export function useAdminGames() {
  return useQuery({
    queryKey: ["admin", "games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, name")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

// ─── Products for Status tab — includes game join ───
export function useAdminProductsStatus() {
  return useQuery({
    queryKey: ["admin", "products-status"],
    queryFn: async (): Promise<ProductStatusListItem[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, status, status_label, games(name)")
        .order("sort_order");
      if (error) throw error;
      return mapProductStatusRows(data ?? []);
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

/** Full payments table for Histórico Pix — deduped across revisits */
export function useAdminPaymentsFullList() {
  return useQuery({
    queryKey: ["admin", "payments-full-list"],
    queryFn: async () => {
      const rows = await fetchAllRows<Tables<"payments">>("payments", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });
      return rows ?? [];
    },
    staleTime: ADMIN_HEAVY_STALE_TIME,
  });
}

export function useAdminCouponsList() {
  return useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

export function useAdminCredentialsList() {
  return useQuery({
    queryKey: ["admin", "credentials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_credentials")
        .select("name, env_key, description, help_url, created_at, updated_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

export function useAdminPaymentSettings() {
  return useQuery({
    queryKey: ["admin", "payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_settings").select("*").order("method");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

function parseAdminScratchStats(raw: unknown): { total_plays: number; total_wins: number; total_revenue: number } | null {
  if (!isRecord(raw)) return null;
  const s = raw;
  if (s.error != null && s.error !== false && s.error !== "") return null;
  return {
    total_plays: Number(s.total_plays) || 0,
    total_wins: Number(s.total_wins) || 0,
    total_revenue: Number(s.total_revenue) || 0,
  };
}

type ScratchCardAdminBundle = {
  prizes: Tables<"scratch_card_prizes">[];
  config: Tables<"scratch_card_config"> | null;
  stats: { total_plays: number; total_wins: number; total_revenue: number };
  /** RPC `admin_scratch_stats` falhou com erro PostgREST recuperável — números acima são 0. */
  scratchStatsRpcFallback?: boolean;
};

export function useAdminScratchCardBundle() {
  return useQuery({
    queryKey: ["admin", "scratch-card"],
    queryFn: async (): Promise<ScratchCardAdminBundle> => {
      const [prizesRes, configRes, statsRes] = await Promise.all([
        supabase.from("scratch_card_prizes").select("*").order("sort_order"),
        supabase.from("scratch_card_config").select("*").limit(1).maybeSingle(),
        supabase.rpc("admin_scratch_stats"),
      ]);
      if (prizesRes.error) throw prizesRes.error;
      if (configRes.error) throw configRes.error;
      const zeroStats = { total_plays: 0, total_wins: 0, total_revenue: 0 };
      let scratchStatsRpcFallback = false;
      let stats = zeroStats;
      if (statsRes.error) {
        if (isAdminRpcPostgrestFallbackError(statsRes.error)) {
          scratchStatsRpcFallback = true;
          devWarnAdminRpc("hooks", "admin_scratch_stats", "estatísticas = 0 (fallback)", statsRes.error);
        } else {
          throw statsRes.error;
        }
      } else {
        const parsed = statsRes.data != null ? parseAdminScratchStats(statsRes.data) : null;
        stats = parsed ?? zeroStats;
      }
      return {
        prizes: prizesRes.data ?? [],
        config: configRes.data ?? null,
        stats,
        scratchStatsRpcFallback,
      };
    },
    staleTime: ADMIN_HEAVY_STALE_TIME,
  });
}

/** Full `games` rows — admin Games tab (slug, image, sort, active). */
export function useAdminGamesFull() {
  return useQuery({
    queryKey: ["admin", "games-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("games").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

export function useAdminResellersRaw() {
  return useQuery({
    queryKey: ["admin", "resellers-raw"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resellers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: ADMIN_STALE_TIME,
  });
}

type AdminStockPlanCountsData = {
  rows: { plan_id: string; total: number; available: number }[];
  /** RPC `admin_stock_counts` falhou com erro PostgREST recuperável — contagens por plano vazias. */
  usedRpcFallback: boolean;
};

export function useAdminStockPlanCounts() {
  return useQuery({
    queryKey: ["admin", "stock-plan-counts"],
    queryFn: async (): Promise<AdminStockPlanCountsData> => {
      const { data, error } = await supabase.rpc("admin_stock_counts");
      if (error) {
        if (isAdminRpcPostgrestFallbackError(error)) {
          devWarnAdminRpc("hooks", "admin_stock_counts", "contagens vazias (fallback)", error);
          return { rows: [], usedRpcFallback: true };
        }
        throw error;
      }
      const rows = (data as unknown as { plan_id: string; total: number; available: number }[]) ?? [];
      return { rows, usedRpcFallback: false };
    },
    staleTime: 60 * 1000,
  });
}

export function useAdminTicketsList() {
  return useQuery({
    queryKey: ["admin", "tickets-list"],
    queryFn: fetchAdminTicketsList,
    staleTime: ADMIN_HEAVY_STALE_TIME,
  });
}

export function useAdminLztBundle() {
  return useQuery({
    queryKey: ["admin", "lzt", "bundle"],
    queryFn: fetchAdminLztBundle,
    staleTime: ADMIN_HEAVY_STALE_TIME,
    placeholderData: (previousData) => previousData,
  });
}

export function useAdminLztPriceOverrides() {
  return useQuery({
    queryKey: ["admin", "lzt", "price-overrides"],
    queryFn: fetchAdminLztPriceOverrides,
    staleTime: ADMIN_STALE_TIME,
  });
}

export function useAdminRobotProjectBundle(period: RobotProjectSalesPeriod) {
  return useQuery({
    queryKey: ["admin", "robot-project", "bundle", period],
    queryFn: () => fetchAdminRobotProjectBundle(period),
    staleTime: ADMIN_HEAVY_STALE_TIME,
    placeholderData: (previousData) => previousData,
  });
}

// ─── Invalidation helper — call after any product/game mutation ───
export function useInvalidateAdminCache() {
  return useCallback(() => {
    invalidateAdminCache();
  }, []);
}

/**
 * Manually trigger status verification for a payment.
 * Calls the pix-payment Edge Function using the admin's session.
 */
export async function verifyPayment(
  paymentId: string,
  method: string = "pix"
): Promise<PixPaymentVerifyResult> {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;
  if (!token) throw new Error("No active session");

  if (!supabaseAnonKey.trim()) {
    throw new Error("Missing Supabase anon key (configure VITE_SUPABASE_PUBLISHABLE_KEY for production).");
  }

  const action = method === "card" ? "card-status" : method === "crypto" ? "crypto-status" : "status";
  
  const result = await safeJsonFetch<PixPaymentVerifyResult>(
    `${supabaseUrl}/functions/v1/pix-payment?action=${action}&payment_id=${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    }
  );

  if (!result.success && result.error) throw new Error(result.error || "Erro ao verificar pagamento");
  return result;
}
