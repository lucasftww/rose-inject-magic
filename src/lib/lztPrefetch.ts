import { QueryClient } from "@tanstack/react-query";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";

/** Contas 410 (vendida/indisponível): não repetir GET ao passar o rato. */
const detailPrefetchGoneKeys = new Set<string>();

const detailPrefetchInFlight = new Set<string>();

/** Prefetch account detail data into React Query cache on hover for instant navigation. */
export const prefetchAccountDetail = (
  queryClient: QueryClient,
  gameType: string,
  itemId: string | number,
) => {
  const id = String(itemId);
  const key = lztAccountDetailQueryKey(gameType, id);
  const dedupeKey = `${gameType}:${id}`;

  if (detailPrefetchGoneKeys.has(dedupeKey)) return;

  const existing = queryClient.getQueryData(key);
  if (existing != null) return;

  const state = queryClient.getQueryState(key);
  if (state?.fetchStatus === "fetching") return;
  if (detailPrefetchInFlight.has(dedupeKey)) return;

  detailPrefetchInFlight.add(dedupeKey);

  void (async () => {
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(id)}&game_type=${encodeURIComponent(gameType)}`,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        },
      );
      if (res.status === 410) {
        detailPrefetchGoneKeys.add(dedupeKey);
        return;
      }
      if (!res.ok) return;
      const json: unknown = await res.json();
      queryClient.setQueryData(key, json);
    } catch {
      /* ignore */
    } finally {
      detailPrefetchInFlight.delete(dedupeKey);
    }
  })();
};
