import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { asOrderTicketMetadata } from "@/types/orderTicketMetadata";

/** Support ticket row shape used by admin TicketsTab (matches prior fetchTickets mapping). */
export type AdminTicketListItem = {
  id: string;
  user_id: string;
  product_id: string;
  product_plan_id: string;
  stock_item_id: string | null;
  status: string;
  status_label: string;
  created_at: string;
  product_name?: string;
  plan_name?: string;
  plan_price?: number;
  buyer_email?: string;
  buyer_username?: string;
  metadata?: Record<string, unknown> | null;
};

const EMPTY_PRODUCT_NAMES: { id: string; name: string }[] = [];
const EMPTY_PLAN_ROWS: { id: string; name: string; price: number }[] = [];
const EMPTY_PROFILE_ROWS: { user_id: string; username: string | null }[] = [];

export async function fetchAdminTicketsList(): Promise<AdminTicketListItem[]> {
  type OrderTicketRow = Database["public"]["Tables"]["order_tickets"]["Row"];

  const data = await fetchAllRows<OrderTicketRow>("order_tickets", {
    select: "*",
    order: { column: "created_at", ascending: false },
    limit: 500,
  });

  const productIds = [...new Set(data.map((t) => t.product_id))];
  const planIds = [...new Set(data.map((t) => t.product_plan_id))];
  const userIds = [...new Set(data.map((t) => t.user_id))];

  const lztItemIds = data
    .filter((t) => {
      const m = asOrderTicketMetadata(t.metadata);
      return m.type === "lzt-account" && m.lzt_item_id != null;
    })
    .map((t) => String(asOrderTicketMetadata(t.metadata).lzt_item_id));

  const [productsRes, plansRes, profilesData, lztSalesData] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: EMPTY_PRODUCT_NAMES, error: null }),
    planIds.length > 0
      ? supabase.from("product_plans").select("id, name, price").in("id", planIds)
      : Promise.resolve({ data: EMPTY_PLAN_ROWS, error: null }),
    userIds.length > 0
      ? supabase.from("profiles").select("user_id, username").in("user_id", userIds)
      : Promise.resolve({ data: EMPTY_PROFILE_ROWS, error: null }),
    lztItemIds.length > 0
      ? supabase.from("lzt_sales").select("lzt_item_id, sell_price").in("lzt_item_id", lztItemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const joinError =
    productsRes.error || plansRes.error || profilesData.error || lztSalesData.error;
  if (joinError) {
    throw new Error(joinError.message || "Erro ao enriquecer lista de tickets");
  }

  const productMap: Record<string, string> = {};
  const planMap: Record<string, { name: string; price: number }> = {};
  const profileMap: Record<string, string> = {};
  const lztSalesMap = new Map<string, number>();
  productsRes.data?.forEach((p) => {
    productMap[p.id] = p.name;
  });
  plansRes.data?.forEach((p) => {
    planMap[p.id] = { name: p.name, price: Number(p.price ?? 0) };
  });
  (profilesData.data || []).forEach((p) => {
    profileMap[p.user_id] = p.username || "—";
  });
  (lztSalesData.data || []).forEach((s: { lzt_item_id?: string | null; sell_price?: number | null }) => {
    if (s.lzt_item_id != null) lztSalesMap.set(String(s.lzt_item_id), Number(s.sell_price));
  });

  return data.map((t) => {
    const meta = asOrderTicketMetadata(t.metadata);
    const isLzt = meta?.type === "lzt-account";
    const lztItemId = meta?.lzt_item_id;
    const lztPrice = lztItemId
      ? lztSalesMap.get(String(lztItemId)) || meta?.price || meta?.sell_price || 0
      : 0;

    return {
      ...t,
      status: t.status || "open",
      status_label: t.status_label || "Aberto",
      created_at: t.created_at || new Date().toISOString(),
      metadata: asOrderTicketMetadata(t.metadata) as Record<string, unknown>,
      product_name: isLzt ? meta?.title || "Conta LZT" : productMap[t.product_id] || "Produto",
      plan_name: isLzt ? "Conta" : planMap[t.product_plan_id]?.name || "Plano",
      plan_price: isLzt ? lztPrice : planMap[t.product_plan_id]?.price ?? 0,
      buyer_email: "—",
      buyer_username: profileMap[t.user_id] || "—",
    } as AdminTicketListItem;
  });
}
