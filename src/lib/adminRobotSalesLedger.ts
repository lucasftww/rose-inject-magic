import type { Json } from "@/integrations/supabase/types";
import { paymentCartSnapshot } from "@/types/paymentCart";

/** Linha da tabela Lucro Robot / custos Robot na visão geral (não depende de `order_tickets`). */
export type RobotSale = {
  id: string;
  created_at: string;
  /** Present when a linha veio do carrinho (ex.: Finance / breakdown por produto). */
  product_id?: string;
  product_plan_id?: string;
  user_id?: string;
  product_name: string;
  plan_name: string;
  revenue: number;
  cost: number;
  profit: number;
  status: string;
  duration: number | null;
};

type RobotProductLedger = { id: string; name: string; robot_markup_percent: number | null };

type PaymentLedgerInput = {
  id?: string;
  user_id: string;
  amount: number;
  cart_snapshot: Json | null | undefined;
  paid_at?: string | null;
  created_at?: string | null;
};

/**
 * Monta o ledger de vendas Robot a partir de pagamentos COMPLETED + carrinho.
 * Não usa tickets entregues (evita sumir métricas ao apagar tickets).
 * Custo: estimativa por markup do produto (sem `amount_spent` do ticket apagado).
 */
export function buildRobotSalesLedgerFromPayments(
  robotProducts: RobotProductLedger[],
  planById: Record<string, { name: string; robot_duration_days: number | null }>,
  payments: PaymentLedgerInput[],
  periodStartIso: string | null,
): RobotSale[] {
  if (robotProducts.length === 0) return [];

  const productIds = new Set(robotProducts.map((p) => p.id));
  const productMap = Object.fromEntries(robotProducts.map((p) => [p.id, p]));

  const rows: RobotSale[] = [];

  for (const pay of payments) {
    const ts = pay.paid_at || pay.created_at || "";
    if (periodStartIso) {
      if (!ts || Number.isNaN(new Date(ts).getTime())) continue;
      if (new Date(ts).getTime() < new Date(periodStartIso).getTime()) continue;
    }

    const snapshot = paymentCartSnapshot(pay.cart_snapshot);
    if (snapshot.length === 0) continue;

    const cartTotal = snapshot.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const actualPaid = Number(pay.amount) / 100;
    const payKey = pay.id ?? `legacy-${pay.user_id}-${pay.created_at ?? "na"}-${pay.amount}`;

    snapshot.forEach((item, idx) => {
      if (!item.productId || !productIds.has(item.productId)) return;
      if (item.type === "lzt-account" || item.type === "raspadinha") return;

      const linePrice = Number(item.price) || 0;
      const proportion = cartTotal > 0 ? linePrice / cartTotal : 0;
      const revenue = Math.round(actualPaid * proportion * 100) / 100;

      const product = productMap[item.productId];
      const planId = item.planId || "";
      const plan = planId ? planById[planId] : undefined;

      let cost = 0;
      if (revenue > 0 && product?.robot_markup_percent != null) {
        cost = revenue / (1 + (product.robot_markup_percent || 50) / 100);
      }
      cost = Math.round(cost * 100) / 100;

      rows.push({
        id: `${payKey}:${idx}:${item.productId}:${planId}`,
        created_at: ts,
        product_id: item.productId,
        product_plan_id: planId || undefined,
        user_id: pay.user_id,
        product_name: product?.name || item.productName || "Desconhecido",
        plan_name: plan?.name || item.planName || "—",
        revenue,
        cost,
        profit: Math.round((revenue - cost) * 100) / 100,
        status: "COMPLETED",
        duration: plan?.robot_duration_days ?? null,
      });
    });
  }

  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return rows;
}
