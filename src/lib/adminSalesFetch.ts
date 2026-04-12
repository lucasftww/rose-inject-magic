import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { asOrderTicketMetadata } from "@/types/orderTicketMetadata";
import type { OrderTicketRow, SaleTicket } from "@/lib/adminSalesCache";
import { setSalesCacheData } from "@/lib/adminSalesCache";

const SALES_MAX_ROWS = 2000;

/**
 * Loads and enriches order tickets for the admin Sales tab.
 * Shared by TanStack Query so revisiting the tab uses cache without remount refetch.
 */
export async function fetchAdminSalesTickets(): Promise<SaleTicket[]> {
  const rawTickets = await fetchAllRows<OrderTicketRow>("order_tickets", {
    select: "*",
    order: { column: "created_at", ascending: false },
    limit: SALES_MAX_ROWS,
  });

  const productIds = [...new Set(rawTickets.map((t) => t.product_id))];
  const planIds = [...new Set(rawTickets.map((t) => t.product_plan_id))];

  const lztItemIds = rawTickets
    .filter((t) => {
      const m = asOrderTicketMetadata(t.metadata);
      return m.type === "lzt-account" && m.lzt_item_id != null;
    })
    .map((t) => String(asOrderTicketMetadata(t.metadata).lzt_item_id));

  const CHUNK = 500;
  type PublicTable = keyof Database["public"]["Tables"];
  const fetchInChunks = async <T extends PublicTable>(
    table: T,
    select: string,
    column: string,
    ids: string[],
  ): Promise<Tables<T>[]> => {
    if (ids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
    const results = await Promise.all(
      chunks.map((chunk) =>
        (supabase.from(table as never).select(select) as never)
          .in(column, chunk)
          .then((r: { data?: Tables<T>[] | null }) => (r.data ?? []) as Tables<T>[]),
      ),
    );
    return results.flat();
  };

  const [productsData, plansData, lztSalesRaw] = await Promise.all([
    fetchInChunks("products", "id, name, image_url", "id", productIds),
    fetchInChunks("product_plans", "id, name, price", "id", planIds),
    lztItemIds.length > 0
      ? fetchInChunks("lzt_sales", "lzt_item_id, sell_price", "lzt_item_id", lztItemIds)
      : Promise.resolve([] as Tables<"lzt_sales">[]),
  ]);

  const productsMap = new Map(productsData.map((p) => [p.id, p]));
  const plansMap = new Map(plansData.map((p) => [p.id, p]));
  const lztSalesMap = new Map(
    (lztSalesRaw || [])
      .filter((s): s is Tables<"lzt_sales"> & { lzt_item_id: string } =>
        typeof s.lzt_item_id === "string" && s.lzt_item_id.length > 0,
      )
      .map((s) => [s.lzt_item_id, Number(s.sell_price)]),
  );

  const stockIds = rawTickets.flatMap((t) => (t.stock_item_id ? [t.stock_item_id] : []));
  const stockMap = new Map<string, string>();
  if (stockIds.length > 0) {
    try {
      const CHUNK_SIZE = 200;
      const chunks: string[][] = [];
      for (let i = 0; i < stockIds.length; i += CHUNK_SIZE) {
        chunks.push(stockIds.slice(i, i + CHUNK_SIZE));
      }
      const results = await Promise.all(
        chunks.map((chunk) =>
          fetchAllRows<{ id: string; content: string | null }>("stock_items", {
            select: "id, content",
            filters: [{ column: "id", op: "in", value: chunk }],
          }),
        ),
      );
      results.flat().forEach((s) => {
        if (s.content != null) stockMap.set(s.id, s.content);
      });
    } catch (err) {
      console.error("fetchAdminSalesTickets stock_items error:", err);
    }
  }

  const enriched: SaleTicket[] = rawTickets.map((t) => {
    const product = productsMap.get(t.product_id);
    const plan = plansMap.get(t.product_plan_id);
    const meta = asOrderTicketMetadata(t.metadata);
    const isLzt = meta?.type === "lzt-account";
    const lztItemId = meta?.lzt_item_id;
    const lztPrice = lztItemId
      ? lztSalesMap.get(String(lztItemId)) || meta?.price_paid || meta?.price || meta?.sell_price || 0
      : 0;
    const metaPrice = meta?.price_paid || meta?.plan_price;

    return {
      ...t,
      metadata: meta,
      product_name: isLzt ? meta?.title || meta?.account_name || "Conta LZT" : product?.name || "—",
      product_image: isLzt ? null : product?.image_url || null,
      plan_name: isLzt ? "Conta LZT" : plan?.name || "—",
      plan_price: isLzt ? lztPrice : metaPrice ?? plan?.price ?? 0,
      username: null as string | null,
      email: null as string | null,
      stock_content:
        t.stock_item_id && !(meta?.type === "robot-project" && meta?.is_free)
          ? stockMap.get(t.stock_item_id) || null
          : null,
    };
  });

  setSalesCacheData(enriched);
  return enriched;
}
