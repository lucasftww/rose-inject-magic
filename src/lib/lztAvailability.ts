import { toast } from "@/hooks/use-toast";

/**
 * Checks if an LZT account is still available for purchase.
 * Returns true if available, false if sold/unavailable.
 */
export const checkLztAvailability = async (itemId: string, gameType: string): Promise<boolean> => {
  try {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(
      `${projectUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=${encodeURIComponent(gameType)}`,
      { headers: { "Content-Type": "application/json", apikey: anonKey } }
    );
    if (!res.ok) {
      toast({ title: "Erro ao verificar disponibilidade", description: "Tente novamente.", variant: "destructive" });
      return false;
    }
    const data = await res.json();
    const item = data?.item;
    if (!item) {
      toast({ title: "Conta indisponível", description: "Esta conta não está mais disponível para compra.", variant: "destructive" });
      return false;
    }
    if (item.buyer) {
      toast({ title: "Conta já vendida", description: "Esta conta foi vendida recentemente. Escolha outra.", variant: "destructive" });
      return false;
    }
    if (item.canBuyItem === false) {
      toast({ title: "Conta indisponível", description: "Esta conta não pode ser comprada no momento.", variant: "destructive" });
      return false;
    }
    return true;
  } catch {
    toast({ title: "Erro de conexão", description: "Não foi possível verificar a disponibilidade.", variant: "destructive" });
    return false;
  }
};
