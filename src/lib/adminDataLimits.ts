/**
 * Limites defensivos para RPC / `fetchAllRows` no painel admin (sempre mais recentes primeiro).
 * Valores altos demais (ex.: 2M) estouram memória do browser ao fazer `useMemo`/gráficos no cliente.
 * Para totais “todo o histórico” sem truncar, o passo seguinte é agregação em SQL (somas/RPC), não subir estes números.
 */
export const ADMIN_MAX_PAYMENTS_COMPLETED = 120_000;
export const ADMIN_MAX_LZT_SALES_ROWS = 120_000;
export const ADMIN_MAX_RESELLER_PURCHASES = 80_000;
export const ADMIN_MAX_ORDER_TICKETS = 150_000;
