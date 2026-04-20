import { CalendarDays, Package } from "lucide-react";
import {
  PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from "recharts";

type DailyPoint = { date: string; receita: number };
type PiePoint = { name: string; value: number };

type FinanceChartsProps = {
  section: "daily" | "pie";
  period: "24h" | "7d" | "30d" | "all";
  dailyData: DailyPoint[];
  revenuePieData: PiePoint[];
  colors: string[];
  chartTooltip: {
    contentStyle: Record<string, string | number>;
    labelStyle: Record<string, string | number>;
  };
  fmt: (v: number) => string;
};

export default function FinanceCharts({
  section,
  period,
  dailyData,
  revenuePieData,
  colors,
  chartTooltip,
  fmt,
}: FinanceChartsProps) {
  if (section === "daily") {
    if (dailyData.length === 0) return null;
    return (
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
            <Tooltip {...chartTooltip} formatter={(value: number) => [`R$ ${fmt(value)}`]} />
            <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(197,100%,50%)" fill="url(#gradReceita)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
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
                {revenuePieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip {...chartTooltip} formatter={(value: number, name: string) => [`R$ ${fmt(value)}`, name]} />
            </RechartsPie>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {revenuePieData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </span>
                <span className="font-bold text-foreground">R$ {fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
