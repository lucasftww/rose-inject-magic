/**
 * Safe fetching utilities to prevent "Unexpected token '<'" errors
 * when an API returns HTML instead of JSON.
 */

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

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new ApiError(
      `Request failed with status ${response.status}: ${errorText.substring(0, 100)}`,
      response.status,
      url
    );
  }

  const contentType = response.headers.get("Content-Type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error(`Expected JSON but received ${contentType} from ${url}. Body snippet: ${text.substring(0, 200)}`);
    throw new ApiError(
      `A resposta do servidor não é um JSON válido. O serviço pode estar temporariamente indisponível.`,
      response.status,
      url
    );
  }

  try {
    return (await response.json()) as T;
  } catch (err) {
    const text = await response.text().catch(() => "Could not read response body");
    console.error(`JSON parse error from ${url}. Body: ${text.substring(0, 200)}`, err);
    throw new ApiError(
      `Erro ao processar a resposta do servidor.`,
      response.status,
      url
    );
  }
};

/** Base URL for Supabase Edge Functions (prefers VITE_SUPABASE_URL over project id). */
export function getSupabaseFunctionsBaseUrl(): string | null {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL;
  if (typeof rawUrl === "string" && rawUrl.trim()) {
    try {
      return `${new URL(rawUrl.trim()).origin}/functions/v1`;
    } catch {
      /* invalid URL */
    }
  }
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (typeof projectId === "string" && projectId.trim()) {
    return `https://${projectId.trim()}.supabase.co/functions/v1`;
  }
  return null;
}
