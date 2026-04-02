import { toast } from "@/hooks/use-toast";

type LztDetailErrorBody = {
  error?: string;
  message?: string;
};

async function readJsonErrorBody(res: Response): Promise<LztDetailErrorBody | null> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const o = data as Record<string, unknown>;
      const error = o.error;
      const message = o.message;
      return {
        error: typeof error === "string" ? error : undefined,
        message: typeof message === "string" ? message : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isSoldMessage(body: LztDetailErrorBody | null): boolean {
  const t = `${body?.error ?? ""} ${body?.message ?? ""}`.toLowerCase();
  return (
    body?.error === "Account already sold" ||
    t.includes("already sold") ||
    t.includes("já foi vendid") ||
    t.includes("account already sold")
  );
}

/**
 * Checks if an LZT account is still available for purchase.
 * Returns true if available, false if sold/unavailable.
 */
export const checkLztAvailability = async (itemId: string, gameType: string): Promise<boolean> => {
  const normalizedId = String(itemId);
  try {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(
      `${projectUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(normalizedId)}&game_type=${encodeURIComponent(gameType)}`,
      { headers: { "Content-Type": "application/json", apikey: anonKey } }
    );
    if (!res.ok) {
      const errBody = await readJsonErrorBody(res);
      if (res.status === 410) {
        const sold = isSoldMessage(errBody);
        toast({
          title: sold ? "Conta já vendida" : "Conta indisponível",
          description: sold
            ? "Esta conta foi vendida recentemente. Escolha outra."
            : "Esta conta não está mais disponível para compra.",
          variant: "destructive",
        });
        return false;
      }
      const hint = errBody?.error || errBody?.message;
      toast({
        title: "Erro ao verificar disponibilidade",
        description: typeof hint === "string" && hint.length > 0 ? hint : "Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
    const data = await res.json();
    const item = data?.item;
    if (!item) {
      toast({ title: "Conta indisponível", description: "Esta conta não está mais disponível para compra.", variant: "destructive" });
      return false;
    }
    // Check item_state (closed = sold, deleted = removed)
    if (item.item_state && item.item_state !== "active") {
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
