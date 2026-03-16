import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Loader2, DollarSign, ShoppingCart, Users, UserCheck,
  Package, Receipt, RefreshCw, TrendingUp, Clock, Activity,
  Zap, BarChart3, ArrowDown
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

const OverviewTab = ({ onGoToTicket }: { onGoToTicket?: (ticketId: string) => void }) => {
  const { users: adminUsers, usernameMap } = useAdminUsers();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPaidPayments, setTotalPaidPayments] = useState(0);
  const [totalResellers, setTotalResellers] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderTicket[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);

  // Profit data
  const [lztProfit, setLztProfit] = useState(0);
  const [lztCost, setLztCost] = useState(0);
  const [robotProfit, setRobotProfit] = useState(0);
  const [robotCost, setRobotCost] = useState(0);
  const [totalDiscounts, setTotalDiscounts] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      // Fetch USD rate
      let usdToBrl = 5.5;
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const json = await res.json();
        if (json?.rates?.BRL) usdToBrl = json.rates.BRL;
      } catch { /* fallback */ }

      const [statsRes, recentOrdersRes, recentPaymentsRes, todayPayRes, lztRes, allPaymentsRes, robotProductsRes] = await Promise.all([
        supabase.rpc("admin_overview_stats"),
        supabase.from("order_tickets").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("payments").select("*").eq("status", "COMPLETED").order("paid_at", { ascending: false }).limit(8),
        fetchAllRows("payments", { select: "amount", filters: [{ column: "status", op: "eq", value: "COMPLETED" }, { column: "paid_at", op: "gte", value: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() }] }),
        supabase.rpc("admin_lzt_stats"),
        fetchAllRows("payments", {
          select: "amount, discount_amount, user_id, cart_snapshot, status",
          filters: [{ column: "status", op: "eq", value: "COMPLETED" }],
        }),
        supabase.from("products").select("id, name, robot_game_id, robot_markup_percent").not("robot_game_id", "is", null),
      ]);

      if (statsRes.data) {
        const s = statsRes.data as any;
        if (!s.error) {
          setTotalOrders(Number(s.total_orders));
          setTotalRevenue(Number(s.total_revenue));
          setTotalPaidPayments(Number(s.total_paid_payments));
          setTotalResellers(Number(s.total_resellers));
          setTotalProducts(Number(s.total_products));
        }
      }

      // Discounts
      const discTotal = (allPaymentsRes || []).reduce((s: number, p: any) => s + (Number(p.discount_amount) || 0), 0);
      setTotalDiscounts(discTotal);

      // LZT profit
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

        // Build paid price map
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

      if (todayPayRes && todayPayRes.length > 0) {
        const todayTotal = todayPayRes.reduce((s: number, p: any) => s + Number(p.amount), 0);
        setTodayRevenue(todayTotal / 100);
        setTodayOrders(todayPayRes.length);
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

  const openTickets = useMemo(() =>
    recentOrders.filter(o => o.status === "open" || o.status === "waiting" || o.status === "waiting_staff").length
  , [recentOrders]);

  // Computed profits
  const revenueTotal = totalRevenue / 100;
  const totalCosts = lztCost + robotCost + totalDiscounts;
  const netProfit = revenueTotal - totalCosts;
  const profitMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-success" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Visão Geral</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Resumo do seu negócio em tempo real</p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-success/50 hover:text-success transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Atualizar
        </button>
      </div>

      {/* Today Highlight */}
      <div className="rounded-xl border border-success/20 bg-success/[0.03] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-success" />
          <span className="text-xs font-bold text-success uppercase tracking-wider">Hoje</span>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <p className="text-2xl font-bold text-success tracking-tight">R$ {todayRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Faturado Hoje</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{todayOrders}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Vendas Hoje</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{adminUsers.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Usuários Totais</p>
          </div>
          <div>
            <p className={`text-2xl font-bold tracking-tight ${openTickets > 0 ? "text-warning" : "text-foreground"}`}>{openTickets}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tickets Abertos</p>
          </div>
        </div>
      </div>

      {/* Profit Summary */}
      <div className="rounded-xl border border-positive/20 bg-positive/[0.03] p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-positive" />
          <span className="text-xs font-bold text-positive uppercase tracking-wider">Lucro Total</span>
          <span className="text-[10px] text-muted-foreground ml-auto">Margem: {profitMargin.toFixed(1)}%</span>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div>
            <p className="text-2xl font-bold text-positive tracking-tight">R$ {fmt(netProfit)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lucro Líquido</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground tracking-tight">R$ {fmt(revenueTotal)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Receita Bruta</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground tracking-tight flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-success" />
              R$ {fmt(lztProfit)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lucro LZT</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground tracking-tight flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-warning" />
              R$ {fmt(robotProfit)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lucro Robot</p>
          </div>
          <div>
            <p className="text-lg font-bold text-destructive tracking-tight flex items-center gap-1.5">
              <ArrowDown className="h-3.5 w-3.5" />
              R$ {fmt(totalCosts)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Custos Totais</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { icon: DollarSign, label: "Receita Total", value: `R$ ${fmt(revenueTotal)}`, accent: "text-positive", bg: "bg-positive/10" },
          { icon: ShoppingCart, label: "Total de Pedidos", value: String(totalOrders), accent: "text-success", bg: "bg-success/10" },
          { icon: Receipt, label: "Faturas Pagas", value: String(totalPaidPayments), accent: "text-info", bg: "bg-info/10" },
          { icon: Users, label: "Usuários", value: String(adminUsers.length), accent: "text-success", bg: "bg-success/10" },
          { icon: UserCheck, label: "Revendedores", value: String(totalResellers), accent: "text-warning", bg: "bg-warning/10" },
          { icon: Package, label: "Produtos", value: String(totalProducts), accent: "text-info", bg: "bg-info/10" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="group rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg} ${stat.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
              </div>
              <p className="text-xl font-bold text-foreground tracking-tight">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Sections */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-success" />
              Últimos Pedidos
            </h3>
            <span className="text-[10px] font-medium text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{recentOrders.length}</span>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
            ) : recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => onGoToTicket?.(order.id)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors group"
              >
                <div className="relative shrink-0">
                  {order.product_image ? (
                    <img
                      src={order.product_image}
                      alt={order.product_name}
                      className="h-10 w-10 rounded-lg object-cover border border-border group-hover:border-success/30 transition-colors"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border group-hover:border-success/30 transition-colors">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                    order.status === "delivered" ? "bg-success" :
                    order.status === "open" || order.status === "waiting" || order.status === "waiting_staff" ? "bg-warning" :
                    "bg-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate group-hover:text-success transition-colors">{order.product_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">{order.username !== "?" ? order.username : "..."}</span>
                    <span className="text-muted-foreground/30 text-[10px]">•</span>
                    <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(order.created_at)}
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-wide ${statusColors[order.status] || "bg-muted/50 text-muted-foreground border-border"}`}>
                  {statusLabels[order.status] || order.status_label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-positive" />
              Últimas Vendas
            </h3>
            <span className="text-[10px] font-medium text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{recentPayments.length}</span>
          </div>
          <div className="divide-y divide-border">
            {recentPayments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</p>
            ) : recentPayments.map((p) => {
              const cartItems = Array.isArray(p.cart_snapshot) ? p.cart_snapshot : [];
              const productName = cartItems[0]?.productName || "—";

              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-positive/10 shrink-0">
                    <DollarSign className="h-3.5 w-3.5 text-positive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{productName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 inline opacity-50" />
                      <span>
                        {p.paid_at
                          ? timeAgo(p.paid_at) + " · " + new Date(p.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                          : new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                        }
                      </span>
                      {p.discount_amount > 0 && <span className="text-success">(-R$ {Number(p.discount_amount).toFixed(2)})</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-sm font-bold text-foreground">R$ {(Number(p.amount) / 100).toFixed(2)}</span>
                    <span className="text-[10px] font-semibold text-positive">Pago ✓</span>
                  </div>
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
