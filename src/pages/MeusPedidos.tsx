import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Package, Smartphone, ArrowLeft, Search,
  ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle,
  AlertTriangle, Filter,
} from "lucide-react";
import { motion } from "framer-motion";

interface Ticket {
  id: string;
  product_id: string;
  product_plan_id: string;
  status: string;
  status_label: string;
  created_at: string;
  product_name?: string;
  plan_name?: string;
  image_url?: string | null;
  plan_price?: number;
  metadata?: any;
}

const statusColors: Record<string, string> = {
  open: "bg-warning/20 text-warning border border-warning/20",
  waiting: "bg-warning/20 text-warning border border-warning/20",
  waiting_staff: "bg-info/20 text-info border border-info/20",
  delivered: "bg-success/20 text-success border border-success/20",
  resolved: "bg-positive/20 text-positive border border-positive/20",
  closed: "bg-muted text-muted-foreground border border-border",
  banned: "bg-destructive/20 text-destructive border border-destructive/20",
  finished: "bg-muted text-muted-foreground border border-border",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  waiting: "Aguardando",
  waiting_staff: "Aguardando Equipe",
  delivered: "Entregue",
  resolved: "Resolvido",
  closed: "Encerrado",
  banned: "Banido",
  finished: "Finalizado",
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <Clock className="h-3 w-3" />,
  waiting: <Clock className="h-3 w-3" />,
  waiting_staff: <Clock className="h-3 w-3" />,
  delivered: <CheckCircle className="h-3 w-3" />,
  resolved: <CheckCircle className="h-3 w-3" />,
  closed: <XCircle className="h-3 w-3" />,
  banned: <AlertTriangle className="h-3 w-3" />,
  finished: <XCircle className="h-3 w-3" />,
};

const ITEMS_PER_PAGE = 9;
const ALL_STATUSES = ["all", "open", "waiting", "waiting_staff", "delivered", "resolved", "closed"];

const MeusPedidos = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipo = searchParams.get("tipo") || "produtos";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  const isContas = tipo === "contas";
  const Icon = isContas ? Smartphone : Package;

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchTickets = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("order_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        const regularTickets = data.filter((t: any) => !t.metadata?.type || t.metadata?.type === "robot-project");
        const productIds = [...new Set(regularTickets.map((t: any) => t.product_id))];
        const planIds = [...new Set(regularTickets.map((t: any) => t.product_plan_id))];

        const [productsRes, plansRes] = await Promise.all([
          productIds.length > 0 ? supabase.from("products").select("id, name, image_url").in("id", productIds) : { data: [] },
          planIds.length > 0 ? supabase.from("product_plans").select("id, name, price").in("id", planIds) : { data: [] },
        ]);

        const productMap: Record<string, { name: string; image_url: string | null }> = {};
        const planMap: Record<string, { name: string; price: number }> = {};
        productsRes.data?.forEach((p: any) => { productMap[p.id] = { name: p.name, image_url: p.image_url }; });
        plansRes.data?.forEach((p: any) => { planMap[p.id] = { name: p.name, price: p.price }; });

        setTickets(data.map((t: any) => {
          const isLzt = t.metadata?.type === "lzt-account";
          const isRobot = t.metadata?.type === "robot-project";
          if (isLzt) {
            const lztGameLabels: Record<string, string> = {
              valorant: "Conta Valorant", lol: "Conta LoL", fortnite: "Conta Fortnite", minecraft: "Conta Minecraft",
            };
            const lztGameLabel = lztGameLabels[t.metadata?.game] || "Conta LZT";
            return {
              ...t,
              product_name: t.metadata.account_name || t.metadata.title || lztGameLabel,
              plan_name: lztGameLabel,
              image_url: t.metadata.account_image || null,
              plan_price: t.metadata.price_paid || t.metadata.sell_price || 0,
            };
          }
          const duration = isRobot && t.metadata?.duration ? ` (${t.metadata.duration} dias)` : "";
          return {
            ...t,
            product_name: productMap[t.product_id]?.name || (isRobot ? t.metadata?.game_name || "Produto Robot" : "Produto"),
            plan_name: (planMap[t.product_plan_id]?.name || "Plano") + duration,
            image_url: productMap[t.product_id]?.image_url || null,
            plan_price: planMap[t.product_plan_id]?.price || 0,
          };
        }));
      }
      setLoading(false);
    };
    fetchTickets();
  }, [user]);

  const byType = useMemo(() =>
    isContas ? tickets.filter(t => t.metadata?.type === "lzt-account") : tickets.filter(t => !t.metadata?.type || t.metadata?.type === "robot-project"),
    [tickets, isContas]
  );

  const filtered = useMemo(() => {
    let result = byType;
    if (statusFilter !== "all") result = result.filter(t => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.product_name || "").toLowerCase().includes(q) ||
        (t.plan_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [byType, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, tipo, statusFilter]);

  // Stats
  const delivered = byType.filter(t => t.status === "delivered").length;
  const pending = byType.filter(t => t.status === "open").length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-16">
          <Loader2 className="h-8 w-8 animate-spin text-success" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-6 pt-4 pb-20">

        {/* Back */}
        <button
          onClick={() => navigate("/dashboard?tab=purchases")}
          className="mb-8 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isContas ? "border-info/20 bg-info/10" : "border-success/20 bg-success/10"}`}>
              {isContas ? (
                <svg fill="currentColor" height="28" width="28" className="text-info" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" className="text-success" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M15.528 2.973a.75.75 0 0 1 .472.696v8.662a.75.75 0 0 1-.472.696l-7.25 2.9a.75.75 0 0 1-.557 0l-7.25-2.9A.75.75 0 0 1 0 12.331V3.669a.75.75 0 0 1 .471-.696L7.443.184l.004-.001.274-.11a.75.75 0 0 1 .558 0l.274.11.004.001zm-1.374.527L8 5.962 1.846 3.5 1 3.839v.4l6.5 2.6v7.922l.5.2.5-.2V6.84l6.5-2.6v-.4l-.846-.339Z"/>
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
                {isContas ? "MINHAS CONTAS" : "MEUS PRODUTOS"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {byType.length} {isContas ? "conta(s) adquirida(s)" : "produto(s) adquirido(s)"}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pedido..."
              className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-success/40"
            />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-foreground">{byType.length}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
              <CheckCircle className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entregues</p>
              <p className="text-lg font-bold text-foreground">{delivered}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em aberto</p>
              <p className="text-lg font-bold text-foreground">{pending}</p>
            </div>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
          {ALL_STATUSES.map((s) => {
            const count = s === "all" ? byType.length : byType.filter(t => t.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  statusFilter === s
                    ? "bg-success/15 text-success border border-success/30"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
                }`}
              >
                {s === "all" ? <Filter className="h-3 w-3" /> : statusIcons[s]}
                {s === "all" ? "Todos" : statusLabels[s]}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === s ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card">
              <Icon className="h-9 w-9 text-muted-foreground/30" />
            </div>
            <p className="mt-5 text-base font-semibold text-foreground">
              {search ? "Nenhum resultado encontrado" : statusFilter !== "all" ? "Nenhum pedido com esse status" : isContas ? "Nenhuma conta encontrada" : "Nenhum produto encontrado"}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {search ? "Tente uma busca diferente." : statusFilter !== "all" ? "Tente outro filtro." : "Suas compras aparecerão aqui."}
            </p>
            {!search && statusFilter === "all" && (
              <button
                onClick={() => navigate(isContas ? "/contas" : "/produtos")}
                className="mt-6 rounded-xl bg-success px-6 py-3 text-sm font-bold uppercase tracking-wider text-success-foreground hover:shadow-[0_0_20px_hsl(var(--success)/0.3)] transition-all"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                {isContas ? "VER CONTAS" : "VER PRODUTOS"}
              </button>
            )}
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginated.map((ticket, idx) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => navigate(`/pedido/${ticket.id}`)}
                  className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-success/40 hover:shadow-[0_0_30px_hsl(var(--success)/0.08)]"
                >
                  {/* Image */}
                  <div className="relative h-48 w-full overflow-hidden bg-secondary">
                    {ticket.image_url ? (
                      <img
                        src={ticket.image_url}
                        alt={ticket.product_name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Icon className="h-12 w-12 text-muted-foreground/15" />
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

                    {/* Status badge */}
                    <span className={`absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusColors[ticket.status] || statusColors.open}`}>
                      {statusIcons[ticket.status]}
                      {statusLabels[ticket.status] || ticket.status_label}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate">{ticket.product_name}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{ticket.plan_name}</p>
                      </div>
                      {ticket.plan_price ? (
                        <span className="shrink-0 text-sm font-bold text-success">
                          R$ {Number(ticket.plan_price).toFixed(2).replace(".", ",")}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-success group-hover:underline">
                        Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-success/40 hover:text-success disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      p === safePage
                        ? "bg-success text-success-foreground shadow-[0_0_16px_hsl(var(--success)/0.3)]"
                        : "border border-border bg-card text-muted-foreground hover:border-success/40 hover:text-success"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-success/40 hover:text-success disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MeusPedidos;
