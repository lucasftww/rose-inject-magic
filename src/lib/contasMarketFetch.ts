import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import { throwApiError } from "@/lib/apiErrors";
import { isContasPerfDiagEnabled } from "@/lib/contasPerfDiag";
import type { LztMarketListResponse } from "./contasMarketTypes";

/**
 * Assinatura estável do GET da lista LZT (chaves ordenadas).
 * Usar em vez de `JSON.stringify(params)` evita falsos “novos filtros” só por ordem de chaves
 * e alinha a chave de cache com o URL real do `lzt-market`.
 */
export function lztMarketListQuerySignature(params: Record<string, string | string[]>): string {
  const keys = Object.keys(params).sort((a, b) => a.localeCompare(b));
  const queryParams = new URLSearchParams();
  for (const k of keys) {
    const v = params[k];
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const val of v) queryParams.append(k, val);
    } else {
      queryParams.set(k, String(v));
    }
  }
  return queryParams.toString();
}

export function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Request aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function fetchAccountsRaw(
  params: Record<string, string | string[]>,
  signal?: AbortSignal
): Promise<LztMarketListResponse> {
  const queryParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((val) => queryParams.append(k, val));
    else queryParams.set(k, v);
  }

  const perfDiag = isContasPerfDiagEnabled();
  const t0 = perfDiag ? performance.now() : 0;
  const qsShort = queryParams.toString().slice(0, 100);

  try {
    const out = await safeJsonFetch<LztMarketListResponse>(
      `${supabaseUrl}/functions/v1/lzt-market?${queryParams.toString()}`,
      {
        cache: "no-store",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        signal,
      }
    );
    if (perfDiag && t0) {
      const n = Array.isArray(out.items) ? out.items.length : 0;
      let approxKb = 0;
      try {
        const items = out.items;
        if (Array.isArray(items) && items.length > 0) {
          const sampleN = Math.min(4, items.length);
          let sum = 0;
          for (let i = 0; i < sampleN; i++) sum += JSON.stringify(items[i]).length;
          const avg = sum / sampleN;
          approxKb = Math.round((512 + avg * items.length) / 1024);
        } else {
          approxKb = Math.round(JSON.stringify(out).length / 1024);
        }
      } catch {
        approxKb = 0;
      }
      console.info(
        "[Contas perf] lzt-market",
        `${Math.round(performance.now() - t0)} ms`,
        `~${approxKb} KB JSON (est.)`,
        `${n} items`,
        "(compare TTFB vs Content Download in Network)",
        qsShort,
      );
    }
    return out;
  } catch (err: unknown) {
    if (perfDiag && t0) {
      const st = err instanceof ApiError ? ` status=${err.status}` : "";
      console.info("[Contas perf] lzt-market", Math.round(performance.now() - t0), "ms (erro)" + st, qsShort);
    }
    if (err instanceof ApiError) {
      if (err.status === 404) {
        throw new Error("O serviço de mercado não foi encontrado. Verifique a configuração da Supabase.");
      }
      const s = err.status || 500;
      if (s === 429 || (s >= 502 && s <= 504) || s === 524) throw err;
      throwApiError(s);
    }
    throw err;
  }
}
