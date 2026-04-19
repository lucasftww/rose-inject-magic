/**
 * Detecção partilhada de erros PostgREST em RPCs admin (finance, rollups, stock, scratch, LZT).
 */

export type RpcErrorish = { message?: string; code?: string; details?: string; hint?: string } | null;

function rpcErrorBlob(err: RpcErrorish): string {
  if (!err) return "";
  return [err.message, err.details, err.hint].filter(Boolean).join(" ").toLowerCase();
}

function normRpcCode(err: RpcErrorish): string {
  return String(err?.code || "").toUpperCase();
}

function messageLooksJwtAuthFailure(m: string): boolean {
  if (!m.includes("jwt") && !m.includes("jws") && !m.includes("bearer")) return false;
  return (
    m.includes("invalid jwt") ||
    m.includes("jwt expired") ||
    m.includes("could not verify jwt") ||
    m.includes("jwt claim") ||
    m.includes("missing jwt") ||
    m.includes("malformed jwt") ||
    m.includes("jws invalid") ||
    m.includes("no authorization") ||
    m.includes("authorization header")
  );
}

/** Sem permissão / JWT: não mascarar com fallback REST nem retry “legacy”. */
export function isAuthLikeRpcError(err: RpcErrorish): boolean {
  if (!err) return false;
  const c = normRpcCode(err);
  const m = rpcErrorBlob(err);
  if (c === "42501" || c === "PGRST301" || c === "PGRST302" || c === "PGRST303") return true;
  if (m.includes("forbidden")) return true;
  if (messageLooksJwtAuthFailure(m)) return true;
  if (m.includes("not authorized") || m.includes("unauthorized")) return true;
  return false;
}

/** Função RPC ausente / assinatura antiga no Postgres. */
function isRpcMissingError(err: RpcErrorish): boolean {
  if (!err?.message && !err?.code) return false;
  const m = rpcErrorBlob(err);
  const c = normRpcCode(err);
  return (
    m.includes("does not exist") ||
    m.includes("function public.admin_finance") ||
    c === "42883" ||
    c === "PGRST202"
  );
}

function pgrstNumericCode(c: string): number | null {
  if (!c.startsWith("PGRST")) return null;
  const n = Number.parseInt(c.slice(5), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Erros PostgREST frequentes em 400 (body/query inválido, cache de schema) ou função em falta:
 * o cliente pode degradar (REST em bulk, omitir rollups agregados, zeros noutras RPCs).
 */
export function isAdminRpcPostgrestFallbackError(err: RpcErrorish): boolean {
  if (!err) return false;
  if (isAuthLikeRpcError(err)) return false;
  const c = normRpcCode(err);
  const m = rpcErrorBlob(err);
  if (isRpcMissingError(err)) return true;
  if (c.startsWith("PGRST")) {
    const codes = new Set([
      "PGRST100",
      "PGRST102",
      "PGRST108",
      "PGRST116",
      "PGRST118",
      "PGRST120",
      "PGRST123",
      "PGRST200",
      "PGRST202",
      "PGRST203",
      "PGRST204",
      "PGRST205",
    ]);
    if (codes.has(c)) return true;
    const n = pgrstNumericCode(c);
    if (n != null && n >= 100 && n < 300) return true;
  }
  if (m.includes("schema cache")) return true;
  if (m.includes("bad request")) return true;
  if (m.includes("no function matches")) return true;
  if (m.includes("could not find the function")) return true;
  if (m.includes("invalid") && (m.includes("rpc") || m.includes("argument") || m.includes("parameter"))) return true;
  return false;
}

export function devWarnAdminRpc(
  source: "bulk" | "rollups" | "hooks" | "lzt",
  rpcName: string,
  step: string,
  err: RpcErrorish,
) {
  if (!import.meta.env.DEV || !err) return;
  console.warn(`[adminRpc:${source}] ${rpcName} — ${step}`, {
    code: err.code,
    message: err.message,
    details: err.details,
    hint: err.hint,
  });
}
