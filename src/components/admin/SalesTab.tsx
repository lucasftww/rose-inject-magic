import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { registerCacheInvalidator } from "@/lib/adminCache";
import { asOrderTicketMetadata, type OrderTicketMetadata } from "@/types/orderTicketMetadata";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  Loader2, Search, ShoppingBag, Package, DollarSign, Users,
  ChevronLeft, ChevronRight, Eye, Copy, Check, Clock, Globe,
  Bot, RefreshCw, User, ExternalLink
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type OrderTicketRow = Database["public"]["Tables"]["order_tickets"]["Row"];

interface SaleTicket extends Omit<OrderTicketRow, "metadata"> {
  metadata: OrderTicketMetadata | null;
  product_name?: string;
  product_image?: string | null;
  plan_name?: string;
  plan_price?: number;
  username?: string | null;
  email?: string | null;
  stock_content?: string | null;
}

const ITEMS_PER_PAGE = 20;

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

const statusLabels: Record<string, string> = {
  delivered: "Entregue",
  open: "Aberto",
  waiting: "Aguardando",
  waiting_staff: "Ag. Equipe",
  closed: "Encerrado",
  resolved: "Resolvido",
  archived: "Arquivado",
  banned: "Banido",
  finished: "Finalizado",
};

let _cachedSales: SaleTicket[] | null = null;
let _salesCacheTs = 0;
const SALES_CACHE_TTL = 3 * 60 * 1000;

/** Allow external invalidation (e.g. from admin cache clear) */
export function invalidateSalesCache() {
  _cachedSales = null;
  _salesCacheTs = 0;
}
registerCacheInvalidator(invalidateSalesCache);

const SALES_MAX_ROWS = 2000; // cap to avoid loading huge datasets

/** Get purchase type label */
const getPurchaseType = (meta: OrderTicketMetadata | null | undefined): { label: string; icon: typeof Package; color: string } => {
  if (meta?.type === "lzt-account") return { label: "Conta LZT", icon: Globe, color: "text-info" };
  if (meta?.type === "robot-project") return { label: "Robot", icon: Bot, color: "text-accent-foreground" };
  return { label: "Estoque", icon: Package, color: "text-success" };
};

const SalesTab = ({ onGoToTicket }: { onGoToTicket?: (ticketId: string) => void }) => {
  const { emailMap: adminEmailMap, usernameMap } = useAdminUsers();
  const [loading, setLoading] = useState(!_cachedSales);
  const [tickets, setTickets] = useState<SaleTicket[]>(_cachedSales || []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(!!_cachedSales);

  const fetchSales = async (force = false) => {
    if (!force && _cachedSales && Date.now() - _salesCacheTs < SALES_CACHE_TTL) {
      setTickets(_cachedSales);
      setDataLoaded(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    let rawTickets: OrderTicketRow[];
    try {
      rawTickets = await fetchAllRows<OrderTicketRow>("order_tickets", {
        select: "*",
        order: { column: "created_at", ascending: false },
        limit: SALES_MAX_ROWS,
      });
    } catch (err) {
      console.error("fetchSales order_tickets error:", err);
      toast({
        title: "Erro ao carregar vendas",
        description: err instanceof Error ? err.message : "Tente atualizar a página.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const productIds = [...new Set(rawTickets.map((t) => t.product_id))];
    const planIds = [...new Set(rawTickets.map((t) => t.product_plan_id))];

    const lztItemIds = rawTickets
      .filter((t) => {
        const m = asOrderTicketMetadata(t.metadata);
        return m.type === "lzt-account" && m.lzt_item_id != null;
      })
      .map((t) => String(asOrderTicketMetadata(t.metadata).lzt_item_id));

    // Chunk large .in() queries to avoid Supabase 1000-row response limit
    const CHUNK = 500;
    type PublicTable = keyof Database["public"]["Tables"];
    const fetchInChunks = async <T extends PublicTable>(
      table: T,
      select: string,
      column: string,
      ids: string[],
    ): Promise<Tables<T>[]> => {
      if (ids.length === 0) return [];
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
      const results = await Promise.all(chunks.map(chunk =>
        (supabase.from(table as any).select(select) as any).in(column, chunk).then((r: any) => (r.data ?? []) as Tables<T>[])
      ));
      return results.flat();
    };

    const [productsData, plansData, lztSalesRaw] = await Promise.all([
      fetchInChunks("products", "id, name, image_url", "id", productIds),
      fetchInChunks("product_plans", "id, name, price", "id", planIds),
      lztItemIds.length > 0
        ? fetchInChunks("lzt_sales", "lzt_item_id, sell_price", "lzt_item_id", lztItemIds)
        : Promise.resolve([] as Tables<"lzt_sales">[]),
    ]);

    const productsMap = new Map(productsData.map((p) => [p.id, p]));
    const plansMap = new Map(plansData.map((p) => [p.id, p]));
    const lztSalesMap = new Map(
      (lztSalesRaw || [])
        .filter((s): s is Tables<"lzt_sales"> & { lzt_item_id: string } => typeof s.lzt_item_id === "string" && s.lzt_item_id.length > 0)
        .map((s) => [s.lzt_item_id, Number(s.sell_price)]),
    );

    const stockIds = rawTickets.flatMap((t) => (t.stock_item_id ? [t.stock_item_id] : []));
    const stockMap = new Map<string, string>();
    if (stockIds.length > 0) {
      try {
        const CHUNK_SIZE = 200;
        const chunks: string[][] = [];
        for (let i = 0; i < stockIds.length; i += CHUNK_SIZE) {
          chunks.push(stockIds.slice(i, i + CHUNK_SIZE));
        }
        const results = await Promise.all(chunks.map(chunk =>
          fetchAllRows<{ id: string; content: string | null }>("stock_items", {
            select: "id, content",
            filters: [{ column: "id", op: "in", value: chunk }],
          })
        ));
        results.flat().forEach((s) => {
          if (s.content != null) stockMap.set(s.id, s.content);
        });
      } catch (err) {
        console.error("fetchSales stock_items error:", err);
        toast({
          title: "Conteúdo de alguns pedidos não carregou",
          description: err instanceof Error ? err.message : "Dados de estoque indisponíveis; tente atualizar.",
          variant: "destructive",
        });
      }
    }

    const enriched: SaleTicket[] = rawTickets.map((t) => {
      const product = productsMap.get(t.product_id);
      const plan = plansMap.get(t.product_plan_id);
      const meta = asOrderTicketMetadata(t.metadata);
      const isLzt = meta?.type === "lzt-account";
      const lztItemId = meta?.lzt_item_id;
      const lztPrice = lztItemId ? (lztSalesMap.get(String(lztItemId)) || meta?.price_paid || meta?.price || meta?.sell_price || 0) : 0;
      const metaPrice = meta?.price_paid || meta?.plan_price;

      return {
        ...t,
        metadata: meta,
        product_name: isLzt ? (meta?.title || meta?.account_name || "Conta LZT") : (product?.name || "—"),
        product_image: isLzt ? null : (product?.image_url || null),
        plan_name: isLzt ? "Conta LZT" : (plan?.name || "—"),
        plan_price: isLzt ? lztPrice : (metaPrice ?? plan?.price ?? 0),
        username: null as string | null,
        email: null as string | null,
        stock_content:
          t.stock_item_id && !(meta?.type === "robot-project" && meta?.is_free)
            ? (stockMap.get(t.stock_item_id) || null)
            : null,
      };
    });

    _cachedSales = enriched;
    _salesCacheTs = Date.now();
    setTickets(enriched);
    setDataLoaded(true);
    setLoading(false);
  };

  useEffect(() => { fetchSales(); }, []);

  useEffect(() => {
    if (!dataLoaded || adminEmailMap.size === 0) return;
    setTickets(prev => prev.map(t => ({
      ...t,
      email: adminEmailMap.get(t.user_id) || t.email,
      username: t.username || usernameMap.get(t.user_id) || null,
    })));
  }, [adminEmailMap, usernameMap, dataLoaded]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const delivered = tickets.filter((t) => t.status === "delivered").length;
    const pending = tickets.filter((t) => t.status !== "delivered" && t.status !== "closed" && t.status !== "archived").length;
    const revenue = tickets
      .filter((t) => t.status === "delivered")
      .reduce((sum, t) => sum + (t.plan_price || 0), 0);
    const lztCount = tickets.filter((t) => t.metadata?.type === "lzt-account").length;
    const robotCount = tickets.filter((t) => t.metadata?.type === "robot-project").length;
    return { total, delivered, pending, revenue, lztCount, robotCount };
  }, [tickets]);

  const filtered = useMemo(() => {
    let result = tickets;
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (typeFilter !== "all") {
      if (typeFilter === "lzt") result = result.filter(t => t.metadata?.type === "lzt-account");
      else if (typeFilter === "robot") result = result.filter(t => t.metadata?.type === "robot-project");
      else if (typeFilter === "stock") result = result.filter(t => t.metadata?.type !== "lzt-account" && t.metadata?.type !== "robot-project");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          (t.product_name || "").toLowerCase().includes(q) ||
          (t.username || "").toLowerCase().includes(q) ||
          (t.email || "").toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          (t.metadata?.lzt_item_id && String(t.metadata.lzt_item_id).includes(q))
      );
    }
    return result;
  }, [tickets, statusFilter, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copiado!" });
  };

  const CopyField = ({ label, value, copyKey }: { label: string; value: string; copyKey: string }) => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
      <code className="text-xs text-foreground bg-secondary/50 px-2 py-0.5 rounded flex-1 truncate">{value}</code>
      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(value, copyKey); }} className="text-muted-foreground hover:text-foreground shrink-0">
        {copiedId === copyKey ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-success" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { icon: <ShoppingBag className="h-4 w-4 text-success" />, label: "Total", value: String(stats.total) },
          { icon: <Check className="h-4 w-4 text-success" />, label: "Entregues", value: String(stats.delivered) },
          { icon: <Clock className="h-4 w-4 text-warning" />, label: "Pendentes", value: String(stats.pending) },
          { icon: <DollarSign className="h-4 w-4 text-success" />, label: "Receita", value: `R$ ${stats.revenue.toFixed(0)}` },
          { icon: <Globe className="h-4 w-4 text-info" />, label: "Contas LZT", value: String(stats.lztCount) },
          { icon: <Bot className="h-4 w-4 text-accent-foreground" />, label: "Robot", value: String(stats.robotCount) },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 mb-1">{s.icon}<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span></div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por produto, usuário, email, ID ou LZT item..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {[
            { key: "all", label: "Todos" },
            { key: "delivered", label: "Entregues" },
            { key: "open", label: "Abertos" },
            { key: "waiting_staff", label: "Aguardando" },
            { key: "closed", label: "Encerrados" },
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
        <div className="flex gap-1">
          {[
            { key: "all", label: "Tudo" },
            { key: "stock", label: "Estoque" },
            { key: "lzt", label: "LZT" },
            { key: "robot", label: "Robot" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`rounded-lg px-2.5 py-2 text-xs font-medium whitespace-nowrap ${
                typeFilter === f.key
                  ? "bg-foreground/10 text-foreground border border-foreground/20"
                  : "bg-secondary/30 text-muted-foreground/60 border border-transparent hover:text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => fetchSales(true)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground" title="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} vendas encontradas</p>

      {/* Sales Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Produto</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Plano</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Comprador</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Data</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-10">⋯</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                paginated.map((sale) => {
                  const purchaseType = getPurchaseType(asOrderTicketMetadata(sale.metadata));
                  const TypeIcon = purchaseType.icon;
                  return (
                    <Fragment key={sale.id}>
                      <tr
                        className={`border-b border-border/50 cursor-pointer ${expandedId === sale.id ? "bg-secondary/20" : "hover:bg-secondary/10"}`}
                        onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5" title={purchaseType.label}>
                            <TypeIcon className={`h-3.5 w-3.5 ${purchaseType.color}`} />
                            <span className="text-[10px] font-medium text-muted-foreground hidden lg:inline">{purchaseType.label}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {sale.product_image ? (
                              <img src={sale.product_image} alt="" className="h-7 w-7 rounded-md object-cover border border-border shrink-0" />
                            ) : (
                              <div className="h-7 w-7 rounded-md bg-secondary/50 flex items-center justify-center shrink-0">
                                <TypeIcon className={`h-3.5 w-3.5 ${purchaseType.color}`} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-medium text-foreground text-xs truncate block max-w-[160px]">{sale.product_name}</span>
                              {sale.metadata?.lzt_item_id && (
                                <span className="text-[10px] text-muted-foreground/60 font-mono">#{sale.metadata.lzt_item_id}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{sale.plan_name}</td>
                        <td className="px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-foreground text-xs font-medium truncate max-w-[120px]">{sale.username || sale.email?.split("@")[0] || sale.user_id.slice(0, 8)}</p>
                            {sale.email && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{sale.email}</p>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-foreground text-xs whitespace-nowrap">
                          R$ {(sale.plan_price || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColors[sale.status || ""] || "bg-muted text-muted-foreground border-border"}`}>
                            {statusLabels[sale.status || ""] || sale.status_label || sale.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-[11px] hidden md:table-cell whitespace-nowrap">
                          {new Date(sale.created_at || "").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          <span className="text-muted-foreground/40 ml-1">
                            {new Date(sale.created_at || "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); onGoToTicket?.(sale.id); }}
                            title="Abrir ticket"
                            className="rounded-md p-1 text-muted-foreground hover:text-success hover:bg-success/10"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail */}
                      {expandedId === sale.id && (
                        <tr key={`${sale.id}-detail`} className="bg-secondary/10">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {/* IDs */}
                              <div className="space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Identificação</p>
                                <CopyField label="Pedido" value={sale.id} copyKey={`id-${sale.id}`} />
                                <CopyField label="User ID" value={sale.user_id} copyKey={`uid-${sale.id}`} />
                                {sale.metadata?.lzt_item_id && (
                                  <CopyField label="LZT Item" value={String(sale.metadata.lzt_item_id)} copyKey={`lzt-${sale.id}`} />
                                )}
                              </div>

                              {/* Buyer info */}
                              <div className="space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Comprador</p>
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs text-foreground">{sale.username || "Sem nome"}</span>
                                </div>
                                {sale.email && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground w-20 shrink-0">Email</span>
                                    <span className="text-xs text-foreground truncate">{sale.email}</span>
                                  </div>
                                )}
                              </div>

                              {/* Purchase details */}
                              <div className="space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Detalhes</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-20 shrink-0">Tipo</span>
                                  <span className={`text-xs font-medium ${purchaseType.color}`}>{purchaseType.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-20 shrink-0">Produto</span>
                                  <span className="text-xs text-foreground">{sale.product_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-20 shrink-0">Plano</span>
                                  <span className="text-xs text-foreground">{sale.plan_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-20 shrink-0">Valor</span>
                                  <span className="text-xs text-foreground font-semibold">R$ {(sale.plan_price || 0).toFixed(2)}</span>
                                </div>
                              </div>

                              {/* LZT details */}
                              {sale.metadata?.type === "lzt-account" && (
                                <div className="sm:col-span-2 lg:col-span-3">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Conta LZT</p>
                                  <div className="rounded-lg border border-border bg-card p-3 grid gap-2 sm:grid-cols-3">
                                    <div>
                                      <span className="text-[10px] text-muted-foreground">Item ID</span>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <code className="text-xs font-mono text-foreground">{sale.metadata.lzt_item_id || "—"}</code>
                                        {sale.metadata.lzt_item_id && (
                                          <a href={`https://lzt.market/${sale.metadata.lzt_item_id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-success">
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-muted-foreground">Título</span>
                                      <p className="text-xs text-foreground mt-0.5 truncate">{sale.metadata.title || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-muted-foreground">Game</span>
                                      <p className="text-xs text-foreground mt-0.5">{sale.metadata.game || "—"}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Robot details */}
                              {sale.metadata?.type === "robot-project" && (
                                <div className="sm:col-span-2 lg:col-span-3">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Robot Project</p>
                                  <div className="rounded-lg border border-border bg-card p-3 grid gap-2 sm:grid-cols-2">
                                    <div>
                                      <span className="text-[10px] text-muted-foreground">Game ID</span>
                                      <p className="text-xs text-foreground font-mono mt-0.5">{sale.metadata.robot_game_id || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-muted-foreground">Duração</span>
                                      <p className="text-xs text-foreground mt-0.5">{sale.metadata.duration_days ? `${sale.metadata.duration_days} dias` : "—"}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Stock content */}
                              {sale.stock_content && (() => {
                                let parsed: Record<string, string> | null = null;
                                try { parsed = JSON.parse(sale.stock_content); } catch { /* ignore */ }

                                const fieldLabels: Record<string, string> = {
                                  login: "Login", email: "Email",
                                  senha: "Senha da Conta", senha_email: "Senha do Email", email_senha: "Senha do Email",
                                  emailSenha: "Senha do Email", password: "Senha da Conta",
                                  email_password: "Senha do Email", emailPassword: "Senha do Email",
                                };

                                return (
                                  <div className="sm:col-span-2 lg:col-span-3">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Dados Entregues</p>
                                    <div className="flex items-start gap-2">
                                      <div className="text-xs text-foreground bg-card border border-border px-3 py-2.5 rounded-lg overflow-x-auto max-w-full flex-1 space-y-1">
                                        {parsed && typeof parsed === "object" ? (
                                          Object.entries(parsed).map(([key, val]) => (
                                            <p key={key}>
                                              <span className="text-muted-foreground">{fieldLabels[key] || key}:</span> {String(val)}
                                            </p>
                                          ))
                                        ) : sale.stock_content!.includes(":") ? (
                                          <>
                                            <p><span className="text-muted-foreground">Login:</span> {sale.stock_content!.split(":")[0]}</p>
                                            <p><span className="text-muted-foreground">Senha:</span> {sale.stock_content!.split(":").slice(1).join(":")}</p>
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
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
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
