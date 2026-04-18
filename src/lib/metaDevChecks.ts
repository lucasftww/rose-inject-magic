/**
 * Avisos só em desenvolvimento — não substituem validação de credenciais no servidor.
 */
export function runMetaDevChecks(): void {
  if (!import.meta.env.DEV) return;
  const raw = String(import.meta.env.VITE_META_PIXEL_ID ?? "").trim();
  if (!raw) {
    console.warn("[Royal Meta] VITE_META_PIXEL_ID não definido no .env — o build usa o fallback do index.html.");
    return;
  }
  if (!/^\d{10,20}$/.test(raw)) {
    console.warn("[Royal Meta] VITE_META_PIXEL_ID deve ser só dígitos (10–20). Valor atual pode estar incorreto.");
  }
}
