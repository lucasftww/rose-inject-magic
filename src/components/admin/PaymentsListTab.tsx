import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Loader2, Search, DollarSign, Clock, RefreshCw, 
  ChevronLeft, ChevronRight, Eye, Check, XCircle, AlertCircle,
  ShoppingCart, Users, ShieldCheck, Zap
} from "lucide-react";
import { verifyPayment } from "@/hooks/useAdminData";
import { toast } from "@/hooks/use-toast";

type PaymentRow = Tables<"payments"> & { username?: string };

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
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);

  const handleVerify = async (p: PaymentRow) => {
    if (p.status !== "ACTIVE" && p.status !== "PENDING") {
      toast({ title: "Aviso", description: "Este pagamento já está em um estado final." });
      return;
    }
    
    setVerifying(prev => ({ ...prev, [p.id]: true }));
    try {
      const res = await verifyPayment(p.id, p.payment_method || "pix");
      toast({ 
        title: "Sucesso", 
        description: `Status atualizado: ${res.status || "verificado"}.`,
        variant: res.status === "COMPLETED" ? "default" : "destructive" 
      });
      fetchPayments();
      if (selectedPayment?.id === p.id) {
        setSelectedPayment((prev) =>
          prev ? { ...prev, status: res.status ?? prev.status } : null
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro na verificação", description: message, variant: "destructive" });
    } finally {
      setVerifying(prev => ({ ...prev, [p.id]: false }));
    }
  };

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
      toast({
        title: "Erro ao carregar pagamentos",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
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
        <button onClick={fetchPayments} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors group">
          <RefreshCw className="h-4 w-4 group-active:rotate-180 transition-transform duration-500" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, Charge ID ou Usuário..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-success/50"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
          {["all", "COMPLETED", "ACTIVE", "FAILED", "EXPIRED"].map((f) => (
            <button
              key={f}
              onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`rounded-lg px-3 py-2 text-xs font-medium border transition-all whitespace-nowrap ${
                statusFilter === f ? "bg-success/20 text-success border-success/30 shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-secondary"
              }`}
            >
              {f === "all" ? "Todos" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Charge ID</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-success" /></td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground italic">Nenhum pagamento encontrado.</td></tr>
              ) : (
                paginated.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">{usernameMap.get(p.user_id) || "..."}</span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">{p.user_id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-foreground">R$ {(p.amount / 100).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm ${statusColors[p.status ?? ""] || "bg-muted text-muted-foreground border-border"}`}>
                        {p.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">{p.charge_id || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedPayment(p)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-success/10 hover:text-success transition-all active:scale-95"
                          title="Ver Detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {(p.status === "ACTIVE" || p.status === "PENDING") && (
                          <button
                            onClick={() => handleVerify(p)}
                            disabled={verifying[p.id]}
                            className="rounded-lg p-2 text-warning hover:bg-warning/10 transition-all active:scale-95 disabled:opacity-50"
                            title="Verificar Status Manualmente"
                          >
                            {verifying[p.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground font-medium italic">Mostrando {(page-1)*ITEMS_PER_PAGE + 1}-{Math.min(page*ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</p>
          <div className="flex gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border bg-card h-8 w-8 flex items-center justify-center disabled:opacity-30 hover:bg-secondary transition-colors transition-all active:scale-90">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center px-4 rounded-lg bg-secondary/30 border border-border text-[11px] font-bold">
              {page} / {totalPages}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-border bg-card h-8 w-8 flex items-center justify-center disabled:opacity-30 hover:bg-secondary transition-colors transition-all active:scale-90">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="border-b border-border p-4 flex items-center justify-between bg-secondary/30">
              <h3 className="text-lg font-bold text-foreground">Detalhes do Pagamento</h3>
              <button 
                onClick={() => setSelectedPayment(null)}
                className="rounded-lg p-1 hover:bg-secondary text-muted-foreground"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
                  <div className="flex">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusColors[selectedPayment.status]}`}>
                      {selectedPayment.status}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Valor</span>
                  <p className="text-lg font-bold text-foreground">R$ {(selectedPayment.amount / 100).toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">ID do Pagamento</span>
                  <p className="text-xs font-mono text-muted-foreground truncate">{selectedPayment.id}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Data</span>
                  <p className="text-xs text-muted-foreground">{new Date(selectedPayment.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                  Carrinho (Snapshot)
                </h4>
                <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                  <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                    {JSON.stringify(selectedPayment.cart_snapshot, null, 2)}
                  </pre>
                </div>
              </div>

              {selectedPayment.customer_data && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Dados do Cliente
                  </h4>
                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                    <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(selectedPayment.customer_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4 bg-secondary/30 flex justify-between items-center">
              <div>
                {(selectedPayment.status === "ACTIVE" || selectedPayment.status === "PENDING") && (
                  <button
                    onClick={() => handleVerify(selectedPayment)}
                    disabled={verifying[selectedPayment.id]}
                    className="flex items-center gap-2 px-4 py-2 bg-warning/10 text-warning border border-warning/30 rounded-lg text-xs font-bold hover:bg-warning/20 transition-all disabled:opacity-50"
                  >
                    {verifying[selectedPayment.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Verificar Agora
                  </button>
                )}
              </div>
              <button 
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsListTab;
