import type { Json } from "@/integrations/supabase/types";
import { isRecord } from "@/types/ticketChat";

/** Linha típica em `payments.cart_snapshot` (JSON). */
export type PaymentCartLine = {
  type?: string;
  planId?: string;
  planName?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  price?: number;
  lztItemId?: string;
};

function lineFromJsonObject(el: Record<string, unknown>): PaymentCartLine {
  return {
    type: typeof el.type === "string" ? el.type : undefined,
    planId: typeof el.planId === "string" ? el.planId : undefined,
    planName: typeof el.planName === "string" ? el.planName : undefined,
    productId: typeof el.productId === "string" ? el.productId : undefined,
    productName: typeof el.productName === "string" ? el.productName : undefined,
    quantity: typeof el.quantity === "number" && Number.isFinite(el.quantity) ? el.quantity : undefined,
    price: typeof el.price === "number" && Number.isFinite(el.price) ? el.price : undefined,
    lztItemId: typeof el.lztItemId === "string" ? el.lztItemId : undefined,
  };
}

export function paymentCartSnapshot(cart: Json | null | undefined): PaymentCartLine[] {
  if (!Array.isArray(cart)) return [];
  const out: PaymentCartLine[] = [];
  for (const el of cart) {
    if (isRecord(el)) {
      out.push(lineFromJsonObject(el));
    }
  }
  return out;
}
