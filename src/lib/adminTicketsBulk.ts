import { supabase } from "@/integrations/supabase/client";

/**
 * Conta tickets por status (ex.: `delivered`). Requer sessão com permissão de leitura em `order_tickets`.
 */
export async function countOrderTicketsByStatus(status: string): Promise<number> {
  const { count, error } = await supabase
    .from("order_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Exclui todos os tickets com status `delivered`. Mensagens em `ticket_messages` somem por ON DELETE CASCADE.
 * Pagamentos e estoque não referenciam `order_tickets` no schema atual.
 * Requer política RLS de admin em `order_tickets` (DELETE).
 *
 * @returns quantidade de linhas removidas nesta chamada
 */
export async function deleteAllDeliveredOrderTickets(): Promise<number> {
  const { data, error } = await supabase.from("order_tickets").delete().eq("status", "delivered").select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
