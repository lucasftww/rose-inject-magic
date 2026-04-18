/**
 * Shared in-memory cache for admin panel heavy data.
 * Prevents duplicate fetches when switching between Overview, Finance, Sales tabs.
 */

import { queryClient } from "@/lib/queryClient";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes — alinhado com staleTime das queries admin

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

// External cache invalidators registered by modules with their own caches
const _externalInvalidators: (() => void)[] = [];
export function registerCacheInvalidator(fn: () => void): void {
  _externalInvalidators.push(fn);
}

export function invalidateAdminCache(): void {
  cache.clear();
  _externalInvalidators.forEach(fn => fn());
  void queryClient.invalidateQueries({ queryKey: ["admin"] });
}

// ─── Shared USD/BRL rate ───
let _ratePromise: Promise<number> | null = null;
let _rateCacheTs = 0;
const RATE_TTL = 5 * 60 * 1000; // 5 min

export async function getUsdToBrl(fallback = 5.16): Promise<number> {
  const cached = getCached<number>("usd_brl", RATE_TTL);
  if (cached !== null) return cached;

  // Deduplicate concurrent calls
  if (_ratePromise && Date.now() - _rateCacheTs < RATE_TTL) return _ratePromise;

  _rateCacheTs = Date.now();
  _ratePromise = (async () => {
    try {
      const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      const data = await res.json();
      const bid = Number(data?.USDBRL?.bid);
      const rate = bid > 0 ? bid : fallback;
      setCache("usd_brl", rate);
      return rate;
    } catch {
      setCache("usd_brl", fallback);
      return fallback;
    }
  })();

  return _ratePromise;
}
