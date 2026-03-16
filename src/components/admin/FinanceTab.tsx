import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import {
  Loader2, DollarSign, ShoppingCart, Globe, TrendingUp, TrendingDown,
  Download, PieChart, Wallet, Users, ArrowUp, ArrowDown, Minus, Gamepad2,
  Receipt, BarChart3, CalendarDays, Package, Percent, Zap, RefreshCw
} from "lucide-react";
import {
  PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Legend
} from "recharts";

interface PaymentRow {
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  cart_snapshot: any;
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
  metadata: any;
  // enriched
  product_name: string;
  plan_name: string;
  revenue: number;
  cost: number;
  profit: number;
}

type Period = "24h" | "7d" | "30d" | "all";

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

// ─── Helpers ───
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
    return new Date(d).getTime() >= cutoff;
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
    return t >= start && t < end;
  });
};

// ─── Stat Card ───
const StatCard = ({
  icon, label, value, prefix = "", suffix = "",
  change, highlight, small, className = ""
}: {
  icon: React.ReactNode; label: string; value: string;
  prefix?: string; suffix?: string;
  change?: number; highlight?: boolean; small?: boolean;
  className?: string;
}) => (
  <div className={`rounded-xl border bg-card p-4 ${highlight ? "border-success/30 bg-success/[0.03]" : "border-border"} ${className}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
        {icon}
      </div>
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
    <p className={`font-bold tracking-tight ${highlight ? "text-success" : "text-foreground"} ${small ? "text-lg" : "text-xl"}`}>
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
  const [period, setPeriod] = useState<Period>("30d");
  const [usdToBrl, setUsdToBrl] = useState(5.5);

  const fetchData = async () => {
    setLoading(true);

    // Fetch USD exchange rate
    let currentRate = usdToBrl;
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const json = await res.json();
      if (json?.rates?.BRL) {
        currentRate = json.rates.BRL;
        setUsdToBrl(currentRate);
      }
    } catch { /* use fallback */ }

    const [paymentsData, lztData, resellerData, robotProductsRes] = await Promise.all([
      fetchAllRows<PaymentRow>("payments", {
        select: "amount, status, created_at, paid_at, cart_snapshot, payment_method, discount_amount, user_id",
        filters: [{ column: "status", op: "eq", value: "COMPLETED" }],
        order: { column: "paid_at", ascending: false },
      }),
      fetchAllRows<LztSale>("lzt_sales", {
        select: "buy_price, sell_price, profit, created_at, game",
        order: { column: "created_at", ascending: false },
      }),
      fetchAllRows<ResellerPurchase>("reseller_purchases", {
        select: "original_price, paid_price, created_at",
        order: { column: "created_at", ascending: false },
      }),
      supabase.from("products").select("id, name, robot_game_id, robot_markup_percent").not("robot_game_id", "is", null),
    ]);

    setPayments(paymentsData);
    setLztSales(lztData);
    setResellerPurchases(resellerData);

    // Fetch Robot tickets
    const robotProducts = robotProductsRes.data || [];
    if (robotProducts.length > 0) {
      const productIds = robotProducts.map(p => p.id);
      const productMap = Object.fromEntries(robotProducts.map(p => [p.id, p]));

      const [ticketsRes, plansRes] = await Promise.all([
        fetchAllRows("order_tickets", {
          select: "id, created_at, product_id, product_plan_id, user_id, metadata, status",
          filters: [{ column: "status", op: "eq", value: "delivered" }],
          order: { column: "created_at", ascending: false },
        }),
        supabase.from("product_plans").select("id, name, price, robot_duration_days").in("product_id", productIds),
      ]);
      // Reuse paymentsData already fetched above instead of fetching again
      const robotPaymentsRes = paymentsData;

      const robotTicketsRaw = (ticketsRes || []).filter((t: any) => productIds.includes(t.product_id));
      const planMap = Object.fromEntries((plansRes.data || []).map((p: any) => [p.id, p]));

      // Build paid price map from cart_snapshot
      const paidPriceMap = new Map<string, number>();
      for (const pay of robotPaymentsRes) {
        const snapshot = pay.cart_snapshot as any[];
        if (!Array.isArray(snapshot)) continue;
        for (const item of snapshot) {
          const key = `${pay.user_id}|${item.productId}|${item.planId}`;
          if (!paidPriceMap.has(key) && item.price != null) {
            paidPriceMap.set(key, Number(item.price));
          }
        }
      }

      const enriched: RobotTicket[] = robotTicketsRaw.map((t: any) => {
        const product = productMap[t.product_id];
        const plan = planMap[t.product_plan_id];
        const meta = (t.metadata || {}) as Record<string, any>;

        const revenue = paidPriceMap.get(`${t.user_id}|${t.product_id}|${t.product_plan_id}`) ?? plan?.price ?? 0;

        let cost = 0;
        if (meta.amount_spent && Number(meta.amount_spent) > 0) {
          cost = Number(meta.amount_spent) * currentRate;
        } else if (meta.is_free) {
          cost = 0;
        } else if (product?.robot_markup_percent) {
          cost = revenue / (1 + (product.robot_markup_percent || 50) / 100);
        }

        return {
          id: t.id,
          created_at: t.created_at || "",
          product_id: t.product_id,
          product_plan_id: t.product_plan_id,
          user_id: t.user_id,
          metadata: meta,
          product_name: product?.name || "Produto Robot",
          plan_name: plan?.name || "—",
          revenue,
          cost: Math.round(cost * 100) / 100,
          profit: Math.round((revenue - cost) * 100) / 100,
        };
      });

      setRobotTickets(enriched);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ─── Filtered data ───
  const fp = useMemo(() => filterByPeriod(payments, period), [payments, period]);
  const pp = useMemo(() => getPreviousPeriodItems(payments, period), [payments, period]);
  const fLzt = useMemo(() => filterByPeriod(lztSales, period, "created_at"), [lztSales, period]);
  const pLzt = useMemo(() => getPreviousPeriodItems(lztSales, period, "created_at"), [lztSales, period]);
  const fReseller = useMemo(() => filterByPeriod(resellerPurchases, period, "created_at"), [resellerPurchases, period]);
  const fRobot = useMemo(() => filterByPeriod(robotTickets, period, "created_at"), [robotTickets, period]);
  const pRobot = useMemo(() => getPreviousPeriodItems(robotTickets, period, "created_at"), [robotTickets, period]);

  // ─── Revenue metrics ───
  const totalRevenue = useMemo(() => fp.reduce((s, p) => s + p.amount / 100, 0), [fp]);
  const prevRevenue = useMemo(() => pp.reduce((s, p) => s + p.amount / 100, 0), [pp]);
  const revenueChange = pctChange(totalRevenue, prevRevenue);

  // Separate product revenue: Robot vs Stock vs LZT
  const revenueBreakdown = useMemo(() => {
    let lzt = 0, robot = 0, stock = 0;
    fp.forEach(p => {
      const cart = p.cart_snapshot as any[];
      if (!Array.isArray(cart)) { stock += p.amount / 100; return; }
      const isLzt = cart.some((i: any) => i.type === "lzt-account");
      if (isLzt) lzt += p.amount / 100;
      else stock += p.amount / 100;
    });
    // Robot revenue comes from stock pool — we know the exact amount from robotTickets
    const robotRev = fRobot.reduce((s, r) => s + r.revenue, 0);
    const pureStock = Math.max(0, stock - robotRev);
    return { lzt, robot: robotRev, stock: pureStock };
  }, [fp, fRobot]);

  // ─── LZT Profit ───
  const lztTotalBought = useMemo(() => fLzt.reduce((s, l) => s + Number(l.buy_price), 0), [fLzt]);
  const lztTotalSold = useMemo(() => fLzt.reduce((s, l) => s + Number(l.sell_price), 0), [fLzt]);
  const lztTotalProfit = useMemo(() => fLzt.reduce((s, l) => s + Number(l.profit), 0), [fLzt]);
  const prevLztProfit = useMemo(() => pLzt.reduce((s, l) => s + Number(l.profit), 0), [pLzt]);

  // ─── Robot Profit ───
  const robotTotalRevenue = useMemo(() => fRobot.reduce((s, r) => s + r.revenue, 0), [fRobot]);
  const robotTotalCost = useMemo(() => fRobot.reduce((s, r) => s + r.cost, 0), [fRobot]);
  const robotTotalProfit = useMemo(() => fRobot.reduce((s, r) => s + r.profit, 0), [fRobot]);
  const prevRobotProfit = useMemo(() => pRobot.reduce((s, r) => s + r.profit, 0), [pRobot]);
  const robotProfitChange = pctChange(robotTotalProfit, prevRobotProfit);

  // Robot by product
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

  // ─── Reseller metrics ───
  const resellerTotal = useMemo(() => fReseller.reduce((s, r) => s + Number(r.paid_price), 0), [fReseller]);
  const resellerOriginal = useMemo(() => fReseller.reduce((s, r) => s + Number(r.original_price), 0), [fReseller]);
  const resellerDiscount = resellerOriginal - resellerTotal;

  // ─── Discounts given ───
  const totalDiscounts = useMemo(() => fp.reduce((s, p) => s + (Number(p.discount_amount) || 0), 0), [fp]);

  // ─── Unique buyers ───
  const uniqueBuyers = useMemo(() => new Set(fp.map(p => p.user_id)).size, [fp]);
  const prevBuyers = useMemo(() => new Set(pp.map(p => p.user_id)).size, [pp]);
  const buyersChange = pctChange(uniqueBuyers, prevBuyers);

  // ─── Ticket medio ───
  const avgTicket = fp.length > 0 ? totalRevenue / fp.length : 0;
  const prevAvgTicket = pp.length > 0 ? prevRevenue / pp.length : 0;
  const avgTicketChange = pctChange(avgTicket, prevAvgTicket);

  // ─── Net Profit = revenue - LZT cost - Robot cost - discounts ───
  const totalCosts = lztTotalBought + robotTotalCost + totalDiscounts;
  const netProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // ─── Payment method breakdown ───
  const methodStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    fp.forEach(p => {
      const method = p.payment_method || "pix";
      if (!stats[method]) stats[method] = { count: 0, revenue: 0 };
      stats[method].count++;
      stats[method].revenue += p.amount / 100;
    });
    return stats;
  }, [fp]);

  const methodLabels: Record<string, string> = { pix: "PIX", card: "Cartão", crypto: "Cripto" };

  const pieData = Object.entries(methodStats)
    .filter(([, v]) => v.count > 0)
    .map(([key, v]) => ({ name: methodLabels[key] || key, value: v.count, revenue: v.revenue }));

  // ─── Revenue breakdown pie ───
  const revenuePieData = useMemo(() => {
    const data = [];
    if (revenueBreakdown.stock > 0) data.push({ name: "Estoque Local", value: revenueBreakdown.stock });
    if (revenueBreakdown.robot > 0) data.push({ name: "Cheats (Robot)", value: revenueBreakdown.robot });
    if (revenueBreakdown.lzt > 0) data.push({ name: "Contas LZT", value: revenueBreakdown.lzt });
    return data;
  }, [revenueBreakdown]);

  // ─── Daily revenue chart ───
  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; estoque: number; robot: number; contas: number }> = {};
    const numDays = period === "24h" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
    
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      days[key] = { date: label, estoque: 0, robot: 0, contas: 0 };
    }

    // Robot product IDs for categorization
    const robotProductIds = new Set(robotTickets.map(r => r.product_id));

    fp.forEach(p => {
      const d = (p.paid_at || p.created_at).slice(0, 10);
      if (!days[d]) return;
      const cart = p.cart_snapshot as any[];
      const isLzt = Array.isArray(cart) && cart.some((i: any) => i.type === "lzt-account");
      if (isLzt) {
        days[d].contas += p.amount / 100;
      } else {
        // Check if any cart item is a robot product
        const isRobot = Array.isArray(cart) && cart.some((i: any) => robotProductIds.has(i.productId));
        if (isRobot) days[d].robot += p.amount / 100;
        else days[d].estoque += p.amount / 100;
      }
    });

    return Object.values(days);
  }, [fp, robotTickets, period]);

  // ─── LZT by game ───
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

  // ─── Monthly breakdown ───
  const monthlyData = useMemo(() => {
    if (period !== "all" && period !== "30d") return [];
    const months: Record<string, { name: string; estoque: number; robot: number; contas: number; total: number }> = {};
    const robotProductIds = new Set(robotTickets.map(r => r.product_id));
    payments.forEach(p => {
      if (p.status !== "COMPLETED" || !p.paid_at) return;
      const key = new Date(p.paid_at).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (!months[key]) months[key] = { name: key, estoque: 0, robot: 0, contas: 0, total: 0 };
      const cart = p.cart_snapshot as any[];
      const isLzt = Array.isArray(cart) && cart.some((i: any) => i.type === "lzt-account");
      const val = p.amount / 100;
      if (isLzt) months[key].contas += val;
      else {
        const isRobot = Array.isArray(cart) && cart.some((i: any) => robotProductIds.has(i.productId));
        if (isRobot) months[key].robot += val;
        else months[key].estoque += val;
      }
      months[key].total += val;
    });
    return Object.values(months);
  }, [payments, robotTickets, period]);

  // ─── PDF Export ───
  const generatePDF = () => {
    const periodLabel = period === "24h" ? "Últimas 24h" : period === "7d" ? "Últimos 7 dias" : period === "30d" ? "Últimos 30 dias" : "Todo período";
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const html = `<!DOCTYPE html><html><head><title>Relatório Financeiro</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:40px;color:#1a1a2e;background:#fff}
      h1{font-size:22px;margin-bottom:4px}.subtitle{color:#666;font-size:12px;margin-bottom:28px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
      .card{padding:16px;border:1px solid #e0e0e0;border-radius:10px}
      .card-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px}
      .card-value{font-size:22px;font-weight:700;margin-top:2px}
      .green{color:#00c853}.red{color:#e53935}.blue{color:#2196f3}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #eee;font-size:12px}
      th{background:#f8f8f8;font-weight:600;color:#555}
      .section{font-size:15px;font-weight:600;margin-top:28px;margin-bottom:10px}
      .footer{margin-top:36px;text-align:center;color:#aaa;font-size:10px}
    </style></head><body>
      <h1>📊 Relatório Financeiro Completo</h1>
      <p class="subtitle">${periodLabel} · Gerado em ${now}</p>
      <div class="grid">
        <div class="card"><p class="card-label">Receita Total</p><p class="card-value green">R$ ${fmt(totalRevenue)}</p></div>
        <div class="card"><p class="card-label">Lucro Líquido</p><p class="card-value green">R$ ${fmt(netProfit)}</p></div>
        <div class="card"><p class="card-label">Margem</p><p class="card-value">${profitMargin.toFixed(1)}%</p></div>
        <div class="card"><p class="card-label">Transações</p><p class="card-value">${fp.length}</p></div>
      </div>
      <p class="section">Receita por Categoria</p>
      <div class="grid">
        <div class="card"><p class="card-label">Estoque Local</p><p class="card-value">R$ ${fmt(revenueBreakdown.stock)}</p></div>
        <div class="card"><p class="card-label">Cheats (Robot)</p><p class="card-value blue">R$ ${fmt(revenueBreakdown.robot)}</p></div>
        <div class="card"><p class="card-label">Contas LZT</p><p class="card-value">R$ ${fmt(revenueBreakdown.lzt)}</p></div>
        <div class="card"><p class="card-label">Descontos</p><p class="card-value red">-R$ ${fmt(totalDiscounts)}</p></div>
      </div>
      <p class="section">Custos e Lucros</p>
      <div class="grid">
        <div class="card"><p class="card-label">Custo LZT</p><p class="card-value red">R$ ${fmt(lztTotalBought)}</p></div>
        <div class="card"><p class="card-label">Lucro LZT</p><p class="card-value green">R$ ${fmt(lztTotalProfit)}</p></div>
        <div class="card"><p class="card-label">Custo Robot</p><p class="card-value red">R$ ${fmt(robotTotalCost)}</p></div>
        <div class="card"><p class="card-label">Lucro Robot</p><p class="card-value green">R$ ${fmt(robotTotalProfit)}</p></div>
      </div>
      <p class="section">Métodos de Pagamento</p>
      <table><tr><th>Método</th><th>Transações</th><th>Receita</th></tr>
      ${Object.entries(methodStats).map(([k, v]) => `<tr><td>${methodLabels[k] || k}</td><td>${v.count}</td><td>R$ ${fmt(v.revenue)}</td></tr>`).join("")}
      </table>
      ${robotByProduct.length > 0 ? `<p class="section">Lucro Robot por Produto</p>
      <table><tr><th>Produto</th><th>Vendas</th><th>Receita</th><th>Custo</th><th>Lucro</th></tr>
      ${robotByProduct.map(([name, d]) => `<tr><td>${name}</td><td>${d.count}</td><td>R$ ${fmt(d.revenue)}</td><td>R$ ${fmt(d.cost)}</td><td>R$ ${fmt(d.profit)}</td></tr>`).join("")}
      </table>` : ""}
      ${lztByGame.length > 0 ? `<p class="section">Lucro LZT por Jogo</p>
      <table><tr><th>Jogo</th><th>Vendas</th><th>Receita</th><th>Lucro</th></tr>
      ${lztByGame.map(([g, d]) => `<tr><td>${g}</td><td>${d.count}</td><td>R$ ${fmt(d.revenue)}</td><td>R$ ${fmt(d.profit)}</td></tr>`).join("")}
      </table>` : ""}
      <p class="footer">Royal Store · Relatório gerado automaticamente</p>
    </body></html>`;

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
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Financeiro</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Receita, custos e lucro do seu negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
            {([["24h", "24h"], ["7d", "7d"], ["30d", "30d"], ["all", "Tudo"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${
                  period === key
                    ? "bg-success text-success-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => fetchData()} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3 w-3" />
          </button>
          <button onClick={generatePDF} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            <Download className="h-3 w-3" /> PDF
          </button>
        </div>
      </div>

      {/* ═══ HERO: Lucro Total ═══ */}
      <div className="rounded-xl border-2 border-success/30 bg-success/[0.04] p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-xs font-bold text-success uppercase tracking-wider">Lucro Total</p>
            <p className="text-[10px] text-muted-foreground">Receita menos todos os custos</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-3xl font-black text-success tracking-tight">R$ {fmt(netProfit)}</p>
            <p className="text-xs text-muted-foreground">Margem: <span className="font-bold text-foreground">{profitMargin.toFixed(1)}%</span></p>
          </div>
        </div>

        {/* Breakdown: Receita - Custos = Lucro */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-card border border-border p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Receita Bruta</p>
            <p className="text-lg font-bold text-foreground mt-1">R$ {fmtCompact(totalRevenue)}</p>
          </div>
          <div className="rounded-lg bg-card border border-destructive/15 p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custo LZT</p>
            <p className="text-lg font-bold text-destructive mt-1">-R$ {fmtCompact(lztTotalBought)}</p>
          </div>
          <div className="rounded-lg bg-card border border-destructive/15 p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custo Robot</p>
            <p className="text-lg font-bold text-destructive mt-1">-R$ {fmtCompact(robotTotalCost)}</p>
          </div>
          <div className="rounded-lg bg-card border border-destructive/15 p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Descontos</p>
            <p className="text-lg font-bold text-destructive mt-1">-R$ {fmtCompact(totalDiscounts)}</p>
          </div>
        </div>
      </div>

      {/* ═══ Métricas Rápidas ═══ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Receipt className="h-4 w-4 text-info" />} label="Transações" value={String(fp.length)}
          change={period !== "all" ? pctChange(fp.length, pp.length) : undefined} />
        <StatCard icon={<Users className="h-4 w-4 text-warning" />} label="Compradores" value={String(uniqueBuyers)}
          change={period !== "all" ? buyersChange : undefined} />
        <StatCard icon={<Wallet className="h-4 w-4 text-positive" />} label="Ticket Médio" value={`R$ ${fmt(avgTicket)}`}
          change={period !== "all" ? avgTicketChange : undefined} />
        <StatCard icon={<Globe className="h-4 w-4 text-info" />} label="Câmbio USD→BRL" value={`R$ ${usdToBrl.toFixed(2)}`} />
      </div>

      {/* ═══ Receita por Fonte ═══ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-3.5 w-3.5 text-info" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estoque Local</span>
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmtCompact(revenueBreakdown.stock)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-warning" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cheats (Robot)</span>
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmtCompact(revenueBreakdown.robot)}</p>
          {robotTotalProfit > 0 && <p className="text-[10px] text-positive mt-0.5">Lucro: R$ {fmt(robotTotalProfit)}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-success" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Contas LZT</span>
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmtCompact(revenueBreakdown.lzt)}</p>
          {lztTotalProfit > 0 && <p className="text-[10px] text-positive mt-0.5">Lucro: R$ {fmt(lztTotalProfit)}</p>}
        </div>
      </div>

      {/* ═══ Gráfico Diário ═══ */}
      {dailyData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <CalendarDays className="h-4 w-4 text-success" />
            Faturamento Diário
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="gradEstoque" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(220,80%,55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(220,80%,55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRobot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradContas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(197,100%,50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(197,100%,50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(0,0%,55%)", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "hsl(0,0%,55%)", fontSize: 10 }} />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: number) => [`R$ ${fmt(value)}`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="estoque" name="Estoque" stroke="hsl(220,80%,55%)" fill="url(#gradEstoque)" strokeWidth={2} />
              <Area type="monotone" dataKey="robot" name="Cheats" stroke="hsl(38,92%,50%)" fill="url(#gradRobot)" strokeWidth={2} />
              <Area type="monotone" dataKey="contas" name="Contas" stroke="hsl(197,100%,50%)" fill="url(#gradContas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ Detalhes por Fonte ═══ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Robot Details */}
        {fRobot.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                Robot Project
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{fRobot.length} vendas</span>
                {period !== "all" && robotProfitChange !== 0 && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                    robotProfitChange > 0 ? "bg-positive/15 text-positive" : "bg-destructive/15 text-destructive"
                  }`}>
                    {robotProfitChange > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                    {Math.abs(robotProfitChange).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary/40 p-2.5 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase">Receita</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">R$ {fmt(robotTotalRevenue)}</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2.5 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase">Custo</p>
                  <p className="text-sm font-bold text-destructive mt-0.5">R$ {fmt(robotTotalCost)}</p>
                </div>
                <div className="rounded-lg bg-positive/[0.08] border border-positive/20 p-2.5 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase">Lucro</p>
                  <p className="text-sm font-bold text-positive mt-0.5">R$ {fmt(robotTotalProfit)}</p>
                </div>
              </div>
              {robotByProduct.length > 0 && (
                <div className="space-y-1">
                  {robotByProduct.map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">{name} <span className="text-muted-foreground">({data.count})</span></span>
                      <span className="text-xs font-bold text-positive">+R$ {fmt(data.profit)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LZT Details */}
        {(fLzt.length > 0 || lztSales.length > 0) && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-success" />
                LZT Market
              </h3>
              <span className="text-[10px] text-muted-foreground">{fLzt.length} vendas</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary/40 p-2.5 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase">Custo</p>
                  <p className="text-sm font-bold text-destructive mt-0.5">R$ {fmt(lztTotalBought)}</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2.5 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase">Receita</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">R$ {fmt(lztTotalSold)}</p>
                </div>
                <div className="rounded-lg bg-positive/[0.08] border border-positive/20 p-2.5 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase">Lucro</p>
                  <p className="text-sm font-bold text-positive mt-0.5">R$ {fmt(lztTotalProfit)}</p>
                </div>
              </div>
              {lztByGame.length > 0 && (
                <div className="space-y-1">
                  {lztByGame.map(([game, data]) => (
                    <div key={game} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                      <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Gamepad2 className="h-3 w-3 text-muted-foreground" />
                        {game} <span className="text-muted-foreground">({data.count})</span>
                      </span>
                      <span className="text-xs font-bold text-positive">+R$ {fmt(data.profit)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Revendedores ═══ */}
      {fReseller.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-bold text-foreground">Revendedores</h3>
            <span className="text-[10px] text-muted-foreground">({fReseller.length} compras)</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary/40 p-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Original</p>
              <p className="text-lg font-bold text-foreground mt-1">R$ {fmt(resellerOriginal)}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pago</p>
              <p className="text-lg font-bold text-foreground mt-1">R$ {fmt(resellerTotal)}</p>
            </div>
            <div className="rounded-lg bg-warning/[0.08] border border-warning/20 p-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Desconto</p>
              <p className="text-lg font-bold text-warning mt-1">R$ {fmt(resellerDiscount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Gráficos Secundários ═══ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Receita por Fonte Pie */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <PieChart className="h-4 w-4 text-success" />
            Receita por Fonte
          </h3>
          {revenuePieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie data={revenuePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
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

        {/* Payment Methods Pie */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4 text-success" />
            Métodos de Pagamento
          </h3>
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} formatter={(value: number, name: string, props: any) => [
                    `${value} transações · R$ ${fmt(props.payload.revenue)}`, name
                  ]} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[(i + 3) % COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </span>
                    <span className="font-bold text-foreground">R$ {fmt(d.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ Faturamento Mensal ═══ */}
      {monthlyData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-success" />
            Faturamento Mensal
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
              <XAxis dataKey="name" tick={{ fill: "hsl(0,0%,55%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(0,0%,55%)", fontSize: 11 }} />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: number) => [`R$ ${fmt(value)}`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="estoque" name="Estoque" fill="hsl(220,80%,55%)" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="robot" name="Cheats" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="contas" name="Contas" fill="hsl(197,100%,50%)" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default FinanceTab;
