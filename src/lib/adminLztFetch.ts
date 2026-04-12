import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { asOrderTicketMetadata } from "@/types/orderTicketMetadata";
import { isRecord } from "@/types/ticketChat";

export type AdminLztSale = {
  id: string;
  lzt_item_id: string;
  buy_price: number;
  sell_price: number;
  profit: number;
  title: string | null;
  game: string | null;
  buyer_user_id: string | null;
  created_at: string;
};

function parseAdminLztStatsPayload(data: unknown): Record<string, unknown> | null {
  return isRecord(data) ? data : null;
}

type LztTicketFallbackRow = Pick<Tables<"order_tickets">, "id" | "metadata" | "created_at">;

type AdminLztBundle = {
  configRow: Tables<"lzt_config"> | null;
  dbStats: Record<string, unknown> | null;
  sales: AdminLztSale[];
};

export async function fetchAdminLztBundle(): Promise<AdminLztBundle> {
  const [configRes, statsRes] = await Promise.all([
    supabase.from("lzt_config").select("*").limit(1).maybeSingle(),
    supabase.rpc("admin_lzt_stats"),
  ]);
  if (configRes.error) throw configRes.error;
  if (statsRes.error) throw statsRes.error;

  const dbStats = parseAdminLztStatsPayload(statsRes.data);

  let sales: AdminLztSale[] = [];
  try {
    sales = await fetchAllRows<AdminLztSale>("lzt_sales", {
      select: "*",
      order: { column: "created_at", ascending: false },
    });
  } catch {
    sales = [];
  }

  if (sales.length === 0) {
    try {
      const tickets = await fetchAllRows<LztTicketFallbackRow>("order_tickets", {
        select: "id, metadata, created_at",
        order: { column: "created_at", ascending: false },
      });
      const lztTickets = tickets.filter((t) => asOrderTicketMetadata(t.metadata).type === "lzt-account");
      sales = lztTickets.map((t): AdminLztSale => {
        const meta = asOrderTicketMetadata(t.metadata);
        const sell = Number(meta.price_paid || meta.sell_price || 0);
        return {
          id: t.id,
          lzt_item_id: meta.lzt_item_id != null ? String(meta.lzt_item_id) : "",
          buy_price: 0,
          sell_price: sell,
          profit: sell,
          title: meta.account_name || meta.title || "Conta LZT",
          game: meta.game ?? null,
          buyer_user_id: null,
          created_at: t.created_at ?? "",
        };
      });
    } catch {
      sales = [];
    }
  }

  return {
    configRow: configRes.data ?? null,
    dbStats,
    sales,
  };
}

type AdminLztPriceOverride = { lzt_item_id: string; custom_price_brl: number };

export async function fetchAdminLztPriceOverrides(): Promise<AdminLztPriceOverride[]> {
  const { data, error } = await supabase
    .from("lzt_price_overrides")
    .select("lzt_item_id, custom_price_brl")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const deduped = new Map<string, AdminLztPriceOverride>();
  for (const row of data || []) {
    const price = Number(row.custom_price_brl);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (!deduped.has(row.lzt_item_id)) {
      deduped.set(row.lzt_item_id, { lzt_item_id: row.lzt_item_id, custom_price_brl: price });
    }
  }
  return Array.from(deduped.values());
}
