import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, DollarSign, ShoppingCart, Users, UserCheck,
  Package, Receipt, TrendingUp, RefreshCw
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
  open: "bg-success/20 text-success",
  delivered: "bg-info/20 text-info",
  resolved: "bg-positive/20 text-positive",
  closed: "bg-muted text-muted-foreground",
  banned: "bg-destructive/20 text-destructive",
  finished: "bg-muted text-muted-foreground",
};
const statusLabels: Record<string, string> = {
  open: "Aberto",
  delivered: "Entregue",
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

      // Total orders
      setTotalOrders(ordersRes.count || 0);

      // Revenue & paid count — only COMPLETED payments
      if (paymentsRes.data) {
        const paidPayments = paymentsRes.data as any[];
        setTotalRevenue(paidPayments.reduce((s: number, p: any) => s + Number(p.amount), 0));
        setTotalPaidPayments(paidPayments.length);
      }

      // Users count via edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await supabase.functions.invoke("admin-users", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setTotalUsers((res.data || []).length);

        // Enrich recent orders with usernames
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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-success" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={<DollarSign className="h-5 w-5 text-success" />} label="Receita Total" value={`R$ ${(totalRevenue / 100).toFixed(2)}`} />
        <StatCard icon={<ShoppingCart className="h-5 w-5 text-success" />} label="Total de Pedidos" value={String(totalOrders)} />
        <StatCard icon={<Receipt className="h-5 w-5 text-success" />} label="Faturas Pagas" value={String(totalPaidPayments)} />
        <StatCard icon={<Users className="h-5 w-5 text-success" />} label="Usuários" value={String(totalUsers)} />
        <StatCard icon={<UserCheck className="h-5 w-5 text-success" />} label="Revendedores Ativos" value={String(totalResellers)} />
        <StatCard icon={<Package className="h-5 w-5 text-success" />} label="Produtos" value={String(totalProducts)} />
      </div>

      {/* Recent sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-success" />
            Últimos 5 Pedidos
          </h3>
          <div className="mt-4 space-y-2">
            {recentOrders.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum pedido.</p>
            ) : recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => onGoToTicket?.(order.id)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 transition-colors hover:border-success/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{order.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.plan_name} · {order.username} · {new Date(order.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                  {statusLabels[order.status] || order.status_label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-4 w-4 text-success" />
            Últimas 5 Vendas
          </h3>
          <div className="mt-4 space-y-2">
            {recentPayments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma venda paga.</p>
            ) : recentPayments.map((p) => {
              const cartItems = Array.isArray(p.cart_snapshot) ? p.cart_snapshot : [];
              const productName = cartItems[0]?.productName || "—";

              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      {p.discount_amount > 0 && <span className="ml-1 text-success">(-R$ {Number(p.discount_amount).toFixed(2)})</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-bold text-foreground">R$ {(Number(p.amount) / 100).toFixed(2)}</span>
                    <span className="text-[10px] font-bold text-success">Pago</span>
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

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-card p-5">
    <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-muted-foreground">{label}</span></div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
  </div>
);

export default OverviewTab;
