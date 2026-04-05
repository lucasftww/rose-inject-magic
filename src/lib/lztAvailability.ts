import type { QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import {
  type LztDetailItem,
  itemFailsLztNotSoldBeforePolicy,
  parseLztDetailResponseItem,
} from "@/lib/lztDetailItemParse";
import { isRecord } from "@/types/ticketChat";

type LztDetailErrorBody = {
  error?: string;
  message?: string;
};

async function readJsonErrorBody(res: Response): Promise<LztDetailErrorBody | null> {
  try {
    const data: unknown = await res.json();
    if (!isRecord(data)) return null;
    const error = data.error;
    const message = data.message;
    return {
      error: typeof error === "string" ? error : undefined,
      message: typeof message === "string" ? message : undefined,
    };
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

/** Mesma regra da resposta `detail` após JSON ok (sem toast). */
export function isLztDetailItemPurchasable(item: LztDetailItem | null | undefined): boolean {
  if (!item) return false;
  if (itemFailsLztNotSoldBeforePolicy(item as Record<string, unknown>)) return false;
  if (item.item_state && item.item_state !== "active") return false;
  if (item.buyer) return false;
  if (item.canBuyItem === false) return false;
  return true;
}

function toastItemNotPurchasable(item: LztDetailItem) {
  if (itemFailsLztNotSoldBeforePolicy(item as Record<string, unknown>)) {
    toast({
      title: "Conta indisponível",
      description: "Esta conta já foi comercializada antes em outro canal e não entra na nossa seleção.",
      variant: "destructive",
    });
    return;
  }
  if (item.buyer) {
    toast({
      title: "Conta já vendida",
      description: "Esta conta foi vendida recentemente. Escolha outra.",
      variant: "destructive",
    });
    return;
  }
  if (item.canBuyItem === false) {
    toast({
      title: "Conta indisponível",
      description: "Esta conta não pode ser comprada no momento.",
      variant: "destructive",
    });
    return;
  }
  toast({
    title: "Conta indisponível",
    description: "Esta conta não está mais disponível para compra.",
    variant: "destructive",
  });
}

/**
 * Checks if an LZT account is still available for purchase.
 * Returns true if available, false if sold/unavailable.
 */
export const checkLztAvailability = async (
  itemId: string,
  gameType: string,
  options?: {
    /** Se a query de detalhe ainda está fresca (`staleTime`), reaproveita cache e evita um segundo GET. */
    queryClient?: QueryClient;
  },
): Promise<boolean> => {
  const normalizedId = String(itemId);
  const qc = options?.queryClient;
  if (qc) {
    const key = lztAccountDetailQueryKey(gameType, normalizedId);
    const state = qc.getQueryState(key);
    const data = qc.getQueryData<{ item?: LztDetailItem }>(key);
    const cached = data?.item;
    if (state && data && cached && String(cached.item_id) === normalizedId && !(state as { isStale?: boolean }).isStale) {
      if (isLztDetailItemPurchasable(cached)) return true;
      toastItemNotPurchasable(cached);
      return false;
    }
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(normalizedId)}&game_type=${encodeURIComponent(gameType)}`,
      { headers: { "Content-Type": "application/json", apikey: supabaseAnonKey } }
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
    const data: unknown = await res.json();
    const item = parseLztDetailResponseItem(data);
    if (!item) {
      toast({ title: "Conta indisponível", description: "Esta conta não está mais disponível para compra.", variant: "destructive" });
      return false;
    }
    if (isLztDetailItemPurchasable(item)) return true;
    toastItemNotPurchasable(item);
    return false;
  } catch {
    toast({ title: "Erro de conexão", description: "Não foi possível verificar a disponibilidade.", variant: "destructive" });
    return false;
  }
};
