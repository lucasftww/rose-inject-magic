import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Service-role client sem tipos gerados de `Database` (Edge Functions). */
export type SupabaseAdminClient = SupabaseClient;

/** Linha de `payments` usada em fulfillment e webhooks do pix-payment. */
export interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  status?: string | null;
  cart_snapshot?: unknown;
  customer_data?: unknown;
  meta_tracking?: unknown;
  coupon_id?: string | null;
  discount_amount?: number | null;
  charge_id?: string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  external_id?: string | null;
  created_at?: string | null;
}

/** Item típico em `cart_snapshot` (JSON). */
export interface CartSnapshotItem {
  type?: string;
  productId?: string;
  planId?: string;
  productName?: string;
  planName?: string;
  price?: number;
  quantity?: number;
  lztItemId?: string;
  lztPrice?: number;
  lztCurrency?: string;
  lztGame?: string;
  productImage?: string | null;
  skinsCount?: number | null;
}

export interface RobotProductRow {
  robot_game_id?: number | null;
  robot_markup_percent?: number | null;
  name?: string | null;
  id?: string;
}

export interface RobotPlanRow {
  price?: number | null;
  robot_duration_days?: number | null;
  name?: string | null;
  id?: string;
  product_id?: string;
  active?: boolean | null;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
