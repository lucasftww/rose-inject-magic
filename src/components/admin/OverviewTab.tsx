import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Loader2, DollarSign, ShoppingCart, Users, UserCheck,
  Package, Receipt, RefreshCw, ArrowUpRight
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
  open: "bg-success/15 text-success border-success/20",
  delivered: "bg-info/15 text-info border-info/20",
  waiting_staff: "bg-warning/15 text-warning border-warning/20",
  resolved: "bg-positive/15 text-positive border-positive/20",
  closed: "bg-muted/50 text-muted-foreground border-border",
  banned: "bg-destructive/15 text-destructive border-destructive/20",
  finished: "bg-muted/50 text-muted-foreground border-border",
};
const statusLabels: Record<string, string> = {
  open: "Aberto",
  delivered: "Entregue",
  waiting_staff: "Aguardando",
  resolved: "Resolvido",
  closed: "Encerrado",
  banned: "Banido",
  finished: "Finalizado",
};

const OverviewTab = ({ onGoToTicket }: { onGoToTicket?: (ticketId: string) => void }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPaidPayments, setTotalPaidPayments] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalResellers, setTotalResellers] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderTicket[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [
        ordersRes,
        paymentsRes,
        recentOrdersRes,
        recentPaymentsRes,
        resellersRes,
        productsRes,
      ] = await Promise.all([
        supabase.from("order_tickets").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("id, amount, status").eq("status", "COMPLETED"),
        supabase.from("order_tickets").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("payments").select("*").eq("status", "COMPLETED").order("paid_at", { ascending: false }).limit(5),
        supabase.from("resellers").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("products").select("id", { count: "exact", head: true }),
      ]);

      setTotalOrders(ordersRes.count || 0);

      if (paymentsRes.data) {
        const paidPayments = paymentsRes.data as any[];
        setTotalRevenue(paidPayments.reduce((s: number, p: any) => s + Number(p.amount), 0));
        setTotalPaidPayments(paidPayments.length);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await supabase.functions.invoke("admin-users", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setTotalUsers((res.data || []).length);

        const usersMap: Record<string, string> = {};
        (res.data || []).forEach((u: any) => { usersMap[u.id] = u.username || u.email?.split("@")[0] || "?"; });

        if (recentOrdersRes.data) {
          const productIds = [...new Set((recentOrdersRes.data as any[]).map((t: any) => t.product_id))];
          const planIds = [...new Set((recentOrdersRes.data as any[]).map((t: any) => t.product_plan_id))];
          const [prodsRes, plansRes] = await Promise.all([
            productIds.length > 0 ? supabase.from("products").select("id, name").in("id", productIds) : { data: [] },
            planIds.length > 0 ? supabase.from("product_plans").select("id, name").in("id", planIds) : { data: [] },
          ]);
          const prodMap: Record<string, string> = {};
          const planMap: Record<string, string> = {};
          prodsRes.data?.forEach((p: any) => { prodMap[p.id] = p.name; });
          plansRes.data?.forEach((p: any) => { planMap[p.id] = p.name; });

          setRecentOrders((recentOrdersRes.data as any[]).map((t: any) => {
            const meta = t.metadata as any;
            const isLzt = meta?.type === "lzt-account";
            return {
              ...t,
              product_name: isLzt ? (meta?.title || meta?.account_name || "Conta LZT") : (prodMap[t.product_id] || "Produto"),
              plan_name: isLzt ? "Conta LZT" : (planMap[t.product_plan_id] || "Plano"),
              username: usersMap[t.user_id] || "?",
            };
          }));
        }
      }

      setTotalResellers(resellersRes.count || 0);
      setTotalProducts(productsRes.count || 0);

      if (recentPaymentsRes.data) {
        setRecentPayments(recentPaymentsRes.data as Payment[]);
      }

      setLoading(false);
    };

    fetchAll();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-success" />
      </div>
    );
  }

  const stats = [
    { icon: DollarSign, label: "Receita Total", value: `R$ ${(totalRevenue / 100).toFixed(2)}`, accent: "text-positive" },
    { icon: ShoppingCart, label: "Total de Pedidos", value: String(totalOrders), accent: "text-success" },
    { icon: Receipt, label: "Faturas Pagas", value: String(totalPaidPayments), accent: "text-info" },
    { icon: Users, label: "Usuários", value: String(totalUsers), accent: "text-success" },
    { icon: UserCheck, label: "Revendedores", value: String(totalResellers), accent: "text-warning" },
    { icon: Package, label: "Produtos", value: String(totalProducts), accent: "text-info" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Visão Geral</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Resumo do seu negócio em tempo real</p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:border-success/50 hover:text-success transition-all duration-200"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="group rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-border/80 hover:shadow-lg hover:shadow-black/10">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-secondary ${stat.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>
              <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
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
                className="flex cursor-pointer items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/30"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary shrink-0">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{order.product_name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {order.username} · {new Date(order.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusColors[order.status] || "bg-muted/50 text-muted-foreground border-border"}`}>
                  {statusLabels[order.status] || order.status_label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
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
                <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-positive/10 shrink-0">
                    <DollarSign className="h-3.5 w-3.5 text-positive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{productName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                      }
                      {p.discount_amount > 0 && <span className="ml-1 text-success">(-R$ {Number(p.discount_amount).toFixed(2)})</span>}
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
