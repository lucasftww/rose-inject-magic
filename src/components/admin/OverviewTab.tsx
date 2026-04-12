import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { getCached, setCache, getUsdToBrl, invalidateAdminCache } from "@/lib/adminCache";
import { buildRobotSalesLedgerFromPayments } from "@/lib/adminRobotSalesLedger";
import { paymentCartSnapshot } from "@/types/paymentCart";
import { asOrderTicketMetadata } from "@/types/orderTicketMetadata";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Loader2, DollarSign, ShoppingCart, Users,
  Package, Receipt, RefreshCw, TrendingUp, Clock,
  AlertTriangle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type OrderTicketRow = Database["public"]["Tables"]["order_tickets"]["Row"];

interface OrderTicket extends OrderTicketRow {
  product_name?: string;
  product_image?: string | null;
  plan_name?: string;
  username?: string;
}

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

type LztSalesCostRow = Pick<Tables<"lzt_sales">, "buy_price" | "created_at">;

/** Linhas agregadas (fetchAllRows) — sem exigir todos os campos da tabela */
type PaymentAggregate = Pick<
  PaymentRow,
  "id" | "amount" | "discount_amount" | "user_id" | "cart_snapshot" | "status" | "created_at" | "paid_at"
>;

const statusColors: Record<string, string> = {
  open: "bg-warning/15 text-warning border-warning/20",
  delivered: "bg-success/15 text-success border-success/20",
  waiting: "bg-info/15 text-info border-info/20",
  waiting_staff: "bg-info/15 text-info border-info/20",
  resolved: "bg-positive/15 text-positive border-positive/20",
  closed: "bg-muted/50 text-muted-foreground border-border",
  banned: "bg-destructive/15 text-destructive border-destructive/20",
  finished: "bg-muted/50 text-muted-foreground border-border",
  archived: "bg-muted/50 text-muted-foreground border-border",
};
const statusLabels: Record<string, string> = {
  open: "Aberto",
  delivered: "Entregue",
  waiting: "Aguardando",
  waiting_staff: "Aguardando Equipe",
  resolved: "Resolvido",
  closed: "Encerrado",
  banned: "Banido",
  finished: "Finalizado",
  archived: "Arquivado",
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Period = "24h" | "7d" | "30d" | "all";

const PERIOD_OPTIONS = [
  ["24h", "24h"],
  ["7d", "7d"],
  ["30d", "30d"],
  ["all", "Tudo"],
] as const satisfies ReadonlyArray<readonly [Period, string]>;

const filterByPeriod = <T extends { created_at?: string | null; paid_at?: string | null }>(
  items: T[], period: Period, dateField: "created_at" | "paid_at" = "paid_at"
): T[] => {
  if (period === "all") return items;
  const ms = period === "24h" ? 86400000 : period === "7d" ? 7 * 86400000 : 30 * 86400000;
  const cutoff = Date.now() - ms;
  return items.filter(i => {
    const d = dateField === "paid_at" ? (i.paid_at ?? i.created_at) : i.created_at;
    const t = d ? new Date(d).getTime() : NaN;
    return Number.isFinite(t) && t >= cutoff;
  });
};

type OverviewDashboardData = {
  openTickets: number;
  allOrders: OrderTicket[];
  allPayments: PaymentAggregate[];
  recentOrders: OrderTicket[];
  recentPayments: PaymentRow[];
  lztSales: { buy_price: number; created_at: string }[];
  robotCosts: { cost: number; created_at: string }[];
};

async function fetchOverviewDashboard(): Promise<OverviewDashboardData> {
  let robotCosts: { cost: number; created_at: string }[] = [];
  try {
    const usdToBrl = await getUsdToBrl();

      // Use shared cache for heavy queries
      const CACHE_KEY_PAYMENTS = "admin_payments_completed_v2";
      const CACHE_KEY_ORDERS = "admin_orders_all";
      const CACHE_KEY_LZT_COSTS = "admin_lzt_costs";

      const cachedPayments = getCached<PaymentAggregate[]>(CACHE_KEY_PAYMENTS);
      const cachedOrders = getCached<OrderTicketRow[]>(CACHE_KEY_ORDERS);
      const cachedLztCosts = getCached<LztSalesCostRow[]>(CACHE_KEY_LZT_COSTS);

      const [recentOrdersRes, recentPaymentsRes, allPaymentsRes, robotProductsRes, openTicketsRes, allOrdersRes, lztSalesRes] = await Promise.all([
        supabase.from("order_tickets").select("*").order("created_at", { ascending: false }).limit(6),
        supabase.from("payments").select("*").eq("status", "COMPLETED").order("paid_at", { ascending: false }).limit(12),
        cachedPayments
          ? Promise.resolve(cachedPayments)
          : fetchAllRows<PaymentAggregate>("payments", {
              select: "id, amount, discount_amount, user_id, cart_snapshot, status, created_at, paid_at",
              filters: [{ column: "status", op: "eq", value: "COMPLETED" }],
            }),
        supabase.from("products").select("id, name, robot_game_id, robot_markup_percent").not("robot_game_id", "is", null),
        supabase.from("order_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "waiting", "waiting_staff"]),
        cachedOrders
          ? Promise.resolve(cachedOrders)
          : fetchAllRows<OrderTicketRow>("order_tickets", {
              select: "id, product_id, product_plan_id, user_id, metadata, status, created_at, status_label",
            }),
        cachedLztCosts
          ? Promise.resolve(cachedLztCosts)
          : fetchAllRows<LztSalesCostRow>("lzt_sales", {
              select: "buy_price, created_at",
            }),
      ]);

      // Persist to shared cache
      if (!cachedPayments && Array.isArray(allPaymentsRes)) setCache(CACHE_KEY_PAYMENTS, allPaymentsRes);
      if (!cachedOrders && Array.isArray(allOrdersRes)) setCache(CACHE_KEY_ORDERS, allOrdersRes);
      if (!cachedLztCosts && Array.isArray(lztSalesRes)) setCache(CACHE_KEY_LZT_COSTS, lztSalesRes);

      const openTickets = openTicketsRes.count ?? 0;
      const allPayments = (allPaymentsRes || []) as PaymentAggregate[];
      const allOrders = (allOrdersRes || []) as OrderTicket[];
      const lztSales = (lztSalesRes || []).map((s) => ({
        buy_price: Number(s.buy_price) || 0,
        created_at: String(s.created_at ?? ""),
      }));

      if (robotProductsRes.error) {
        console.warn("OverviewTab: produtos Robot", robotProductsRes.error.message);
        toast({
          title: "Visão geral: métricas Robot incompletas",
          description: robotProductsRes.error.message,
          variant: "destructive",
        });
      }

      // Robot costs with timestamps
      const robotProducts = robotProductsRes.data || [];
      if (robotProducts.length > 0) {
        const productIds = robotProducts.map((p) => p.id);
        const productMap = Object.fromEntries(robotProducts.map((p) => [p.id, p]));

        const plansRes = await supabase
          .from("product_plans")
          .select("id, name, price, robot_duration_days")
          .in("product_id", productIds);

        const planById = Object.fromEntries(
          (plansRes.data || []).map((p) => [p.id, { name: p.name, robot_duration_days: p.robot_duration_days }]),
        );

        const ledger = buildRobotSalesLedgerFromPayments(
          robotProducts.map((p) => ({ id: p.id, name: p.name, robot_markup_percent: p.robot_markup_percent })),
          planById,
          (allPaymentsRes || []).map((p) => ({
            id: p.id,
            user_id: p.user_id,
            amount: Number(p.amount),
            cart_snapshot: p.cart_snapshot,
            paid_at: p.paid_at,
            created_at: p.created_at,
          })),
          null,
        );
        robotCosts = ledger.map((r) => ({ cost: r.cost, created_at: r.created_at }));
      }

      let recentOrders: OrderTicket[] = [];
      if (recentOrdersRes.data) {
        const rows: OrderTicketRow[] = recentOrdersRes.data;
        const productIds = [...new Set(rows.map((t) => t.product_id))];
        const planIds = [...new Set(rows.map((t) => t.product_plan_id))];
        const [prodsRes, plansRes] = await Promise.all([
          productIds.length > 0 ? supabase.from("products").select("id, name, image_url").in("id", productIds) : { data: [] as { id: string; name: string; image_url: string | null }[] },
          planIds.length > 0 ? supabase.from("product_plans").select("id, name").in("id", planIds) : { data: [] as { id: string; name: string }[] },
        ]);
        const prodMap: Record<string, { name: string; image_url: string | null }> = {};
        const planMap: Record<string, string> = {};
        (prodsRes.data || []).forEach((p: { id: string; name: string; image_url: string | null }) => { prodMap[p.id] = { name: p.name, image_url: p.image_url }; });
        (plansRes.data || []).forEach((p: { id: string; name: string }) => { planMap[p.id] = p.name; });

        recentOrders = rows.map((t) => {
          const meta = asOrderTicketMetadata(t.metadata);
          const isLzt = meta.type === "lzt-account";
          const prod = prodMap[t.product_id];
          return {
            ...t,
            product_name: isLzt ? (meta.title || meta.account_name || "Conta LZT") : (prod?.name || "Produto"),
            product_image: isLzt ? null : (prod?.image_url || null),
            plan_name: isLzt ? "Conta LZT" : (planMap[t.product_plan_id] || "Plano"),
            username: "...",
          };
        });
      }

      const recentPayments = (recentPaymentsRes.data ?? []) as PaymentRow[];

      return {
        openTickets,
        allOrders,
        allPayments,
        recentOrders,
        recentPayments,
        lztSales,
        robotCosts,
      };
  } catch (err) {
    console.error("OverviewTab fetchOverviewDashboard error:", err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

const OverviewTab = ({ onGoToTicket }: { onGoToTicket?: (ticketId: string) => void }) => {
  const { users: adminUsers, usernameMap } = useAdminUsers();
  const { data, isPending: loading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: fetchOverviewDashboard,
    staleTime: 3 * 60 * 1000,
  });

  const openTickets = data?.openTickets ?? 0;
  const allOrders = useMemo(() => data?.allOrders ?? [], [data]);
  const allPayments = useMemo(() => data?.allPayments ?? [], [data]);
  const recentOrders = useMemo(() => data?.recentOrders ?? [], [data]);
  const recentPayments = useMemo(() => data?.recentPayments ?? [], [data]);
  const lztSales = useMemo(() => data?.lztSales ?? [], [data]);
  const robotCosts = useMemo(() => data?.robotCosts ?? [], [data]);
  const [period, setPeriod] = useState<Period>("24h");

  // Period-filtered metrics (memoized to avoid recalculating on every render)
  const filteredPayments = useMemo(() => filterByPeriod(allPayments, period), [allPayments, period]);
  const filteredOrders = useMemo(() => filterByPeriod(allOrders, period, "created_at"), [allOrders, period]);
  const periodRevenue = useMemo(() => filteredPayments.reduce((s, p) => s + Number(p.amount) / 100, 0), [filteredPayments]);
  /** Tickets cuja data de criação cai no período (pode divergir de pagamentos no mesmo período). */
  const periodTicketCount = filteredOrders.length;
  const periodPaidCount = filteredPayments.length;

  // Period-filtered costs — consistent with revenue period
  const periodLztCost = useMemo(() => {
    const filtered = filterByPeriod(lztSales.map(s => ({ ...s, paid_at: null })), period, "created_at");
    return filtered.reduce((s, l) => s + l.buy_price, 0);
  }, [lztSales, period]);

  const periodRobotCost = useMemo(() => {
    const filtered = filterByPeriod(robotCosts.map(r => ({ ...r, paid_at: null })), period, "created_at");
    return filtered.reduce((s, r) => s + r.cost, 0);
  }, [robotCosts, period]);

  // Note: discount_amount is NOT subtracted from profit because payments.amount
  // already stores the post-discount value (the actual money received).
  // Subtracting it again would double-count discounts.

  const netProfit = periodRevenue - (periodLztCost + periodRobotCost);
  const profitMargin = periodRevenue > 0 ? (netProfit / periodRevenue) * 100 : 0;

  const periodLabel = period === "24h" ? "24h" : period === "7d" ? "7 dias" : period === "30d" ? "30 dias" : "Total";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-success" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-foreground">Visão Geral</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
            {PERIOD_OPTIONS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${
                  period === key ? "bg-success text-success-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              invalidateAdminCache();
              void refetch();
            }}
            disabled={isFetching}
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Margin Alert — simplified, no editable threshold */}
      {profitMargin < 30 && periodRevenue > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-muted-foreground">
            Margem atual: <span className="font-bold text-destructive">{profitMargin.toFixed(1)}%</span> — Revise seus custos.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-success/20 bg-success/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-success" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Receita</span>
          </div>
          <p className="text-2xl font-bold text-success tracking-tight">R$ {periodRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{periodPaidCount} vendas · {periodLabel}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-positive" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lucro</span>
          </div>
          <p className="text-2xl font-bold text-positive tracking-tight">R$ {fmt(netProfit)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Margem {profitMargin.toFixed(1)}% · {periodLabel}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-4 w-4 text-info" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pagamentos</span>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{periodPaidCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {periodTicketCount} ticket{periodTicketCount === 1 ? "" : "s"} criado{periodTicketCount === 1 ? "" : "s"} no período (por data do ticket)
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-warning" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{adminUsers.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {openTickets > 0 ? <span className="text-warning font-semibold">{openTickets} tickets abertos</span> : "Nenhum ticket aberto"}
          </p>
        </div>
      </div>

      {/* Recent Sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-success" />
              Últimos Pedidos
            </h3>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
            ) : recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => onGoToTicket?.(order.id)}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 group"
              >
                <div className="relative shrink-0">
                  {order.product_image ? (
                    <img
                      src={order.product_image}
                      alt={order.product_name}
                      className="h-9 w-9 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary border border-border">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card ${
                    order.status === "delivered" ? "bg-success" :
                    order.status === "open" || order.status === "waiting" || order.status === "waiting_staff" ? "bg-warning" :
                    "bg-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{order.product_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">{usernameMap.get(order.user_id) || "..."}</span>
                    <span className="text-muted-foreground/30 text-[10px]">•</span>
                    <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(order.created_at || new Date().toISOString())}
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusColors[order.status || ""] || "bg-muted/50 text-muted-foreground border-border"}`}>
                  {statusLabels[order.status || ""] || order.status_label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-positive" />
              Últimas Vendas
            </h3>
            <button 
              onClick={() => {
                // No-op: the user should navigate via the sidebar to Histórico Pix.
              }}
              className="text-[10px] font-bold text-success hover:underline uppercase hidden"
            >
              Ver tudo
            </button>
          </div>
          <div className="divide-y divide-border">
            {recentPayments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</p>
            ) : recentPayments.map((p) => {
              const cartItems = paymentCartSnapshot(p.cart_snapshot);
              const productName = cartItems[0]?.productName || "—";
              const amountBrl = Number(p.amount) / 100;
              const priceLabel =
                amountBrl <= 0 && p.payment_method === "free"
                  ? "Grátis"
                  : amountBrl <= 0
                    ? "R$ 0,00"
                    : `R$ ${amountBrl.toFixed(2).replace(".", ",")}`;

              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-positive/10 shrink-0">
                    <DollarSign className="h-3.5 w-3.5 text-positive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{productName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 inline opacity-50" />
                      {p.paid_at ? timeAgo(p.paid_at) : timeAgo(p.created_at || new Date().toISOString())}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">{priceLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
