/**
 * Safe fetching utilities to prevent "Unexpected token '<'" errors
 * when an API returns HTML instead of JSON.
 */

import { supabaseUrl } from "@/integrations/supabase/client";

export class ApiError extends Error {
  constructor(public message: string, public status?: number, public url?: string) {
    super(message);
    this.name = "ApiError";
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetches JSON from a URL and verifies the response is actually JSON.
 * Throws an ApiError if the response is not JSON or the request fails.
 */
export const safeJsonFetch = async <T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const method = (options.method || "GET").toUpperCase();
  /** GET com corpo vazio mas 2xx acontece com falhas intermitentes de rede/CDN — retenta antes de falhar. */
  const maxAttempts = method === "GET" ? 3 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });

    /** Um único read do body — evita "body stream already read" no catch após .json() falhar. */
    const text = await response.text().catch(() => "");

    if (!response.ok) {
      throw new ApiError(
        `Request failed with status ${response.status}: ${text.substring(0, 100)}`,
        response.status,
        url
      );
    }

    const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      console.error(`Expected JSON but received ${contentType} from ${url}. Body snippet: ${text.substring(0, 200)}`);
      throw new ApiError(
        `A resposta do servidor não é um JSON válido. O serviço pode estar temporariamente indisponível.`,
        response.status,
        url
      );
    }

    const trimmed = text.trim();
    if (!trimmed) {
      const contentLength = response.headers.get("Content-Length");
      const canRetry =
        method === "GET" &&
        attempt < maxAttempts - 1 &&
        !options.signal?.aborted;
      if (canRetry) {
        console.warn(
          `Empty JSON body from ${url} (attempt ${attempt + 1}/${maxAttempts}) status=${response.status} content-length=${contentLength ?? "n/a"} — retrying`
        );
        await sleep(350 * (attempt + 1));
        continue;
      }
      console.error(
        `Empty JSON body from ${url} status=${response.status} content-length=${contentLength ?? "n/a"}`
      );
      throw new ApiError(
        `Erro ao processar a resposta do servidor.`,
        response.status,
        url
      );
    }

    try {
      return JSON.parse(trimmed) as T;
    } catch (err) {
      console.error(`JSON parse error from ${url}. Body: ${text.substring(0, 200)}`, err);
      throw new ApiError(
        `Erro ao processar a resposta do servidor.`,
        response.status,
        url
      );
    }
  }

  // Inalcançável com maxAttempts >= 1 (mantém o tipo de retorno explícito para o TS).
  throw new ApiError(`Erro ao processar a resposta do servidor.`, undefined, url);
};

/** Base URL for Supabase Edge Functions (same origin as `createClient` / dev fallbacks). */
export function getSupabaseFunctionsBaseUrl(): string | null {
  try {
    return `${new URL(supabaseUrl).origin}/functions/v1`;
  } catch {
    return null;
  }
}
