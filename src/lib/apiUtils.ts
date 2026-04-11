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

/**
 * Fetches JSON from a URL and verifies the response is actually JSON.
 * Throws an ApiError if the response is not JSON or the request fails.
 */
export const safeJsonFetch = async <T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/json",
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

  const contentType = response.headers.get("Content-Type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error(`Expected JSON but received ${contentType} from ${url}. Body snippet: ${text.substring(0, 200)}`);
    throw new ApiError(
      `A resposta do servidor não é um JSON válido. O serviço pode estar temporariamente indisponível.`,
      response.status,
      url
    );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    console.error(`Empty JSON body from ${url}`);
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
};

/** Base URL for Supabase Edge Functions (same origin as `createClient` / dev fallbacks). */
export function getSupabaseFunctionsBaseUrl(): string | null {
  try {
    return `${new URL(supabaseUrl).origin}/functions/v1`;
  } catch {
    return null;
  }
}
