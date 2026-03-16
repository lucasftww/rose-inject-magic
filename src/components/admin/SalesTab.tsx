import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Loader2, Search, ShoppingBag, Package, DollarSign, Users,
  ChevronLeft, ChevronRight, Eye, Copy, Check, Clock
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SaleTicket {
  id: string;
  product_id: string;
  product_plan_id: string;
  status: string;
  status_label: string;
  created_at: string;
  user_id: string;
  stock_item_id: string | null;
  metadata: any;
  // enriched
  product_name?: string;
  product_image?: string | null;
  plan_name?: string;
  plan_price?: number;
  username?: string;
  email?: string;
  stock_content?: string | null;
}

const ITEMS_PER_PAGE = 15;

const statusColors: Record<string, string> = {
  delivered: "bg-success/15 text-success border-success/30",
  open: "bg-warning/15 text-warning border-warning/30",
  waiting: "bg-info/15 text-info border-info/30",
  waiting_staff: "bg-info/15 text-info border-info/30",
  resolved: "bg-positive/15 text-positive border-positive/30",
  closed: "bg-muted text-muted-foreground border-border",
  banned: "bg-destructive/15 text-destructive border-destructive/30",
  finished: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
};

const SalesTab = ({ onGoToTicket }: { onGoToTicket?: (ticketId: string) => void }) => {
  const { emailMap: adminEmailMap, usernameMap } = useAdminUsers();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SaleTicket[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const fetchSales = async () => {
    setLoading(true);

    // 1. Fetch ALL tickets using paginated helper (no 1000-row limit)
    let rawTickets: any[];
    try {
      rawTickets = await fetchAllRows("order_tickets", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });
    } catch {
      setLoading(false);
      return;
    }

    // 2. Enrich with product/plan data
    const productIds = [...new Set(rawTickets.map((t) => t.product_id))];
    const planIds = [...new Set(rawTickets.map((t) => t.product_plan_id))];

    const [productsRes, plansRes, profilesData, lztSalesData] = await Promise.all([
      supabase.from("products").select("id, name, image_url").in("id", productIds),
      supabase.from("product_plans").select("id, name, price").in("id", planIds),
      fetchAllRows("profiles", { select: "user_id, username" }),
      fetchAllRows("lzt_sales", { select: "lzt_item_id, sell_price" }),
    ]);

    const productsMap = new Map((productsRes.data || []).map((p) => [p.id, p]));
    const plansMap = new Map((plansRes.data || []).map((p) => [p.id, p]));
    const profilesMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
    const lztSalesMap = new Map((lztSalesData || []).map((s: any) => [s.lzt_item_id, Number(s.sell_price)]));

    // 3. Load stock content for delivered items
    const stockIds = rawTickets
      .filter((t) => t.stock_item_id)
      .map((t) => t.stock_item_id as string);

    let stockMap = new Map<string, string>();
    if (stockIds.length > 0) {
      try {
        const stockData = await fetchAllRows("stock_items", {
          select: "id, content",
          filters: stockIds.length <= 100
            ? [{ column: "id", op: "in", value: stockIds }]
            : undefined,
        });
        // If we couldn't filter by ID (too many), filter client-side
        const stockSet = new Set(stockIds);
        (stockData || []).forEach((s: any) => {
          if (!stockIds.length || stockSet.has(s.id)) stockMap.set(s.id, s.content);
        });
      } catch {
        // fallback: do nothing
      }
    }

    // 4. Merge — use plan price as fallback (skip expensive ALL payments fetch)
    const enriched: SaleTicket[] = rawTickets.map((t) => {
      const product = productsMap.get(t.product_id);
      const plan = plansMap.get(t.product_plan_id);
      const profile = profilesMap.get(t.user_id);
      const meta = t.metadata as any;
      const isLzt = meta?.type === "lzt-account";
      const lztItemId = meta?.lzt_item_id;
      const lztPrice = lztItemId ? (lztSalesMap.get(String(lztItemId)) || meta?.price_paid || meta?.price || meta?.sell_price || 0) : 0;

      // Use metadata price if available (saved at purchase time), fallback to plan price
      const metaPrice = meta?.price_paid || meta?.plan_price;

      return {
        ...t,
        product_name: isLzt ? (meta?.title || meta?.account_name || "Conta LZT") : (product?.name || "—"),
        product_image: isLzt ? null : (product?.image_url || null),
        plan_name: isLzt ? "Conta LZT" : (plan?.name || "—"),
        plan_price: isLzt ? lztPrice : (metaPrice ?? plan?.price ?? 0),
        username: profile?.username || null,
        email: null, // enriched below from adminEmailMap
        stock_content: t.stock_item_id ? (stockMap.get(t.stock_item_id) || null) : null,
      };
    });

    setTickets(enriched);
    setDataLoaded(true);
    setLoading(false);
  };

  // Fetch data only once on mount
  useEffect(() => {
    fetchSales();
  }, []);

  // Enrich emails separately when adminEmailMap updates (no refetch)
  useEffect(() => {
    if (!dataLoaded || adminEmailMap.size === 0) return;
    setTickets(prev => prev.map(t => ({
      ...t,
      email: adminEmailMap.get(t.user_id) || t.email,
      username: t.username || usernameMap.get(t.user_id) || null,
    })));
  }, [adminEmailMap, usernameMap, dataLoaded]);

  // Stats
  const stats = useMemo(() => {
    const total = tickets.length;
    const delivered = tickets.filter((t) => t.status === "delivered").length;
    const pending = tickets.filter((t) => t.status !== "delivered" && t.status !== "closed").length;
    const revenue = tickets
      .filter((t) => t.status === "delivered")
      .reduce((sum, t) => sum + (t.plan_price || 0), 0);
    const uniqueBuyers = new Set(tickets.map((t) => t.user_id)).size;
    return { total, delivered, pending, revenue, uniqueBuyers };
  }, [tickets]);

  // Filters
  const filtered = useMemo(() => {
    let result = tickets;
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          (t.product_name || "").toLowerCase().includes(q) ||
          (t.username || "").toLowerCase().includes(q) ||
          (t.email || "").toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tickets, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copiado!" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-success" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { icon: <ShoppingBag className="h-4 w-4 text-success" />, label: "Total Vendas", value: String(stats.total) },
          { icon: <Package className="h-4 w-4 text-success" />, label: "Entregues", value: String(stats.delivered) },
          { icon: <Loader2 className="h-4 w-4 text-warning" />, label: "Pendentes", value: String(stats.pending) },
          { icon: <DollarSign className="h-4 w-4 text-success" />, label: "Receita", value: `R$ ${stats.revenue.toFixed(2)}` },
          { icon: <Users className="h-4 w-4 text-success" />, label: "Compradores", value: String(stats.uniqueBuyers) },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span></div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por produto, usuário, email ou ID..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {[
            { key: "all", label: "Todos" },
            { key: "delivered", label: "Entregues" },
            { key: "open", label: "Abertos" },
            { key: "waiting_staff", label: "Aguardando" },
            { key: "closed", label: "Fechados" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap ${
                statusFilter === f.key
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{filtered.length} vendas encontradas</p>

      {/* Sales Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Produto</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Plano</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Comprador</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                paginated.map((sale) => (
                <Fragment key={sale.id}>
                    <tr
                      className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {sale.product_image ? (
                            <img src={sale.product_image} alt="" className="h-8 w-8 rounded-md object-cover border border-border" />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-secondary/50 flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium text-foreground truncate max-w-[180px]">{sale.product_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{sale.plan_name}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-foreground text-xs font-medium">{sale.username || sale.email || sale.user_id.slice(0, 12) + "..."}</p>
                          {sale.email && <p className="text-[10px] text-muted-foreground">{sale.email}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        R$ {(sale.plan_price || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusColors[sale.status] || "bg-muted text-muted-foreground border-border"}`}>
                          {sale.status === "delivered" ? "Entregue" : sale.status === "open" ? "Aberto" : sale.status === "waiting" ? "Aguardando" : sale.status === "waiting_staff" ? "Aguardando Equipe" : sale.status === "closed" ? "Fechado" : sale.status === "resolved" ? "Resolvido" : sale.status === "archived" ? "Arquivado" : sale.status_label || sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(sale.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); onGoToTicket?.(sale.id); }}
                          title="Abrir ticket no chat"
                          className="rounded-md p-1.5 text-muted-foreground hover:text-success hover:bg-success/10"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedId === sale.id && (
                      <tr key={`${sale.id}-detail`} className="bg-secondary/10">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">ID do Pedido</p>
                              <div className="flex items-center gap-2">
                                <code className="text-xs text-foreground bg-secondary/50 px-2 py-1 rounded">{sale.id.slice(0, 16)}...</code>
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(sale.id, `id-${sale.id}`); }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {copiedId === `id-${sale.id}` ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Comprador</p>
                              <p className="text-xs text-foreground">{sale.username || "Sem nome"}</p>
                              <p className="text-[10px] text-muted-foreground">{sale.email || "—"}</p>
                            </div>

                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">User ID</p>
                              <div className="flex items-center gap-2">
                                <code className="text-xs text-foreground bg-secondary/50 px-2 py-1 rounded">{sale.user_id.slice(0, 16)}...</code>
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(sale.user_id, `uid-${sale.id}`); }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {copiedId === `uid-${sale.id}` ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>

                            {sale.stock_content && (() => {
                              let parsed: Record<string, string> | null = null;
                              try { parsed = JSON.parse(sale.stock_content); } catch {}

                              const fieldLabels: Record<string, string> = {
                                login: "Login",
                                email: "Email",
                                senha: "Senha da Conta",
                                senha_email: "Senha do Email",
                                email_senha: "Senha do Email",
                                emailSenha: "Senha do Email",
                                password: "Senha da Conta",
                                email_password: "Senha do Email",
                                emailPassword: "Senha do Email",
                              };

                              return (
                                <div className="sm:col-span-2 lg:col-span-3">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Dados da Conta Entregue</p>
                                  <div className="flex items-start gap-2">
                                    <div className="text-xs text-foreground bg-secondary/50 px-3 py-2 rounded-lg overflow-x-auto max-w-full flex-1 space-y-1">
                                      {parsed && typeof parsed === "object" ? (
                                        Object.entries(parsed).map(([key, val]) => (
                                          <p key={key}>
                                            <span className="text-muted-foreground">{fieldLabels[key] || key}:</span> {String(val)}
                                          </p>
                                        ))
                                      ) : sale.stock_content.includes(":") ? (
                                        <>
                                          <p><span className="text-muted-foreground">Login:</span> {sale.stock_content.split(":")[0]}</p>
                                          <p><span className="text-muted-foreground">Senha da Conta:</span> {sale.stock_content.split(":").slice(1).join(":")}</p>
                                        </>
                                      ) : (
                                        <pre className="whitespace-pre-wrap break-all">{sale.stock_content}</pre>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(sale.stock_content!, `stock-${sale.id}`); }}
                                      className="mt-1 text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                      {copiedId === `stock-${sale.id}` ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {(sale.metadata as any)?.type === "lzt-account" && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Detalhes LZT</p>
                                <div className="text-xs text-foreground bg-secondary/50 px-3 py-2 rounded-lg">
                                  <p>Item ID: {(sale.metadata as any)?.lzt_item_id || "—"}</p>
                                  <p>Título: {(sale.metadata as any)?.title || "—"}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;
