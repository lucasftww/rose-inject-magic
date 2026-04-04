const MAX_URL_LEN = 2048;

/**
 * In-app path only for post-login redirects (?redirect=).
 * Blocks open redirects (external URLs, protocol-relative paths, backslashes, etc.).
 */
export function safeAuthRedirect(raw: string | null): string {
  if (!raw) return "/";
  const p = raw.trim();
  if (p === "/") return "/";
  if (!p || p.length > MAX_URL_LEN) return "/";
  if (p.includes("\0") || p.includes("\r") || p.includes("\n")) return "/";
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  if (p.includes("\\")) return "/";
  let decoded: string;
  try {
    decoded = decodeURIComponent(p);
  } catch {
    return "/";
  }
  if (decoded.startsWith("//")) return "/";
  const noQuery = decoded.split("?")[0] ?? decoded;
  if (noQuery.includes("://")) return "/";
  return p;
}

/**
 * Absolute http(s) URL safe for href= and window.open.
 * Blocks javascript:, data:, file:, blob:, and user:pass@ phishing.
 */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t || t.length > MAX_URL_LEN) return null;
  if (/\s/.test(t)) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username !== "" || u.password !== "") return null;
  return u.href;
}
