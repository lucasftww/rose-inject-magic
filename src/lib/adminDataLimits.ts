/**
 * Limites defensivos para `fetchAllRows` no painel admin.
 * Ordenação por data (desc) → mantém os registos mais recentes dentro do teto.
 *
 * Escala ~100k+ pagamentos/mês: tectos altos para vários meses de histórico no mesmo conjunto.
 * Se o painel ficar lento ou a API Supabase limitar tempo/payload, o próximo passo é agregações SQL/RPC
 * em vez de carregar milhões de linhas no browser.
 */
export const ADMIN_MAX_PAYMENTS_COMPLETED = 2_000_000;
export const ADMIN_MAX_LZT_SALES_ROWS = 2_000_000;
export const ADMIN_MAX_RESELLER_PURCHASES = 1_000_000;
export const ADMIN_MAX_ORDER_TICKETS = 2_000_000;
