import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Loader2, DollarSign, ShoppingCart, Users,
  Package, Receipt, RefreshCw, TrendingUp, Clock,
  AlertTriangle
} from "lucide-react";

interface OrderTicket {
  id: string;
  product_id: string;
  product_plan_id: string;
  status: string;
  status_label: string;
  created_at: string;
  user_id: string;
  product_name?: string;
  product_image?: string | null;
  plan_name?: string;
  username?: string;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  user_id: string;
  cart_snapshot: any;
  discount_amount: number;
}

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

const filterByPeriod = <T extends { created_at?: string; paid_at?: string | null }>(
  items: T[], period: Period, dateField: "created_at" | "paid_at" = "paid_at"
): T[] => {
  if (period === "all") return items;
  const ms = period === "24h" ? 86400000 : period === "7d" ? 7 * 86400000 : 30 * 86400000;
  const cutoff = Date.now() - ms;
  return items.filter(i => {
    const d = dateField === "paid_at" ? ((i as any).paid_at || (i as any).created_at) : (i as any).created_at;
    return new Date(d).getTime() >= cutoff;
  });
};

const OverviewTab = ({ onGoToTicket }: { onGoToTicket?: (ticketId: string) => void }) => {
  const { users: adminUsers, usernameMap } = useAdminUsers();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState<Period>("24h");
  const [openTickets, setOpenTickets] = useState(0);
  const [allOrders, setAllOrders] = useState<OrderTicket[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderTicket[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);

  // Profit data
  const [lztCost, setLztCost] = useState(0);
  const [lztProfit, setLztProfit] = useState(0);
  const [robotCost, setRobotCost] = useState(0);
  const [robotProfit, setRobotProfit] = useState(0);
  const [totalDiscounts, setTotalDiscounts] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      let usdToBrl = 5.5;
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const json = await res.json();
        if (json?.rates?.BRL) usdToBrl = json.rates.BRL;
      } catch { /* fallback */ }

      const [recentOrdersRes, recentPaymentsRes, lztRes, allPaymentsRes, robotProductsRes, openTicketsRes, allOrdersRes] = await Promise.all([
        supabase.from("order_tickets").select("*").order("created_at", { ascending: false }).limit(6),
        supabase.from("payments").select("*").eq("status", "COMPLETED").order("paid_at", { ascending: false }).limit(6),
        supabase.rpc("admin_lzt_stats"),
        fetchAllRows("payments", {
          select: "amount, discount_amount, user_id, cart_snapshot, status, created_at, paid_at",
          filters: [{ column: "status", op: "eq", value: "COMPLETED" }],
        }),
        supabase.from("products").select("id, name, robot_game_id, robot_markup_percent").not("robot_game_id", "is", null),
        supabase.from("order_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "waiting", "waiting_staff"]),
        fetchAllRows("order_tickets", {
          select: "id, product_id, product_plan_id, user_id, metadata, status, created_at, status_label",
        }),
      ]);

      setOpenTickets(openTicketsRes.count ?? 0);
      setAllPayments(allPaymentsRes || []);
      setAllOrders(allOrdersRes || []);

      const discTotal = (allPaymentsRes || []).reduce((s: number, p: any) => s + (Number(p.discount_amount) || 0), 0);
      setTotalDiscounts(discTotal);

      if (lztRes.data) {
        const l = lztRes.data as any;
        if (!l.error) {
          setLztProfit(Number(l.total_profit));
          setLztCost(Number(l.total_bought));
        }
      }

      // Robot profit
      const robotProducts = robotProductsRes.data || [];
      if (robotProducts.length > 0) {
        const productIds = robotProducts.map((p: any) => p.id);
        const productMap = Object.fromEntries(robotProducts.map((p: any) => [p.id, p]));

        const [ticketsRes, plansRes] = await Promise.all([
          fetchAllRows("order_tickets", {
            select: "id, product_id, product_plan_id, user_id, metadata, status",
            filters: [{ column: "status", op: "eq", value: "delivered" }],
          }),
          supabase.from("product_plans").select("id, name, price").in("product_id", productIds),
        ]);

        const robotTickets = (ticketsRes || []).filter((t: any) => productIds.includes(t.product_id));
        const planMap = Object.fromEntries((plansRes.data || []).map((p: any) => [p.id, p]));

        const paidPriceMap = new Map<string, number>();
        for (const pay of (allPaymentsRes || [])) {
          const snapshot = pay.cart_snapshot as any[];
          if (!Array.isArray(snapshot)) continue;
          for (const item of snapshot) {
            const key = `${pay.user_id}|${item.productId}|${item.planId}`;
            if (!paidPriceMap.has(key) && item.price != null) {
              paidPriceMap.set(key, Number(item.price));
            }
          }
        }

        let rRev = 0, rCost = 0;
        robotTickets.forEach((t: any) => {
          const product = productMap[t.product_id];
          const plan = planMap[t.product_plan_id];
          const meta = (t.metadata || {}) as Record<string, any>;
          const revenue = paidPriceMap.get(`${t.user_id}|${t.product_id}|${t.product_plan_id}`) ?? plan?.price ?? 0;
          let cost = 0;
          if (meta.amount_spent && Number(meta.amount_spent) > 0) {
            cost = Number(meta.amount_spent) * usdToBrl;
          } else if (!meta.is_free && product?.robot_markup_percent) {
            cost = revenue / (1 + (product.robot_markup_percent || 50) / 100);
          }
          rRev += revenue;
          rCost += Math.round(cost * 100) / 100;
        });

        setRobotCost(rCost);
        setRobotProfit(Math.round((rRev - rCost) * 100) / 100);
      }

      if (recentOrdersRes.data) {
        const productIds = [...new Set((recentOrdersRes.data as any[]).map((t: any) => t.product_id))];
        const planIds = [...new Set((recentOrdersRes.data as any[]).map((t: any) => t.product_plan_id))];
        const [prodsRes, plansRes] = await Promise.all([
          productIds.length > 0 ? supabase.from("products").select("id, name, image_url").in("id", productIds) : { data: [] },
          planIds.length > 0 ? supabase.from("product_plans").select("id, name").in("id", planIds) : { data: [] },
        ]);
        const prodMap: Record<string, { name: string; image_url: string | null }> = {};
        const planMap: Record<string, string> = {};
        prodsRes.data?.forEach((p: any) => { prodMap[p.id] = { name: p.name, image_url: p.image_url }; });
        plansRes.data?.forEach((p: any) => { planMap[p.id] = p.name; });

        setRecentOrders((recentOrdersRes.data as any[]).map((t: any) => {
          const meta = t.metadata as any;
          const isLzt = meta?.type === "lzt-account";
          const prod = prodMap[t.product_id];
          return {
            ...t,
            product_name: isLzt ? (meta?.title || meta?.account_name || "Conta LZT") : (prod?.name || "Produto"),
            product_image: isLzt ? null : (prod?.image_url || null),
            plan_name: isLzt ? "Conta LZT" : (planMap[t.product_plan_id] || "Plano"),
            username: "...",
          };
        }));
      }

      if (recentPaymentsRes.data) {
        setRecentPayments(recentPaymentsRes.data as Payment[]);
      }

      setLoading(false);
    };

    fetchAll();
  }, [refreshKey]);

  useEffect(() => {
    if (usernameMap.size === 0) return;
    setRecentOrders(prev => prev.map(order => ({
      ...order,
      username: usernameMap.get(order.user_id) || "?",
    })));
  }, [usernameMap]);

  // Period-filtered metrics
  const filteredPayments = filterByPeriod(allPayments as any[], period);
  const filteredOrders = filterByPeriod(allOrders as any[], period, "created_at");
  const periodRevenue = filteredPayments.reduce((s: number, p: any) => s + Number(p.amount) / 100, 0);
  const periodOrderCount = filteredOrders.length;
  const periodPaidCount = filteredPayments.length;

  const revenueTotal = periodRevenue;
  const totalCosts = lztCost + robotCost + totalDiscounts;
  const netProfit = revenueTotal - totalCosts;
  const profitMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Visão Geral</h2>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-success/50 hover:text-success"
        >
          <RefreshCw className="h-3 w-3" /> Atualizar
        </button>
      </div>

      {/* Margin Alert — simplified, no editable threshold */}
      {profitMargin < 30 && revenueTotal > 0 && (
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
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hoje</span>
          </div>
          <p className="text-2xl font-bold text-success tracking-tight">R$ {todayRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{todayOrders} vendas</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-positive" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lucro</span>
          </div>
          <p className="text-2xl font-bold text-positive tracking-tight">R$ {fmt(netProfit)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Margem {profitMargin.toFixed(1)}%</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-4 w-4 text-info" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pedidos</span>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{totalOrders}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{totalPaidPayments} faturas pagas</p>
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
                    <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">{order.username !== "?" ? order.username : "..."}</span>
                    <span className="text-muted-foreground/30 text-[10px]">•</span>
                    <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(order.created_at)}
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusColors[order.status] || "bg-muted/50 text-muted-foreground border-border"}`}>
                  {statusLabels[order.status] || order.status_label}
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
          </div>
          <div className="divide-y divide-border">
            {recentPayments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</p>
            ) : recentPayments.map((p) => {
              const cartItems = Array.isArray(p.cart_snapshot) ? p.cart_snapshot : [];
              const productName = cartItems[0]?.productName || "—";

              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-positive/10 shrink-0">
                    <DollarSign className="h-3.5 w-3.5 text-positive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{productName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 inline opacity-50" />
                      {p.paid_at ? timeAgo(p.paid_at) : timeAgo(p.created_at)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">R$ {(Number(p.amount) / 100).toFixed(2)}</span>
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
