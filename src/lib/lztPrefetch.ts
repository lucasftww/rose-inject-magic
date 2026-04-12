import { QueryClient } from "@tanstack/react-query";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";

/** Prefetch account detail data into React Query cache on hover for instant navigation. */
export const prefetchAccountDetail = (
  queryClient: QueryClient,
  gameType: string,
  itemId: string | number,
) => {
  const id = String(itemId);
  const key = lztAccountDetailQueryKey(gameType, id);

  const state = queryClient.getQueryState(key);
  /** Evita novo GET a cada hover quando o último pedido falhou (ex.: 410 conta indisponível). */
  if (state?.status === "error") return;
  if (state?.fetchStatus === "fetching") return;

  const existing = queryClient.getQueryData(key);
  if (existing) return;

  queryClient.prefetchQuery({
    queryKey: key,
    queryFn: async () => {
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60_000, // 1 min
    /** Sem isto, o default (3 retries) repete o mesmo GET 410 várias vezes na consola. */
    retry: false,
  });
};
