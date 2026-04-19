import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PublicTable = keyof Database["public"]["Tables"];

/**
 * Fetches ALL rows from a Supabase table, bypassing the 1000-row default limit.
 * Uses .range() pagination internally.
 *
 * Prefer `fetchAllRows<"order_tickets">("order_tickets", …)` para `T` = linha completa;
 * com `select` parcial, `T` pode ser um `Pick<Tables<…>, …>` compatível com o JSON devolvido.
 */
export async function fetchAllRows<T = unknown>(
  tableName: PublicTable,
  {
    select = "*",
    filters,
    order,
    limit,
  }: {
    select?: string;
    filters?: { column: string; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in"; value: unknown }[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
  } = {}
): Promise<T[]> {
  /** PostgREST costuma limitar a 1000 linhas/pedido; não aumentar sem alinhar «Max rows» no projeto Supabase. */
  const PAGE_SIZE = 1000;
  let allData: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(tableName).select(select);

    if (filters) {
      for (const f of filters) {
        switch (f.op) {
          case "eq":
            query = query.eq(f.column, f.value);
            break;
          case "neq":
            query = query.neq(f.column, f.value);
            break;
          case "gt":
            query = query.gt(f.column, f.value);
            break;
          case "gte":
            query = query.gte(f.column, f.value);
            break;
          case "lt":
            query = query.lt(f.column, f.value);
            break;
          case "lte":
            query = query.lte(f.column, f.value);
            break;
          case "in":
            query = query.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
            break;
          default:
            break;
        }
      }
    }

    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    const remaining = limit !== undefined ? Math.max(0, limit - allData.length) : PAGE_SIZE;
    const chunk = Math.min(PAGE_SIZE, remaining || PAGE_SIZE);
    if (chunk === 0) break;

    const to = from + chunk - 1;
    query = query.range(from, to);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data as T[]);
    from += data.length;

    if (limit !== undefined && allData.length >= limit) break;
    if (data.length < chunk) break;
  }

  return limit ? allData.slice(0, limit) : allData;
}
