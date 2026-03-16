import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches ALL rows from a Supabase table, bypassing the 1000-row default limit.
 * Uses .range() pagination internally.
 */
export async function fetchAllRows<T = any>(
  tableName: string,
  {
    select = "*",
    filters,
    order,
    limit,
  }: {
    select?: string;
    filters?: { column: string; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in"; value: any }[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
  } = {}
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allData: T[] = [];
  let from = 0;

  while (true) {
    let query = (supabase.from as any)(tableName).select(select);

    if (filters) {
      for (const f of filters) {
        query = query[f.op](f.column, f.value);
      }
    }

    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    const to = limit ? Math.min(from + PAGE_SIZE - 1, limit - 1) : from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data as T[]);

    if (data.length < PAGE_SIZE) break;
    if (limit && allData.length >= limit) break;

    from += PAGE_SIZE;
  }

  return limit ? allData.slice(0, limit) : allData;
}
