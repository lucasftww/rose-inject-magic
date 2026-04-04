import { isRecord } from "@/types/ticketChat";
import type { LztFortniteItemExtras, LztMinecraftItemExtras } from "@/types/lztGameDetailExtras";

/**
 * O item `detail` da API mistura campos base com extras de jogo no mesmo objeto.
 * Após `isRecord`, um único cast para o tipo de extras usado na UI.
 */
export function lztItemAsFortniteExtras(item: unknown): LztFortniteItemExtras | undefined {
  return isRecord(item) ? (item as LztFortniteItemExtras) : undefined;
}

export function lztItemAsMinecraftExtras(item: unknown): LztMinecraftItemExtras | undefined {
  return isRecord(item) ? (item as LztMinecraftItemExtras) : undefined;
}
