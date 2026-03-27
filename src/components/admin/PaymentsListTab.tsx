import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Loader2, Search, DollarSign, Clock, RefreshCw, 
  ChevronLeft, ChevronRight, Eye, Check, XCircle, AlertCircle
} from "lucide-react";

interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  charge_id: string | null;
  payment_method: string | null;
  cart_snapshot: any;
  customer_data: any;
  username?: string;
}

const ITEMS_PER_PAGE = 20;

const statusColors: Record<string, string> = {
  COMPLETED: "bg-success/15 text-success border-success/30",
  ACTIVE: "bg-warning/15 text-warning border-warning/30",
  PENDING: "bg-warning/15 text-warning border-warning/30",
  FAILED: "bg-destructive/15 text-destructive border-destructive/30",
  EXPIRED: "bg-muted text-muted-foreground border-border",
};

const PaymentsListTab = () => {
  const { usernameMap } = useAdminUsers();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await fetchAllRows<PaymentRow>("payments", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });
      setPayments(data || []);
    } catch (err) {
      console.error("fetchPayments error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  const filtered = useMemo(() => {
    let result = payments;
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.charge_id || "").toLowerCase().includes(q) ||
          (usernameMap.get(p.user_id) || "").toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [payments, statusFilter, search, usernameMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-foreground">Todos os Pagamentos</h2>
        <button onClick={fetchPayments} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, Charge ID ou Usuário..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {["all", "COMPLETED", "ACTIVE", "FAILED", "EXPIRED"].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                statusFilter === f ? "bg-success/20 text-success border border-success/30" : "bg-secondary/50 text-muted-foreground border border-border"
              }`}
            >
              {f === "all" ? "Todos" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30 text-[10px] font-semibold text-muted-foreground uppercase">
              <th className="px-3 py-2.5 text-left">Usuário</th>
              <th className="px-3 py-2.5 text-left">Valor</th>
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-left">Data</th>
              <th className="px-3 py-2.5 text-left">Charge ID</th>
              <th className="px-3 py-2.5 text-left">Método</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-success" /></td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum pagamento encontrado.</td></tr>
            ) : (
              paginated.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/10">
                  <td className="px-3 py-2.5 text-xs font-medium">{usernameMap.get(p.user_id) || p.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-foreground">R$ {(p.amount / 100).toFixed(2)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColors[p.status] || "bg-muted text-muted-foreground border-border"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2.5 text-[10px] font-mono text-muted-foreground">{p.charge_id || "—"}</td>
                  <td className="px-3 py-2.5 text-[10px] uppercase font-bold text-muted-foreground">{p.payment_method || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border bg-card p-1.5 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-border bg-card p-1.5 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsListTab;
