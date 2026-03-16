import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { Loader2, RefreshCw, Wifi, WifiOff, Gamepad2, AlertTriangle, CheckCircle, Package, DollarSign, Clock, Zap, Gift, TrendingUp, BarChart3, RotateCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RobotGame {
  id: number;
  name: string;
  version: string;
  status: string;
  icon: string;
  is_free: boolean;
  prices: Record<string, number>;
  maxKeys: number | null;
  soldKeys: number;
}

interface ProductWithRobot {
  id: string;
  name: string;
  image_url: string | null;
  robot_game_id: number | null;
  robot_markup_percent: number | null;
  hasStock: boolean;
  stockCount: number;
}

interface RobotSale {
  id: string;
  created_at: string;
  product_name: string;
  plan_name: string;
  revenue: number; // what customer paid (BRL)
  cost: number; // estimated cost (BRL)
  profit: number;
  status: string;
  duration: number | null;
}

interface PendingRobotTicket {
  id: string;
  created_at: string;
  status: string;
  status_label: string;
  error: string;
  product_name: string;
  plan_name: string;
  user_label: string;
}

const RobotProjectTab = () => {
  const [loading, setLoading] = useState(true);
  const [pingStatus, setPingStatus] = useState<"online" | "offline" | "loading">("loading");
  const [robotGames, setRobotGames] = useState<RobotGame[]>([]);
  const [productsWithRobot, setProductsWithRobot] = useState<ProductWithRobot[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  const [freeGamesCount, setFreeGamesCount] = useState(0);
  const [usdToBrl, setUsdToBrl] = useState(5.25);
  const [robotSales, setRobotSales] = useState<RobotSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [pendingRobotTickets, setPendingRobotTickets] = useState<PendingRobotTicket[]>([]);
  const [retryingTicketId, setRetryingTicketId] = useState<string | null>(null);

  const checkPing = async () => {
    setPingStatus("loading");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/robot-project?action=ping`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      setPingStatus(response.ok ? "online" : "offline");
    } catch {
      setPingStatus("offline");
    }
  };

  const fetchRobotGames = async () => {
    setLoadingGames(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/robot-project?action=list-games`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const games = Array.isArray(data) ? data : data.games || [];
        setRobotGames(games);
        setFreeGamesCount(games.filter((g: RobotGame) => g.is_free).length);
      } else {
        toast({ title: "Erro ao carregar jogos Robot", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão com Robot Project", variant: "destructive" });
    }
    setLoadingGames(false);
  };

  const fetchProductsWithRobot = async () => {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, image_url, robot_game_id, robot_markup_percent")
      .not("robot_game_id", "is", null)
      .eq("active", true);

    if (!products || products.length === 0) {
      setProductsWithRobot([]);
      return;
    }

    const productIds = products.map(p => p.id);
    const { data: plans } = await supabase
      .from("product_plans")
      .select("id, product_id")
      .in("product_id", productIds)
      .eq("active", true);

    const planIds = (plans || []).map(p => p.id);
    const planToProduct: Record<string, string> = {};
    (plans || []).forEach(p => { planToProduct[p.id] = p.product_id; });

    let stockCounts: Record<string, number> = {};
    if (planIds.length > 0) {
      const stockPromises = planIds.map(async (planId: string) => {
        const { count } = await supabase
          .from("stock_items")
          .select("id", { count: "exact", head: true })
          .eq("product_plan_id", planId)
          .eq("used", false);
        const productId = planToProduct[planId];
        if (productId) stockCounts[productId] = (stockCounts[productId] || 0) + (count || 0);
      });
      await Promise.all(stockPromises);
    }

    setProductsWithRobot(products.map(p => ({
      ...p,
      hasStock: (stockCounts[p.id] || 0) > 0,
      stockCount: stockCounts[p.id] || 0,
    })));
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      if (res.ok) {
        const data = await res.json();
        const bid = Number(data?.USDBRL?.bid);
        if (bid > 0) setUsdToBrl(bid);
      }
    } catch (_) { /* use fallback */ }
  };

  const fetchRobotSales = async (period: "7d" | "30d" | "all" = salesPeriod) => {
    setSalesLoading(true);
    try {
      // Get all products with robot_game_id
      const { data: robotProducts } = await supabase
        .from("products")
        .select("id, name, robot_game_id, robot_markup_percent")
        .not("robot_game_id", "is", null);

      if (!robotProducts || robotProducts.length === 0) {
        setRobotSales([]);
        setSalesLoading(false);
        return;
      }

      const productIds = robotProducts.map(p => p.id);
      const productMap = Object.fromEntries(robotProducts.map(p => [p.id, p]));

      // Build date filter
      let dateFilter: string | null = null;
      if (period === "7d") {
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (period === "30d") {
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      // Get tickets for robot products (paginated, no 1000-row limit)
      let allTickets: any[];
      if (dateFilter) {
        allTickets = await fetchAllRows("order_tickets", {
          select: "id, created_at, product_id, product_plan_id, status, metadata, user_id",
          filters: [
            { column: "status", op: "eq", value: "delivered" },
            { column: "created_at", op: "gte", value: dateFilter },
          ],
          order: { column: "created_at", ascending: false },
        });
      } else {
        allTickets = await fetchAllRows("order_tickets", {
          select: "id, created_at, product_id, product_plan_id, status, metadata, user_id",
          filters: [{ column: "status", op: "eq", value: "delivered" }],
          order: { column: "created_at", ascending: false },
        });
      }

      const tickets = allTickets.filter((t: any) => productIds.includes(t.product_id));
      if (tickets.length === 0) {
        setRobotSales([]);
        setSalesLoading(false);
        return;
      }

      // Get plan names & prices
      const planIds = [...new Set(tickets.map((t: any) => t.product_plan_id))];
      const ticketUserIds = [...new Set(tickets.map((t: any) => t.user_id))];
      
      const [plansRes, robotPayments] = await Promise.all([
        supabase.from("product_plans").select("id, name, price, robot_duration_days").in("id", planIds),
        fetchAllRows("payments", {
          select: "user_id, amount, cart_snapshot, status",
          filters: [{ column: "status", op: "eq", value: "COMPLETED" }],
          order: { column: "created_at", ascending: false },
        }),
      ]);
      
      const planMap = Object.fromEntries((plansRes.data || []).map(p => [p.id, p]));
      
      // Build paid price map from cart_snapshot (historical prices)
      const paidPriceMap = new Map<string, number>();
      for (const pay of (robotPayments || [])) {
        const snapshot = pay.cart_snapshot as any[];
        if (!Array.isArray(snapshot)) continue;
        for (const item of snapshot) {
          const key = `${pay.user_id}|${item.productId}|${item.planId}`;
          if (!paidPriceMap.has(key) && item.price != null) {
            paidPriceMap.set(key, Number(item.price));
          }
        }
      }
      
      const sales: RobotSale[] = tickets.map(t => {
        const product = productMap[t.product_id];
        const plan = planMap[t.product_plan_id];
        const meta = (t.metadata || {}) as Record<string, any>;
        
        // Revenue = historical paid price from cart_snapshot, fallback to current plan price
        const revenue = paidPriceMap.get(`${t.user_id}|${t.product_id}|${t.product_plan_id}`) ?? plan?.price ?? 0;
        
        // Cost estimation: if metadata has amount_spent use it, otherwise estimate from markup
        let cost = 0;
        if (meta.amount_spent && Number(meta.amount_spent) > 0) {
          // amount_spent is in USD from Robot API
          cost = Number(meta.amount_spent) * usdToBrl;
        } else if (meta.is_free) {
          cost = 0;
        } else if (product?.robot_markup_percent) {
          // Estimate: revenue / (1 + markup/100) = base cost
          cost = revenue / (1 + (product.robot_markup_percent || 50) / 100);
        }

        return {
          id: t.id,
          created_at: t.created_at || "",
          product_name: product?.name || "Desconhecido",
          plan_name: plan?.name || "—",
          revenue,
          cost: Math.round(cost * 100) / 100,
          profit: Math.round((revenue - cost) * 100) / 100,
          status: t.status || "unknown",
          duration: plan?.robot_duration_days || meta.duration || null,
        };
      });

      setRobotSales(sales);
    } catch (err) {
      console.error("Error fetching robot sales:", err);
    }
    setSalesLoading(false);
  };

  const fetchPendingRobotTickets = async () => {
    const { data: tickets } = await supabase
      .from("order_tickets")
      .select("id, created_at, status, status_label, metadata, product_id, product_plan_id, user_id")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);

    const robotTickets = (tickets || []).filter((ticket: any) => ticket.metadata?.type === "robot-project");
    if (robotTickets.length === 0) {
      setPendingRobotTickets([]);
      return;
    }

    const productIds = [...new Set(robotTickets.map((ticket: any) => ticket.product_id))];
    const planIds = [...new Set(robotTickets.map((ticket: any) => ticket.product_plan_id))];
    const userIds = [...new Set(robotTickets.map((ticket: any) => ticket.user_id))];

    const [productsRes, plansRes, profilesRes] = await Promise.all([
      supabase.from("products").select("id, name").in("id", productIds),
      supabase.from("product_plans").select("id, name").in("id", planIds),
      supabase.from("profiles").select("user_id, username").in("user_id", userIds),
    ]);

    const productMap = Object.fromEntries((productsRes.data || []).map((item) => [item.id, item.name]));
    const planMap = Object.fromEntries((plansRes.data || []).map((item) => [item.id, item.name]));
    const profileMap = Object.fromEntries((profilesRes.data || []).map((item) => [item.user_id, item.username || item.user_id.slice(0, 8)]));

    setPendingRobotTickets(robotTickets.map((ticket: any) => ({
      id: ticket.id,
      created_at: ticket.created_at || "",
      status: ticket.status || "open",
      status_label: ticket.status_label || "Entrega Manual",
      error: String(ticket.metadata?.error || "Falha não informada"),
      product_name: productMap[ticket.product_id] || "Produto desconhecido",
      plan_name: planMap[ticket.product_plan_id] || "Plano desconhecido",
      user_label: profileMap[ticket.user_id] || ticket.user_id.slice(0, 8),
    })));
  };

  const retryRobotDelivery = async (ticketId: string) => {
    try {
      setRetryingTicketId(ticketId);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-payment?action=retry-robot`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ticket_id: ticketId }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Não foi possível reprocessar a entrega");
      }
      toast({ title: "Entrega Robot reprocessada", description: result.message || "Verifique o ticket do pedido." });
      await refreshAll();
    } catch (error: any) {
      toast({ title: "Falha ao reprocessar", description: error.message, variant: "destructive" });
    } finally {
      setRetryingTicketId(null);
    }
  };


  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([checkPing(), fetchRobotGames(), fetchProductsWithRobot(), fetchExchangeRate(), fetchPendingRobotTickets()]);
    await fetchRobotSales();
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { refreshAll(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Robot Project</h2>
        <button
          onClick={refreshAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:border-success hover:text-success disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {lastRefresh && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Última atualização: {lastRefresh.toLocaleTimeString("pt-BR")}
        </p>
      )}

      {/* Status Cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* API Status */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              pingStatus === "online" ? "bg-success/10" : pingStatus === "offline" ? "bg-destructive/10" : "bg-muted"
            }`}>
              {pingStatus === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : pingStatus === "online" ? (
                <Wifi className="h-5 w-5 text-success" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status da API</p>
              <p className={`text-sm font-bold ${
                pingStatus === "online" ? "text-success" : pingStatus === "offline" ? "text-destructive" : "text-muted-foreground"
              }`}>
                {pingStatus === "loading" ? "Verificando..." : pingStatus === "online" ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        </div>

        {/* Robot Balance */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Wallet className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo Robot</p>
              <p className="text-sm font-bold text-foreground">
                {robotBalance !== null ? `$${robotBalance.toFixed(2)} USD` : "—"}
              </p>
              {robotBalance !== null && (
                <p className="text-[10px] text-muted-foreground">≈ R${(robotBalance * usdToBrl).toFixed(2)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Games Available */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Gamepad2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jogos Disponíveis</p>
              <p className="text-sm font-bold text-foreground">
                {loadingGames ? "..." : robotGames.length}
              </p>
            </div>
          </div>
        </div>

        {/* Free Games */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Gift className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jogos Grátis</p>
              <p className="text-sm font-bold text-foreground">
                {loadingGames ? "..." : freeGamesCount}
              </p>
            </div>
          </div>
        </div>

        {/* Products Linked */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Package className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Produtos Vinculados</p>
              <p className="text-sm font-bold text-foreground">{productsWithRobot.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Robot Profit Tracker */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            Lucro Robot Project
          </h3>
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {(["7d", "30d", "all"] as const).map(p => (
              <button
                key={p}
                onClick={() => { setSalesPeriod(p); fetchRobotSales(p); }}
                className={`rounded-md px-3 py-1 text-[11px] font-medium ${
                  salesPeriod === p ? "bg-success text-success-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
              </button>
            ))}
          </div>
        </div>

        {salesLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-success" />
          </div>
        ) : (
          <>
            {/* Profit summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Vendas</p>
                <p className="text-lg font-bold text-foreground">{robotSales.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Receita</p>
                <p className="text-lg font-bold text-success">
                  R$ {robotSales.reduce((sum, s) => sum + s.revenue, 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Custo Estimado</p>
                <p className="text-lg font-bold text-destructive">
                  R$ {robotSales.reduce((sum, s) => sum + s.cost, 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-success mb-1">Lucro Estimado</p>
                <p className="text-lg font-bold text-success">
                  R$ {robotSales.reduce((sum, s) => sum + s.profit, 0).toFixed(2)}
                </p>
                {robotSales.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Margem: {(
                      (robotSales.reduce((sum, s) => sum + s.profit, 0) /
                        Math.max(1, robotSales.reduce((sum, s) => sum + s.revenue, 0))) *
                      100
                    ).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>

            {pendingRobotTickets.length > 0 && (
              <div className="mb-6 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <h4 className="text-sm font-semibold text-foreground">Entregas Robot pendentes</h4>
                </div>
                <div className="space-y-2">
                  {pendingRobotTickets.map((ticket) => (
                    <div key={ticket.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{ticket.product_name} • {ticket.plan_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.user_label} • {new Date(ticket.created_at).toLocaleString("pt-BR")}
                        </p>
                        <p className="text-xs text-warning mt-1">{ticket.error}</p>
                      </div>
                      <button
                        onClick={() => retryRobotDelivery(ticket.id)}
                        disabled={retryingTicketId === ticket.id}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {retryingTicketId === ticket.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                        Reprocessar entrega
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sales table */}
            {robotSales.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma venda Robot neste período
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Data</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Produto</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Plano</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Receita</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Custo Est.</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Lucro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {robotSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-secondary/20">
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-foreground">{sale.product_name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {sale.plan_name}
                            {sale.duration && <span className="text-[10px] ml-1">({sale.duration}d)</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-success">
                            R$ {sale.revenue.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-destructive">
                            R$ {sale.cost.toFixed(2)}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono font-bold ${sale.profit >= 0 ? "text-success" : "text-destructive"}`}>
                            R$ {sale.profit.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-secondary/20">
                        <td colSpan={3} className="px-4 py-2.5 font-bold text-foreground">Total</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-success">
                          R$ {robotSales.reduce((s, sale) => s + sale.revenue, 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-destructive">
                          R$ {robotSales.reduce((s, sale) => s + sale.cost, 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-success">
                          R$ {robotSales.reduce((s, sale) => s + sale.profit, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <p className="mt-2 text-[10px] text-muted-foreground">
              * Custo estimado via markup do produto. Vendas com cashback registrado usam o valor real.
            </p>
          </>
        )}
      </div>

      {/* Products with Robot - Stock Status */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Package className="h-4 w-4 text-success" />
          Produtos Robot Project — Status do Estoque
        </h3>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-success" />
          </div>
        ) : productsWithRobot.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum produto vinculado ao Robot Project.
            <br />
            <span className="text-xs">Vincule um produto em Produtos → Editar → Robot Game ID</span>
          </div>
        ) : (
          <div className="space-y-2">
            {productsWithRobot.map(product => {
              const linkedGame = robotGames.find(g => g.id === product.robot_game_id);
              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-4 rounded-lg border p-4 ${
                    product.hasStock
                      ? "border-border bg-card"
                      : "border-warning/30 bg-warning/5"
                  }`}
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary">
                      <Package className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{product.name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        Robot ID: <span className="font-mono text-foreground">{product.robot_game_id}</span>
                      </span>
                      {product.robot_markup_percent && (
                        <span className="text-[11px] text-muted-foreground">
                          Markup: <span className="font-mono text-foreground">{product.robot_markup_percent}%</span>
                        </span>
                      )}
                      {linkedGame && (
                        <span className={`text-[11px] ${linkedGame.status === "on" ? "text-success" : "text-destructive"}`}>
                          {linkedGame.status === "on" ? "● Online" : "● Offline"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {linkedGame ? (
                      linkedGame.status === "on" && (linkedGame.maxKeys === null || (linkedGame.maxKeys - linkedGame.soldKeys) > 0 || linkedGame.is_free) ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {linkedGame.is_free ? "Grátis" : linkedGame.maxKeys !== null ? `${linkedGame.maxKeys - linkedGame.soldKeys}/${linkedGame.maxKeys} slots` : "Disponível"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {linkedGame.status !== "on" ? "Offline" : "Sem slots"}
                        </span>
                      )
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                        ID não encontrado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Robot Games List */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-success" />
          Jogos Disponíveis na API
        </h3>

        {loadingGames ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-success" />
          </div>
        ) : robotGames.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum jogo retornado pela API.
            <br />
            <span className="text-xs">Verifique as credenciais em Credenciais → ROBOT_API_USERNAME / PASSWORD</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {robotGames.map(game => {
              const linkedProduct = productsWithRobot.find(p => p.robot_game_id === game.id);
              const priceEntries = game.prices ? Object.entries(game.prices) : [];
              const slotsAvailable = game.maxKeys ? game.maxKeys - game.soldKeys : null;

              return (
                <div
                  key={game.id}
                  className={`rounded-lg border p-4 ${
                    linkedProduct ? "border-success/30 bg-success/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{game.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground">ID: {game.id}</p>
                        <span className="text-[10px] text-muted-foreground">v{game.version}</span>
                        <span className={`text-[10px] font-bold ${game.status === "on" ? "text-success" : "text-destructive"}`}>
                          {game.status === "on" ? "● ON" : "● OFF"}
                        </span>
                        {game.is_free && (
                          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground">FREE</span>
                        )}
                      </div>
                    </div>
                    {linkedProduct ? (
                      <span className="rounded bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                        Vinculado
                      </span>
                    ) : (
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        Não vinculado
                      </span>
                    )}
                  </div>

                  {/* Prices by duration */}
                  {priceEntries.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Preços por duração <span className="text-[9px] font-normal">(USD→BRL: {usdToBrl.toFixed(2)})</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {priceEntries.map(([days, price]) => {
                          const usdPrice = Number(price);
                          const brlPrice = usdPrice * usdToBrl;
                          return (
                            <span key={days} className="inline-flex items-center gap-1 rounded-md bg-secondary/60 border border-border px-2 py-0.5 text-[11px]">
                              <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-muted-foreground">{days}d</span>
                              <span className="font-bold text-foreground">R${brlPrice.toFixed(2)}</span>
                              <span className="text-[9px] text-muted-foreground">(${usdPrice.toFixed(2)})</span>
                            </span>
                          );
                        })}
                      </div>
                      {linkedProduct?.robot_markup_percent && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {priceEntries.map(([days, price]) => {
                            const brlPrice = Number(price) * usdToBrl;
                            const withMarkup = brlPrice * (1 + (linkedProduct.robot_markup_percent || 0) / 100);
                            return (
                              <span key={`mk-${days}`} className="inline-flex items-center gap-1 rounded-md bg-accent/10 border border-accent/20 px-2 py-0.5 text-[11px]">
                                <Zap className="h-2.5 w-2.5 text-accent-foreground" />
                                <span className="text-muted-foreground">{days}d</span>
                                <span className="font-bold text-accent-foreground">R${withMarkup.toFixed(2)}</span>
                                <span className="text-[9px] text-muted-foreground">+{linkedProduct.robot_markup_percent}%</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Slots info */}
                  {game.maxKeys !== null && game.maxKeys > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            slotsAvailable !== null && slotsAvailable <= 5 ? "bg-warning" : "bg-success"
                          }`}
                          style={{ width: `${Math.min(100, ((game.soldKeys || 0) / game.maxKeys) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${
                        slotsAvailable !== null && slotsAvailable <= 5 ? "text-warning" : "text-muted-foreground"
                      }`}>
                        {game.soldKeys}/{game.maxKeys} slots
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RobotProjectTab;
