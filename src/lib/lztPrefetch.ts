import { QueryClient } from "@tanstack/react-query";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import {
  fetchLztAccountDetail,
  isLztDetailHttpError,
  LZT_ACCOUNT_DETAIL_STALE_MS,
} from "@/lib/lztAccountDetailFetch";

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

/** Atraso antes do GET: reduz 410 e rajadas ao cruzar a grelha sem intenção de abrir o detalhe. */
const PREFETCH_HOVER_MS = 520;

/** Limita GET `detail` em paralelo ao pairar vários cards (Network “Finish” e carga LZT). */
const PREFETCH_MAX_PARALLEL = 2;
let prefetchParallelActive = 0;
const prefetchParallelWaiters: Array<() => void> = [];

async function acquireDetailPrefetchSlot(): Promise<void> {
  while (prefetchParallelActive >= PREFETCH_MAX_PARALLEL) {
    await new Promise<void>((resolve) => {
      prefetchParallelWaiters.push(resolve);
    });
  }
  prefetchParallelActive += 1;
}

function releaseDetailPrefetchSlot(): void {
  prefetchParallelActive -= 1;
  prefetchParallelWaiters.shift()?.();
}

const prefetchHoverTimers = new Map<string, number>();

async function runDetailPrefetch(
  queryClient: QueryClient,
  gameType: string,
  id: string,
  dedupeKey: string,
  key: readonly ["lzt-account-detail", string, string],
): Promise<void> {
  await acquireDetailPrefetchSlot();
  detailPrefetchInFlight.add(dedupeKey);
  try {
    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: ({ signal }) => fetchLztAccountDetail(gameType, id, signal),
      staleTime: LZT_ACCOUNT_DETAIL_STALE_MS,
    });
  } catch (e: unknown) {
    if (isLztDetailHttpError(e, 410)) notifyLztAccountDetailGone(gameType, id);
  } finally {
    detailPrefetchInFlight.delete(dedupeKey);
    releaseDetailPrefetchSlot();
  }
}

/** Prefetch account detail data into React Query cache on hover for instant navigation. */
export const prefetchAccountDetail = (
  queryClient: QueryClient,
  gameType: string,
  itemId: string | number,
) => {
  if (typeof navigator !== "undefined") {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return;
  }

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

  const timerId = window.setTimeout(() => {
    prefetchHoverTimers.delete(dedupeKey);
    if (detailPrefetchGoneKeys.has(dedupeKey)) return;
    if (queryClient.getQueryData(key) != null) return;
    if (detailPrefetchInFlight.has(dedupeKey)) return;
    void runDetailPrefetch(queryClient, gameType, id, dedupeKey, key);
  }, PREFETCH_HOVER_MS);
  prefetchHoverTimers.set(dedupeKey, timerId);
};
