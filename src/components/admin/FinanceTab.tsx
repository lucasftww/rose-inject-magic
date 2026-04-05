import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { getCached, setCache, getUsdToBrl, invalidateAdminCache } from "@/lib/adminCache";
import { paymentCartSnapshot, type PaymentCartLine } from "@/types/paymentCart";
import { asOrderTicketMetadata, type OrderTicketMetadata } from "@/types/orderTicketMetadata";
import {
  Loader2, DollarSign, TrendingUp, TrendingDown,
  Download, Wallet, Users, ArrowUp, ArrowDown, Minus, Gamepad2,
  Receipt, BarChart3, CalendarDays, Package, Zap, RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Legend
} from "recharts";

interface PaymentRow {
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  cart_snapshot: Json | null;
  payment_method: string | null;
  discount_amount: number;
  user_id: string;
}

interface LztSale {
  buy_price: number;
  sell_price: number;
  profit: number;
  created_at: string;
  game: string | null;
}

interface ResellerPurchase {
  original_price: number;
  paid_price: number;
  created_at: string;
}

interface RobotTicket {
  id: string;
  created_at: string;
  product_id: string;
  product_plan_id: string;
  user_id: string;
  metadata: OrderTicketMetadata;
  product_name: string;
  plan_name: string;
  revenue: number;
  cost: number;
  profit: number;
}

type Period = "24h" | "7d" | "30d" | "all";

const PERIOD_OPTIONS = [
  ["24h", "24h"],
  ["7d", "7d"],
  ["30d", "30d"],
  ["all", "Tudo"],
] as const satisfies ReadonlyArray<readonly [Period, string]>;

const COLORS = [
  "hsl(197,100%,50%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)",
  "hsl(0,62%,50%)", "hsl(220,80%,55%)", "hsl(280,70%,55%)"
];

const CHART_TOOLTIP = {
  contentStyle: {
    background: "hsl(0,0%,10%)",
    border: "1px solid hsl(0,0%,18%)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "hsl(0,0%,95%)",
    boxShadow: "0 8px 32px hsla(0,0%,0%,0.5)",
  },
  labelStyle: { color: "hsl(0,0%,70%)" },
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCompact = (v: number) => {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  return fmt(v);
};
const pctChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const filterByPeriod = <T extends { created_at: string; paid_at?: string | null }>(
  items: T[], period: Period, dateField: "created_at" | "paid_at" = "paid_at"
): T[] => {
  if (period === "all") return items;
  const ms = period === "24h" ? 86400000 : period === "7d" ? 7 * 86400000 : 30 * 86400000;
  const cutoff = Date.now() - ms;
  return items.filter(i => {
    const d = dateField === "paid_at" ? (i.paid_at || i.created_at) : i.created_at;
    const t = new Date(d).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
};

const getPreviousPeriodItems = <T extends { created_at: string; paid_at?: string | null }>(
  items: T[], period: Period, dateField: "created_at" | "paid_at" = "paid_at"
): T[] => {
  if (period === "all") return [];
  const ms = period === "24h" ? 86400000 : period === "7d" ? 7 * 86400000 : 30 * 86400000;
  const start = Date.now() - ms * 2;
  const end = Date.now() - ms;
  return items.filter(i => {
    const d = dateField === "paid_at" ? (i.paid_at || i.created_at) : i.created_at;
    const t = new Date(d).getTime();
    return Number.isFinite(t) && t >= start && t < end;
  });
};

// ─── Stat Card ───
const StatCard = ({
  icon, label, value, prefix = "", suffix = "", change, highlight, className = ""
}: {
  icon: React.ReactNode; label: string; value: string;
  prefix?: string; suffix?: string;
  change?: number; highlight?: boolean; className?: string;
}) => (
  <div className={`rounded-xl border bg-card p-4 ${highlight ? "border-success/30 bg-success/[0.03]" : "border-border"} ${className}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">{icon}</div>
      {change !== undefined && change !== 0 && (
        <span className={`flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
          change > 0 ? "bg-positive/15 text-positive" : "bg-destructive/15 text-destructive"
        }`}>
          {change > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
          {Math.abs(change).toFixed(0)}%
        </span>
      )}
      {change === 0 && (
        <span className="flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-secondary text-muted-foreground">
          <Minus className="h-2.5 w-2.5" /> 0%
        </span>
      )}
    </div>
    <p className={`text-xl font-bold tracking-tight ${highlight ? "text-success" : "text-foreground"}`}>
      {prefix}{value}{suffix}
    </p>
    <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
  </div>
);

// ─── Main Component ───
const FinanceTab = () => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [lztSales, setLztSales] = useState<LztSale[]>([]);
  const [resellerPurchases, setResellerPurchases] = useState<ResellerPurchase[]>([]);
  const [robotTickets, setRobotTickets] = useState<RobotTicket[]>([]);
  const [period, setPeriod] = useState<Period>("24h");
  const [usdToBrl, setUsdToBrl] = useState(6.10);

  const fetchData = async () => {
    setLoading(true);
    try {

    let currentRate = usdToBrl;
    try {
      currentRate = await getUsdToBrl();
      setUsdToBrl(currentRate);
    } catch { /* fallback */ }

    // Use shared cache for heavy queries
    const CACHE_KEY_PAYMENTS = "admin_payments_completed";
    const CACHE_KEY_LZT = "admin_lzt_sales_full";
    const CACHE_KEY_RESELLER = "admin_reseller_purchases";

    const cachedPayments = getCached<PaymentRow[]>(CACHE_KEY_PAYMENTS);
    const cachedLzt = getCached<LztSale[]>(CACHE_KEY_LZT);
    const cachedReseller = getCached<ResellerPurchase[]>(CACHE_KEY_RESELLER);

    const [paymentsData, lztData, resellerData, robotProductsRes] = await Promise.all([
      cachedPayments
        ? Promise.resolve(cachedPayments)
        : fetchAllRows<PaymentRow>("payments", {
            select: "amount, status, created_at, paid_at, cart_snapshot, payment_method, discount_amount, user_id",
            filters: [{ column: "status", op: "eq", value: "COMPLETED" }],
            order: { column: "paid_at", ascending: false },
          }),
      cachedLzt
        ? Promise.resolve(cachedLzt)
        : fetchAllRows<LztSale>("lzt_sales", {
            select: "buy_price, sell_price, profit, created_at, game",
            order: { column: "created_at", ascending: false },
          }),
      cachedReseller
        ? Promise.resolve(cachedReseller)
        : fetchAllRows<ResellerPurchase>("reseller_purchases", {
            select: "original_price, paid_price, created_at",
            order: { column: "created_at", ascending: false },
          }),
      supabase.from("products").select("id, name, robot_game_id, robot_markup_percent").not("robot_game_id", "is", null),
    ]);

    // Persist to shared cache
    if (!cachedPayments) setCache(CACHE_KEY_PAYMENTS, paymentsData);
    if (!cachedLzt) setCache(CACHE_KEY_LZT, lztData);
    if (!cachedReseller) setCache(CACHE_KEY_RESELLER, resellerData);

    setPayments(paymentsData);
    setLztSales(lztData);
    setResellerPurchases(resellerData);

    if (robotProductsRes.error) {
      console.warn("FinanceTab: produtos Robot", robotProductsRes.error.message);
      toast({
        title: "Métricas Robot incompletas",
        description: robotProductsRes.error.message,
        variant: "destructive",
      });
    }

    const robotProducts = robotProductsRes.data || [];
    if (robotProducts.length > 0) {
      const productIds = robotProducts.map(p => p.id);
      const productMap = Object.fromEntries(robotProducts.map(p => [p.id, p]));

      type DelivTicketRow = Pick<
        Database["public"]["Tables"]["order_tickets"]["Row"],
        "id" | "created_at" | "product_id" | "product_plan_id" | "user_id" | "metadata" | "status"
      >;

      const [ticketsRes, plansRes] = await Promise.all([
        fetchAllRows<DelivTicketRow>("order_tickets", {
          select: "id, created_at, product_id, product_plan_id, user_id, metadata, status",
          filters: [{ column: "status", op: "eq", value: "delivered" }],
          order: { column: "created_at", ascending: false },
        }),
        supabase.from("product_plans").select("id, name, price, robot_duration_days").in("product_id", productIds),
      ]);

      const robotTicketsRaw = ticketsRes.filter(
        (t) => productIds.includes(t.product_id) && asOrderTicketMetadata(t.metadata).type !== "lzt-account",
      );
      const planMap = Object.fromEntries((plansRes.data || []).map((p) => [p.id, p]));

      const paidPriceMap = new Map<string, number[]>();
      for (const pay of paymentsData) {
        const snapshot = paymentCartSnapshot(pay.cart_snapshot);
        if (snapshot.length === 0) continue;

        const cartTotal = snapshot.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        const actualPaid = pay.amount / 100;

        for (const item of snapshot) {
          const key = `${pay.user_id}|${item.productId}|${item.planId}`;
          if (item.price != null) {
            const proportion = cartTotal > 0 ? (Number(item.price) / cartTotal) : 0;
            const arr = paidPriceMap.get(key) || [];
            arr.push(actualPaid * proportion);
            paidPriceMap.set(key, arr);
          }
        }
      }

      const enriched: RobotTicket[] = robotTicketsRaw.map((t) => {
        const product = productMap[t.product_id];
        const plan = planMap[t.product_plan_id];
        const meta = asOrderTicketMetadata(t.metadata);
        
        const key = `${t.user_id}|${t.product_id}|${t.product_plan_id}`;
        const revenues = paidPriceMap.get(key);
        const revenue = revenues?.shift() ?? 0;
        let cost = 0;
        if (meta.amount_spent && Number(meta.amount_spent) > 0) {
          // Real cost = 60% of amount_spent (40% cashback from Robot Project)
          cost = Number(meta.amount_spent) * 0.6 * currentRate;
        } else if (meta.is_free) {
          cost = 0;
        } else if (product?.robot_markup_percent) {
          cost = revenue / (1 + (product.robot_markup_percent || 50) / 100);
        }
        return {
          id: t.id, created_at: t.created_at || "", product_id: t.product_id,
          product_plan_id: t.product_plan_id, user_id: t.user_id, metadata: meta,
          product_name: product?.name || "Produto Robot", plan_name: plan?.name || "—",
          revenue, cost: Math.round(cost * 100) / 100, profit: Math.round((revenue - cost) * 100) / 100,
        };
      });
      setRobotTickets(enriched);
    }

    } catch (err) {
      console.error("FinanceTab fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // Intentional: single load on mount; fetchData is stable for dashboard totals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Filtered data ───
  const fp = useMemo(() => filterByPeriod(payments, period), [payments, period]);
  const pp = useMemo(() => getPreviousPeriodItems(payments, period), [payments, period]);
  const fLzt = useMemo(() => filterByPeriod(lztSales, period, "created_at"), [lztSales, period]);
  const fReseller = useMemo(() => filterByPeriod(resellerPurchases, period, "created_at"), [resellerPurchases, period]);
  const fRobot = useMemo(() => filterByPeriod(robotTickets, period, "created_at"), [robotTickets, period]);

  // ─── Revenue metrics ───
  const totalRevenue = useMemo(() => fp.reduce((s, p) => s + p.amount / 100, 0), [fp]);
  const prevRevenue = useMemo(() => pp.reduce((s, p) => s + p.amount / 100, 0), [pp]);
  const revenueChange = pctChange(totalRevenue, prevRevenue);

  const revenueBreakdown = useMemo(() => {
    let lzt = 0, stock = 0, robot = 0;
    const robotProductIds = new Set(robotTickets.map(r => r.product_id));
    fp.forEach(p => {
      const cart: PaymentCartLine[] = paymentCartSnapshot(p.cart_snapshot);
      if (cart.length === 0) { stock += p.amount / 100; return; }
      // Distribute revenue proportionally per cart item
      const cartTotal = cart.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
      const actualPaid = p.amount / 100;
      for (const item of cart) {
        const proportion = cartTotal > 0 ? (Number(item.price) || 0) / cartTotal : 1 / cart.length;
        const itemRevenue = actualPaid * proportion;
        if (item.type === "lzt-account") lzt += itemRevenue;
        else if (item.productId != null && robotProductIds.has(item.productId)) robot += itemRevenue;
        else stock += itemRevenue;
      }
    });
    return { lzt, robot, stock };
  }, [fp, robotTickets]);

  const lztTotalBought = useMemo(() => fLzt.reduce((s, l) => s + Number(l.buy_price), 0), [fLzt]);
  const lztTotalProfit = useMemo(() => fLzt.reduce((s, l) => s + Number(l.profit), 0), [fLzt]);

  const robotTotalCost = useMemo(() => fRobot.reduce((s, r) => s + r.cost, 0), [fRobot]);
  const robotTotalProfit = useMemo(() => fRobot.reduce((s, r) => s + r.profit, 0), [fRobot]);
  const uniqueBuyers = useMemo(() => new Set(fp.map(p => p.user_id)).size, [fp]);
  const prevBuyers = useMemo(() => new Set(pp.map(p => p.user_id)).size, [pp]);
  const buyersChange = pctChange(uniqueBuyers, prevBuyers);

  const avgTicket = fp.length > 0 ? totalRevenue / fp.length : 0;
  const prevAvgTicket = pp.length > 0 ? prevRevenue / pp.length : 0;
  const avgTicketChange = pctChange(avgTicket, prevAvgTicket);

  // Note: discount_amount is NOT included in costs because payments.amount
  // already stores the post-discount value (the actual money received).
  // Including it would double-count discounts and artificially lower margins.
  const totalCosts = lztTotalBought + robotTotalCost;
  const netProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const robotByProduct = useMemo(() => {
    const prods: Record<string, { count: number; revenue: number; cost: number; profit: number }> = {};
    fRobot.forEach(r => {
      if (!prods[r.product_name]) prods[r.product_name] = { count: 0, revenue: 0, cost: 0, profit: 0 };
      prods[r.product_name].count++;
      prods[r.product_name].revenue += r.revenue;
      prods[r.product_name].cost += r.cost;
      prods[r.product_name].profit += r.profit;
    });
    return Object.entries(prods).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [fRobot]);

  const lztByGame = useMemo(() => {
    const games: Record<string, { count: number; profit: number; revenue: number }> = {};
    fLzt.forEach(l => {
      const g = l.game || "Outros";
      if (!games[g]) games[g] = { count: 0, profit: 0, revenue: 0 };
      games[g].count++;
      games[g].profit += Number(l.profit);
      games[g].revenue += Number(l.sell_price);
    });
    return Object.entries(games).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [fLzt]);

  // ─── Daily/Hourly revenue chart ───
  const dailyData = useMemo(() => {
    if (period === "24h") {
      // Show hourly data for 24h — use local-time keys for consistency
      const hours: Record<number, { date: string; receita: number }> = {};
      for (let i = 23; i >= 0; i--) {
        const d = new Date(Date.now() - i * 3600000);
        const localHour = d.getHours();
        // Use a numeric key based on the epoch-hour to avoid UTC/local mismatch
        const epochHourKey = Math.floor(d.getTime() / 3600000);
        hours[epochHourKey] = { date: `${localHour.toString().padStart(2, "0")}h`, receita: 0 };
      }
      fp.forEach(p => {
        const t = new Date(p.paid_at || p.created_at).getTime();
        const epochHourKey = Math.floor(t / 3600000);
        if (hours[epochHourKey]) hours[epochHourKey].receita += p.amount / 100;
      });
      return Object.values(hours);
    }
    const days: Record<string, { date: string; receita: number }> = {};
    // For "all" period, derive the actual range from data instead of hardcoding 90 days
    const defaultDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    let numDays = defaultDays;
    if (period === "all" && fp.length > 0) {
      const oldest = fp.reduce((min, p) => {
        const t = new Date(p.paid_at || p.created_at).getTime();
        return Number.isFinite(t) && t < min ? t : min;
      }, Date.now());
      const span = Math.ceil((Date.now() - oldest) / 86400000) + 1;
      numDays = Math.max(span, 1);
    }
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      days[key] = { date: label, receita: 0 };
    }
    fp.forEach(p => {
      const dt = new Date(p.paid_at || p.created_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      if (days[key]) days[key].receita += p.amount / 100;
    });
    return Object.values(days);
  }, [fp, period]);

  // ─── Revenue pie data ───
  const revenuePieData = useMemo((): { name: string; value: number }[] => {
    const data: { name: string; value: number }[] = [];
    if (revenueBreakdown.stock > 0) data.push({ name: "Estoque", value: revenueBreakdown.stock });
    if (revenueBreakdown.robot > 0) data.push({ name: "Cheats", value: revenueBreakdown.robot });
    if (revenueBreakdown.lzt > 0) data.push({ name: "Contas LZT", value: revenueBreakdown.lzt });
    return data;
  }, [revenueBreakdown]);

  // ─── PDF Export ───
  const generatePDF = () => {
    const periodLabel = period === "24h" ? "Últimas 24 horas" : period === "7d" ? "Últimos 7 dias" : period === "30d" ? "Últimos 30 dias" : "Todo período";
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const html = `<!DOCTYPE html><html><head><title>Relatório Financeiro</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:40px;color:#1a1a2e;background:#fff}
    h1{font-size:22px;margin-bottom:4px}.subtitle{color:#666;font-size:12px;margin-bottom:28px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
    .card{padding:16px;border:1px solid #e0e0e0;border-radius:10px}
    .card-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px}
    .card-value{font-size:22px;font-weight:700;margin-top:2px}
    .green{color:#00c853}.red{color:#e53935}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #eee;font-size:12px}
    th{background:#f8f8f8;font-weight:600;color:#555}
    .section{font-size:15px;font-weight:600;margin-top:28px;margin-bottom:10px}
    .footer{margin-top:36px;text-align:center;color:#aaa;font-size:10px}</style></head><body>
    <h1>📊 Relatório Financeiro</h1><p class="subtitle">${periodLabel} · ${now}</p>
    <div class="grid">
      <div class="card"><p class="card-label">Receita</p><p class="card-value green">R$ ${fmt(totalRevenue)}</p></div>
      <div class="card"><p class="card-label">Lucro</p><p class="card-value green">R$ ${fmt(netProfit)}</p></div>
      <div class="card"><p class="card-label">Margem</p><p class="card-value">${profitMargin.toFixed(1)}%</p></div>
      <div class="card"><p class="card-label">Transações</p><p class="card-value">${fp.length}</p></div>
    </div>
    <p class="section">Custos</p><div class="grid">
      <div class="card"><p class="card-label">Custo LZT</p><p class="card-value">R$ ${fmt(lztTotalBought)}</p></div>
      <div class="card"><p class="card-label">Custo Robot</p><p class="card-value">R$ ${fmt(robotTotalCost)}</p></div>
      
    </div>
    <p class="footer">Royal Store · Relatório gerado automaticamente</p></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

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
        <h2 className="text-lg font-bold text-foreground">Financeiro</h2>
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
          <button onClick={() => { invalidateAdminCache(); fetchData(); }} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={generatePDF} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            <Download className="h-3 w-3" /> PDF
          </button>
        </div>
      </div>

      {/* Hero: Profit + Margin */}
      <div className="rounded-xl border border-success/20 bg-success/[0.03] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-3xl font-black text-success tracking-tight">R$ {fmt(netProfit)}</p>
              <p className="text-xs text-muted-foreground">Lucro Líquido · Margem <span className="font-bold text-foreground">{profitMargin.toFixed(1)}%</span></p>
            </div>
          </div>
          {period !== "all" && revenueChange !== 0 && (
            <span className={`flex items-center gap-1 text-xs font-bold rounded-full px-2 py-1 ${
              revenueChange > 0 ? "bg-positive/15 text-positive" : "bg-destructive/15 text-destructive"
            }`}>
              {revenueChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(revenueChange).toFixed(0)}%
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-card border border-border p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Receita</p>
            <p className="text-sm font-semibold text-muted-foreground mt-1">R$ {fmtCompact(totalRevenue)}</p>
          </div>
          <div className="rounded-lg bg-card border border-border p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Custo LZT</p>
            <p className="text-sm font-semibold text-muted-foreground mt-1">R$ {fmtCompact(lztTotalBought)}</p>
          </div>
          <div className="rounded-lg bg-card border border-border p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Custo Robot</p>
            <p className="text-sm font-semibold text-muted-foreground mt-1">R$ {fmtCompact(robotTotalCost)}</p>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Receipt className="h-4 w-4 text-info" />} label="Transações" value={String(fp.length)}
          change={period !== "all" ? pctChange(fp.length, pp.length) : undefined} />
        <StatCard icon={<Users className="h-4 w-4 text-warning" />} label="Compradores" value={String(uniqueBuyers)}
          change={period !== "all" ? buyersChange : undefined} />
        <StatCard icon={<Wallet className="h-4 w-4 text-positive" />} label="Ticket Médio" value={`R$ ${fmt(avgTicket)}`}
          change={period !== "all" ? avgTicketChange : undefined} />
        <StatCard icon={<DollarSign className="h-4 w-4 text-info" />} label="Câmbio USD→BRL" value={`R$ ${usdToBrl.toFixed(2)}`} />
      </div>

      {/* Daily Revenue Chart */}
      {dailyData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <CalendarDays className="h-4 w-4 text-success" />
            {period === "24h" ? "Movimentação por Hora" : "Movimentação Diária"}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(197,100%,50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(197,100%,50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(0,0%,55%)", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "hsl(0,0%,55%)", fontSize: 10 }} />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: number) => [`R$ ${fmt(value)}`]} />
              <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(197,100%,50%)" fill="url(#gradReceita)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue breakdown + details */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pie: Revenue by source */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-success" />
            Distribuição por Fonte
          </h3>
          {revenuePieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <RechartsPie>
                  <Pie data={revenuePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                    {revenuePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} formatter={(value: number, name: string) => [`R$ ${fmt(value)}`, name]} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {revenuePieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </span>
                    <span className="font-bold text-foreground">R$ {fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Profit by source */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-positive" />
            Lucro por Fonte
          </h3>

          {/* Robot */}
          {fRobot.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-warning" /> Robot Project
                </span>
                <span className="text-xs font-bold text-positive">+R$ {fmt(robotTotalProfit)}</span>
              </div>
              {robotByProduct.map(([name, data]) => (
                <div key={name} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-1.5">
                  <span className="text-[11px] text-muted-foreground">{name} ({data.count})</span>
                  <span className="text-[11px] font-bold text-positive">+R$ {fmt(data.profit)}</span>
                </div>
              ))}
            </div>
          )}

          {/* LZT */}
          {fLzt.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3 text-success" /> LZT Market
                </span>
                <span className="text-xs font-bold text-positive">+R$ {fmt(lztTotalProfit)}</span>
              </div>
              {lztByGame.map(([game, data]) => (
                <div key={game} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-1.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Gamepad2 className="h-2.5 w-2.5" /> {game} ({data.count})
                  </span>
                  <span className="text-[11px] font-bold text-positive">+R$ {fmt(data.profit)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reseller */}
          {fReseller.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-warning/[0.06] border border-warning/15 px-3 py-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3 text-warning" /> Revendedores
              </span>
              <span className="text-xs text-warning font-bold">-R$ {fmt(fReseller.reduce((s, r) => s + (Number(r.original_price) - Number(r.paid_price)), 0))}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceTab;
