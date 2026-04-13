import { QueryClient } from "@tanstack/react-query";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";

/** Contas 410 (vendida/indisponível): não repetir GET ao passar o rato. */
const detailPrefetchGoneKeys = new Set<string>();
const MAX_DETAIL_GONE_KEYS = 400;

/**
 * Disparado quando `lzt-market?action=detail` devolve 410 — a grelha de Contas pode remover o card
 * (lista/cache de sessão desatualizados) sem novo GET na consola.
 */
export const LZT_ACCOUNT_DETAIL_GONE_EVENT = "royal:lzt-account-detail-gone";

function rememberDetailPrefetchGone(dedupeKey: string): void {
  detailPrefetchGoneKeys.add(dedupeKey);
  while (detailPrefetchGoneKeys.size > MAX_DETAIL_GONE_KEYS) {
    const oldest = detailPrefetchGoneKeys.values().next().value;
    if (oldest === undefined) break;
    detailPrefetchGoneKeys.delete(oldest);
  }
}

/** Marca o item como “gone” para prefetch e avisa a UI (ex.: Contas) para tirar da lista. */
export function notifyLztAccountDetailGone(gameType: string, itemId: string | number): void {
  const id = String(itemId);
  rememberDetailPrefetchGone(`${gameType}:${id}`);
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(LZT_ACCOUNT_DETAIL_GONE_EVENT, { detail: { gameType, itemId: id } }),
    );
  } catch {
    /* ignore */
  }
}

const detailPrefetchInFlight = new Set<string>();

/** Atraso antes do GET: reduz pedidos 410 ao cruzar a grelha sem intenção de abrir o detalhe. */
const PREFETCH_HOVER_MS = 420;
const prefetchHoverTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function runDetailPrefetch(
  queryClient: QueryClient,
  gameType: string,
  id: string,
  dedupeKey: string,
  key: readonly ["lzt-account-detail", string, string],
): Promise<void> {
  detailPrefetchInFlight.add(dedupeKey);
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
      notifyLztAccountDetailGone(gameType, id);
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
}

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

  const prevTimer = prefetchHoverTimers.get(dedupeKey);
  if (prevTimer != null) clearTimeout(prevTimer);

  prefetchHoverTimers.set(
    dedupeKey,
    window.setTimeout(() => {
      prefetchHoverTimers.delete(dedupeKey);
      if (detailPrefetchGoneKeys.has(dedupeKey)) return;
      if (queryClient.getQueryData(key) != null) return;
      if (detailPrefetchInFlight.has(dedupeKey)) return;
      void runDetailPrefetch(queryClient, gameType, id, dedupeKey, key);
    }, PREFETCH_HOVER_MS) as unknown as ReturnType<typeof setTimeout>,
  );
};
