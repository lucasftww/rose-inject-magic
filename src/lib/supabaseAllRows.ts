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
    let query = supabase.from(tableName).select(select);

    if (filters) {
      for (const f of filters) {
        switch (f.op) {
          case "eq": query = query.eq(f.column, f.value); break;
          case "neq": query = query.neq(f.column, f.value); break;
          case "gt": query = query.gt(f.column, f.value); break;
          case "gte": query = query.gte(f.column, f.value); break;
          case "lt": query = query.lt(f.column, f.value); break;
          case "lte": query = query.lte(f.column, f.value); break;
          case "in": query = query.in(f.column, f.value); break;
        }
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
