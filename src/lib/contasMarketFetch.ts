import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import { throwApiError } from "@/lib/apiErrors";
import type { LztMarketListResponse } from "./contasMarketTypes";

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

  try {
    return await safeJsonFetch<LztMarketListResponse>(
      `${supabaseUrl}/functions/v1/lzt-market?${queryParams.toString()}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        signal,
      }
    );
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        throw new Error("O serviço de mercado não foi encontrado. Verifique a configuração da Supabase.");
      }
      throwApiError(err.status || 500);
    }
    throw err;
  }
}
