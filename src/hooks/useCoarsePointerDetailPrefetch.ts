import { useRef, useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { prefetchAccountDetailTouchIntent } from "@/lib/lztPrefetch";

/** Movimento maior que isto ⇒ scroll/drag — não prefetch (evita rajadas na grelha). */
const MOVE_CANCEL_SQ = 12 * 12;
/** Sem mover o dedo: prefetch após este tempo (antes do tap terminar). */
const HOLD_PREFETCH_MS = 170;
/** Tap rápido: só prefetch no `pointerup` se o gesto for curto. */
const TAP_MAX_DURATION_MS = 540;

function isCoarseLikePointer(e: React.PointerEvent): boolean {
  if (e.pointerType === "touch") return true;
  if (typeof window === "undefined") return false;
  if (e.pointerType === "pen") return window.matchMedia("(pointer: coarse)").matches;
  return false;
}

/**
 * Prefetch do JSON de detalhe em **touch / pointer grosso**, com salvaguardas anti-scroll:
 * - cancela se o dedo se mover mais que ~12px;
 * - cancela ao sair do card (`pointerleave`);
 * - toque rápido dispara prefetch no `pointerup`; toque longo estático dispara ao timer (~170ms).
 */
export function useCoarsePointerDetailPrefetch(
  queryClient: QueryClient,
  gameType: string,
  itemId: string | number,
) {
  const ptr = useRef<{
    x: number;
    y: number;
    t: number;
    moved: boolean;
    holdTimer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const clearHoldTimer = useCallback(() => {
    const p = ptr.current;
    if (p?.holdTimer != null) {
      clearTimeout(p.holdTimer);
      p.holdTimer = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isCoarseLikePointer(e)) return;
      clearHoldTimer();
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      ptr.current = {
        x: e.clientX,
        y: e.clientY,
        t: t0,
        moved: false,
        holdTimer: window.setTimeout(() => {
          const p = ptr.current;
          if (!p || p.moved) return;
          prefetchAccountDetailTouchIntent(queryClient, gameType, itemId);
          clearHoldTimer();
        }, HOLD_PREFETCH_MS),
      };
    },
    [queryClient, gameType, itemId, clearHoldTimer],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = ptr.current;
      if (!p || p.moved) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (dx * dx + dy * dy > MOVE_CANCEL_SQ) {
        p.moved = true;
        clearHoldTimer();
      }
    },
    [clearHoldTimer],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const p = ptr.current;
      clearHoldTimer();
      ptr.current = null;
      if (!p || p.moved) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (dx * dx + dy * dy > MOVE_CANCEL_SQ) return;
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (t1 - p.t > TAP_MAX_DURATION_MS) return;
      prefetchAccountDetailTouchIntent(queryClient, gameType, itemId);
    },
    [queryClient, gameType, itemId, clearHoldTimer],
  );

  const onPointerCancel = useCallback(() => {
    clearHoldTimer();
    ptr.current = null;
  }, [clearHoldTimer]);

  const onPointerLeave = useCallback(() => {
    clearHoldTimer();
    ptr.current = null;
  }, [clearHoldTimer]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
  };
}
