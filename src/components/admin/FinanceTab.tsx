import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { Loader2, DollarSign, ShoppingCart, Globe, TrendingUp, Download, PieChart } from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface PaymentRow {
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  cart_snapshot: any;
  payment_method: string | null;
}

const COLORS = ["hsl(197,100%,50%)", "hsl(220,80%,55%)", "hsl(45,100%,55%)", "hsl(0,80%,55%)"];

const FinanceTab = () => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  // Aggregated stats from DB function
  const [dbStats, setDbStats] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);

    const since = period !== "all"
      ? new Date(Date.now() - (period === "7d" ? 7 : 30) * 86400000).toISOString()
      : null;

    // Fetch aggregated stats from DB function (no row limit)
    const { data: statsData } = await supabase.rpc("admin_finance_summary", {
      _since: since,
    });
    if (statsData) setDbStats(statsData);

    // Fetch payments for charts (monthly breakdown needs cart_snapshot)
    const filters: any[] = [{ column: "status", op: "eq", value: "COMPLETED" }];
    if (since) filters.push({ column: "paid_at", op: "gte", value: since });

    const allPayments = await fetchAllRows<PaymentRow>("payments", {
      select: "amount, status, created_at, paid_at, cart_snapshot, payment_method",
      filters,
      order: { column: "paid_at", ascending: false },
    });

    setPayments(allPayments);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [period]);

  // Use DB aggregated stats for totals (accurate even with >1000 rows)
  const totalRevenue = dbStats ? Number(dbStats.total_revenue) / 100 : 0;
  const totalCount = dbStats ? Number(dbStats.total_count) : 0;

  // Calculate product vs account split from fetched payments
  const totalProducts = payments.reduce((sum, p) => {
    const cart = p.cart_snapshot as any[];
    if (!Array.isArray(cart)) return sum + p.amount / 100;
    const hasLzt = cart.some((item: any) => item.type === "lzt-account");
    return hasLzt ? sum : sum + p.amount / 100;
  }, 0);

  const totalAccounts = payments.reduce((sum, p) => {
    const cart = p.cart_snapshot as any[];
    if (!Array.isArray(cart)) return sum;
    const hasLzt = cart.some((item: any) => item.type === "lzt-account");
    return hasLzt ? sum + p.amount / 100 : sum;
  }, 0);

  const totalGeneral = totalProducts + totalAccounts;

  // Payment method breakdown from DB stats (accurate)
  const methodCounts: Record<string, number> = {
    pix: dbStats?.method_pix_count || 0,
    card: dbStats?.method_card_count || 0,
    crypto: dbStats?.method_crypto_count || 0,
  };
  const methodRevenue: Record<string, number> = {
    pix: (dbStats?.method_pix_revenue || 0) / 100,
    card: (dbStats?.method_card_revenue || 0) / 100,
    crypto: (dbStats?.method_crypto_revenue || 0) / 100,
  };

  const pieData = Object.entries(methodCounts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: key === "pix" ? "PIX" : key === "card" ? "Cartão" : key === "crypto" ? "USDT" : key,
      value,
    }));

  const barData = Object.entries(methodRevenue)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: key === "pix" ? "PIX" : key === "card" ? "Cartão" : key === "crypto" ? "USDT" : key,
      valor: value,
    }));

  // Monthly breakdown for the bar chart
  const monthlyData = () => {
    const months: Record<string, { produtos: number; contas: number }> = {};

    payments.forEach((p) => {
      if (!p.paid_at) return;
      const key = new Date(p.paid_at).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (!months[key]) months[key] = { produtos: 0, contas: 0 };
      const cart = p.cart_snapshot as any[];
      const isLzt = Array.isArray(cart) && cart.some((i: any) => i.type === "lzt-account");
      if (isLzt) months[key].contas += p.amount / 100;
      else months[key].produtos += p.amount / 100;
    });

    return Object.entries(months).map(([name, data]) => ({ name, ...data }));
  };

  // PDF Generation
  const generatePDF = () => {
    const periodLabel = period === "7d" ? "Últimos 7 dias" : period === "30d" ? "Últimos 30 dias" : "Todo período";
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const html = `
      <html>
      <head>
        <title>Relatório Financeiro</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          .subtitle { color: #666; font-size: 13px; margin-bottom: 32px; }
          .cards { display: flex; gap: 16px; margin-bottom: 32px; }
          .card { flex: 1; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; }
          .card-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
          .card-value { font-size: 28px; font-weight: 700; margin-top: 4px; }
          .card-value.green { color: #00c853; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
          th { background: #f8f8f8; font-weight: 600; color: #555; }
          .section-title { font-size: 16px; font-weight: 600; margin-top: 32px; margin-bottom: 12px; }
          .footer { margin-top: 40px; text-align: center; color: #aaa; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>📊 Relatório Financeiro</h1>
        <p class="subtitle">${periodLabel} · Gerado em ${now}</p>

        <div class="cards">
          <div class="card">
            <p class="card-label">Produtos</p>
            <p class="card-value">R$ ${totalProducts.toFixed(2)}</p>
          </div>
          <div class="card">
            <p class="card-label">Contas</p>
            <p class="card-value">R$ ${totalAccounts.toFixed(2)}</p>
          </div>
          <div class="card">
            <p class="card-label">Total Geral</p>
            <p class="card-value green">R$ ${totalGeneral.toFixed(2)}</p>
          </div>
        </div>

        <p class="section-title">Métodos de Pagamento</p>
        <table>
          <tr><th>Método</th><th>Transações</th><th>Receita</th></tr>
          ${Object.entries(methodCounts)
            .filter(([, v]) => v > 0)
            .map(([key, count]) => `
              <tr>
                <td>${key === "pix" ? "PIX" : key === "card" ? "Cartão" : "USDT"}</td>
                <td>${count}</td>
                <td>R$ ${(methodRevenue[key] || 0).toFixed(2)}</td>
              </tr>
            `).join("")}
        </table>

        <p class="section-title">Últimas Transações</p>
        <table>
          <tr><th>Data</th><th>Valor</th><th>Status</th></tr>
          ${payments.slice(0, 20).map(p => `
            <tr>
              <td>${p.paid_at ? new Date(p.paid_at).toLocaleDateString("pt-BR") : "-"}</td>
              <td>R$ ${(p.amount / 100).toFixed(2)}</td>
              <td>${p.status}</td>
            </tr>
          `).join("")}
        </table>

        <p class="footer">Royal Store · Relatório gerado automaticamente</p>
      </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-success" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Period Filter + PDF */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {([["7d", "7 dias"], ["30d", "30 dias"], ["all", "Tudo"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`rounded-lg px-4 py-2 text-xs font-medium ${
                period === key
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={generatePDF}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-success/30"
        >
          <Download className="h-3.5 w-3.5" />
          Gerar PDF
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-5 w-5 text-success" />
            <span className="text-xs font-medium text-muted-foreground">Produtos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {totalProducts.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{payments.filter(p => { const c = p.cart_snapshot as any[]; return !Array.isArray(c) || !c.some((i: any) => i.type === "lzt-account"); }).length} transações</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-5 w-5 text-success" />
            <span className="text-xs font-medium text-muted-foreground">Contas</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {totalAccounts.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{payments.filter(p => { const c = p.cart_snapshot as any[]; return Array.isArray(c) && c.some((i: any) => i.type === "lzt-account"); }).length} transações</p>
        </div>
        <div className="rounded-lg border border-success/30 bg-success/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <span className="text-xs font-medium text-muted-foreground">Total Geral</span>
          </div>
          <p className="text-2xl font-bold text-success">R$ {totalGeneral.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{totalCount} transações (DB)</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie Chart - Payment Methods */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <PieChart className="h-4 w-4 text-success" />
            Métodos de Pagamento
          </h3>
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RechartsPie>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
              </RechartsPie>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar Chart - Revenue by Method */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <DollarSign className="h-4 w-4 text-success" />
            Receita por Método
          </h3>
          {barData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                />
                <Bar dataKey="valor" fill="hsl(197,100%,50%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly Breakdown */}
      {monthlyData().length > 1 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-success" />
            Faturamento Mensal
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`]}
              />
              <Bar dataKey="produtos" name="Produtos" fill="hsl(220,80%,55%)" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="contas" name="Contas" fill="hsl(197,100%,50%)" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default FinanceTab;
