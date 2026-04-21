import { useEffect } from "react";
import { isLztDetailHttpError } from "@/lib/lztAccountDetailFetch";
import { notifyLztAccountDetailGone } from "@/lib/lztPrefetch";

/**
 * When `lzt-market?action=detail` returns 410, sync Contas grid + session cache by dispatching the same
 * event used by hover-prefetch — fixes “fantasma” cards after the listing sold.
 */
export function useLztAccountDetailGoneNotifier(
  gameType: string,
  itemId: string | undefined,
  error: unknown,
): void {
  useEffect(() => {
    if (!itemId) return;
    if (!isLztDetailHttpError(error, 410)) return;
    notifyLztAccountDetailGone(gameType, itemId);
  }, [gameType, itemId, error]);
}
