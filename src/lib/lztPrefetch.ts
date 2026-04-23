import { QueryClient } from "@tanstack/react-query";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import {
  fetchLztAccountDetail,
  isLztDetailHttpError,
  LZT_ACCOUNT_DETAIL_STALE_MS,
} from "@/lib/lztAccountDetailFetch";
import type { GoneAccountDetailKey } from "@/lib/lztAccountDetailGoneStore";
import { rememberAccountDetailGone } from "@/lib/lztAccountDetailGoneStore";

/**
 * Prefetch de detalhe ao pairar no card:
 * - Ativo em **`pointer: fine`** (rato/trackpad): intenção clara, melhora abertura do detalhe.
 * - Desligar com **`?warm=0`** na URL (debug / poupar dados).
 * - Forçar também em touch/rede fraca com **`?warm=1`**.
 */
function isDetailHoverPrefetchEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = new URLSearchParams(window.location.search).get("warm");
    if (w === "0" || w === "false") return false;
    if (w === "1" || w === "true") return true;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(pointer: fine)")?.matches === true;
}

/** Contas 410 (vendida/indisponível): não repetir GET ao passar o rato. */
const detailPrefetchGoneKeys = new Set<string>();
const MAX_DETAIL_GONE_KEYS = 400;

/**
 * Disparado quando `lzt-market?action=detail` devolve 410 — a grelha de Contas pode remover o card
 * (lista/cache de sessão desatualizados) sem novo GET na consola.
 */
export const LZT_ACCOUNT_DETAIL_GONE_EVENT = "royal:lzt-account-detail-gone";

function rememberDetailPrefetchGone(dedupeKey: GoneAccountDetailKey): void {
  detailPrefetchGoneKeys.add(dedupeKey);
  rememberAccountDetailGone(dedupeKey);
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

/** Atraso antes do GET (hover desktop): reduz 410 e rajadas ao cruzar a grelha sem intenção de abrir o detalhe. */
const PREFETCH_HOVER_MS = 520;
/** Touch / pointer grosso: intenção já filtrada no hook (anti-scroll) — fila quase imediata. */
const PREFETCH_TOUCH_INTENT_MS = 0;

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

function isWarmUrlDisabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("warm") === "0";
  } catch {
    return false;
  }
}

function canPrefetchDetailNetwork(): boolean {
  if (typeof navigator !== "undefined") {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    if (conn?.saveData) return false;
    if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return false;
  }
  return true;
}

/**
 * Agenda GET `action=detail` com debounce por item. Usado por hover (desktop) e por touch (intenção já filtrada).
 */
function scheduleAccountDetailPrefetch(
  queryClient: QueryClient,
  gameType: string,
  itemId: string | number,
  delayMs: number,
): void {
  if (typeof window === "undefined") return;
  if (isWarmUrlDisabled()) return;
  if (!canPrefetchDetailNetwork()) return;

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
  }, delayMs);
  prefetchHoverTimers.set(dedupeKey, timerId);
}

/** Prefetch account detail data into React Query cache on hover for instant navigation. */
export const prefetchAccountDetail = (
  queryClient: QueryClient,
  gameType: string,
  itemId: string | number,
) => {
  if (!isDetailHoverPrefetchEnabled()) return;
  scheduleAccountDetailPrefetch(queryClient, gameType, itemId, PREFETCH_HOVER_MS);
};

/**
 * Prefetch após intenção explícita em touch / pointer grosso (anti-scroll no hook).
 * Respeita `?warm=0`, save-data e 2G como o hover.
 */
export function prefetchAccountDetailTouchIntent(
  queryClient: QueryClient,
  gameType: string,
  itemId: string | number,
): void {
  scheduleAccountDetailPrefetch(queryClient, gameType, itemId, PREFETCH_TOUCH_INTENT_MS);
}
