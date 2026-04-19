/** `localhost` (dev) ou `/contas?perf=1` em produção — diagnóstico no console (chunk vs lzt-market). */
export function isContasPerfDiagEnabled(): boolean {
  if (import.meta.env.DEV) return typeof performance !== "undefined";
  if (typeof window === "undefined" || typeof performance === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("perf") === "1";
  } catch {
    return false;
  }
}
