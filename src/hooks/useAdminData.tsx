import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { useCallback } from "react";
import { safeJsonFetch } from "@/lib/apiUtils";
import type { PixPaymentVerifyResult } from "@/lib/edgeFunctionTypes";
import {
  mapProductStatusRows,
  parseAdminProductsWithPlans,
  type AdminProductWithPlansRow,
  type ProductStatusListItem,
} from "@/types/supabaseQueryResults";

/**
 * Shared admin data hooks using React Query.
 * Queries with the same key are deduplicated across all mounted tabs,
 * preventing redundant network requests when switching between admin tabs.
 */

const ADMIN_STALE_TIME = 2 * 60 * 1000; // 2 minutes

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

// ─── Invalidation helper — call after any product/game mutation ───
export function useInvalidateAdminCache() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  }, [queryClient]);
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
