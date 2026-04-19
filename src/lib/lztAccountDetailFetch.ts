import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { throwApiError } from "@/lib/apiErrors";

/** Alinhado ao `queryClient` global — evita refetch ao montar se o prefetch/hover já encheu a cache. */
export const LZT_ACCOUNT_DETAIL_STALE_MS = 5 * 60 * 1000;

type DetailFetchError = Error & { readonly lztDetailHttpStatus: number };

function attachHttpStatus(err: Error, status: number): DetailFetchError {
  (err as DetailFetchError).lztDetailHttpStatus = status;
  return err as DetailFetchError;
}

export function isLztDetailHttpError(e: unknown, status: number): boolean {
  return (
    e !== null &&
    typeof e === "object" &&
    "lztDetailHttpStatus" in e &&
    (e as DetailFetchError).lztDetailHttpStatus === status
  );
}

/**
 * GET `lzt-market?action=detail` — único caminho para lista/hover/detalhe deduplicarem via TanStack Query.
 */
export async function fetchLztAccountDetail(
  gameType: string,
  itemId: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await fetch(
    `${supabaseUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=${encodeURIComponent(gameType)}`,
    {
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal,
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 410) {
      const sold = body?.error === "Account already sold";
      const err = new Error(
        sold ? "Esta conta já foi vendida." : "Esta conta não está mais disponível.",
      );
      throw attachHttpStatus(err, 410);
    }
    throwApiError(res.status);
  }
  return res.json();
}
