import { useState, useEffect, useRef } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { AdminLztSale as LztSale } from "@/lib/adminLztFetch";
import { useAdminLztBundle, useAdminLztPriceOverrides } from "@/hooks/useAdminData";
import { Loader2, DollarSign, TrendingUp, Settings, Save, ShoppingCart, RefreshCw, Copy, ExternalLink, ChevronLeft, ChevronRight, Search, Gamepad2, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LztConfig {
  id: string;
  markup_multiplier: number;
  max_fetch_price: number;
  currency: string;
  markup_valorant: number;
  markup_lol: number;
  markup_fortnite: number;
  markup_minecraft: number;
}

const SALES_PER_PAGE = 15;
const DEFAULT_CONFIG: LztConfig = {
  id: "",
  markup_multiplier: 3,
  max_fetch_price: 500,
  currency: "rub",
  markup_valorant: 3,
  markup_lol: 3,
  markup_fortnite: 3,
  markup_minecraft: 3,
};

function multiplierToMarginPercent(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return 0;
  return (multiplier - 1) * 100;
}

function marginPercentToMultiplier(marginPercent: number): number {
  if (!Number.isFinite(marginPercent)) return 1;
  return 1 + marginPercent / 100;
}

function mapLztConfigRow(row: Tables<"lzt_config"> | null | undefined): Partial<LztConfig> | null {
  if (!row) return null;
  const mult = row.markup_multiplier ?? 3;
  return {
    id: row.id,
    markup_multiplier: Number(row.markup_multiplier ?? mult),
    max_fetch_price: Number(row.max_fetch_price ?? 500),
    currency: row.currency || "rub",
    markup_valorant: Number(row.markup_valorant ?? mult),
    markup_lol: Number(row.markup_lol ?? mult),
    markup_fortnite: Number(row.markup_fortnite ?? mult),
    markup_minecraft: Number(row.markup_minecraft ?? mult),
  };
}

const gameMarkupFields = [
  { key: "markup_valorant" as const, label: "Valorant", color: "text-destructive" },
  { key: "markup_lol" as const, label: "League of Legends", color: "text-warning" },
  { key: "markup_fortnite" as const, label: "Fortnite", color: "text-info" },
  { key: "markup_minecraft" as const, label: "Minecraft", color: "text-positive" },
];

const LztTab = () => {
  const {
    data: lztBundle,
    dataUpdatedAt: lztBundleUpdatedAt,
    isPending: loading,
    isError: lztBundleError,
    error: lztBundleFetchError,
    refetch: refetchLzt,
  } = useAdminLztBundle();
  const { data: overrides = [], refetch: refetchOverrides } = useAdminLztPriceOverrides();
  const allSales = lztBundle?.sales ?? [];
  const dbStats = lztBundle?.dbStats ?? null;

  const [saving, setSaving] = useState(false);
  /** Evita `applyConfig` em refetch da query apagar edições em curso no formulário. */
  const lztConfigFormDirtyRef = useRef(false);
  /** Já aplicámos pelo menos uma vez dados do servidor no form (para não bloquear a primeira hidratação). */
  const lztConfigHydratedFromServerRef = useRef(false);
  const [config, setConfig] = useState<LztConfig | null>(null);
  const [maxPrice, setMaxPrice] = useState("500");
  const [activeView, setActiveView] = useState<"config" | "sales" | "price">("config");
  const [salesPage, setSalesPage] = useState(0);
  const [salesSearch, setSalesSearch] = useState("");

  // Override price state
  const [priceItemId, setPriceItemId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [changingPrice, setChangingPrice] = useState(false);
  const applyConfig = (partial?: Partial<LztConfig> | null) => {
    const resolved: LztConfig = {
      ...DEFAULT_CONFIG,
      ...(partial || {}),
      id: partial?.id || "",
    };

    lztConfigFormDirtyRef.current = false;
    lztConfigHydratedFromServerRef.current = partial != null;
    setConfig(resolved);
    setMaxPrice(String(resolved.max_fetch_price));
    setMarkups({
      markup_valorant: multiplierToMarginPercent(resolved.markup_valorant ?? resolved.markup_multiplier).toFixed(1),
      markup_lol: multiplierToMarginPercent(resolved.markup_lol ?? resolved.markup_multiplier).toFixed(1),
      markup_fortnite: multiplierToMarginPercent(resolved.markup_fortnite ?? resolved.markup_multiplier).toFixed(1),
      markup_minecraft: multiplierToMarginPercent(resolved.markup_minecraft ?? resolved.markup_multiplier).toFixed(1),
    });
  };

  // Per-game markup state
  const [markups, setMarkups] = useState({
    markup_valorant: multiplierToMarginPercent(DEFAULT_CONFIG.markup_valorant).toFixed(1),
    markup_lol: multiplierToMarginPercent(DEFAULT_CONFIG.markup_lol).toFixed(1),
    markup_fortnite: multiplierToMarginPercent(DEFAULT_CONFIG.markup_fortnite).toFixed(1),
    markup_minecraft: multiplierToMarginPercent(DEFAULT_CONFIG.markup_minecraft).toFixed(1),
  });

  const totalBought = dbStats ? Number(dbStats.total_bought) : 0;
  const totalSold = dbStats ? Number(dbStats.total_sold) : 0;
  const totalProfit = dbStats ? Number(dbStats.total_profit) : 0;
  const boughtDisplay = Number.isFinite(totalBought) ? totalBought : 0;
  const soldDisplay = Number.isFinite(totalSold) ? totalSold : 0;
  const profitDisplay = Number.isFinite(totalProfit) ? totalProfit : 0;
  const totalSalesCount = dbStats ? Number(dbStats.total_count) : allSales.length;

  useEffect(() => {
    if (!lztBundleError) return;
    const msg = lztBundleFetchError instanceof Error ? lztBundleFetchError.message : "Tente novamente.";
    toast({ title: "Erro ao carregar dados LZT", description: msg, variant: "destructive" });
    applyConfig(null);
  }, [lztBundleError, lztBundleFetchError]);

  useEffect(() => {
    if (lztBundleError || !lztBundle) return;
    if (lztConfigFormDirtyRef.current && lztConfigHydratedFromServerRef.current) return;
    applyConfig(mapLztConfigRow(lztBundle.configRow));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate form when React Query finishes a successful fetch
  }, [lztBundleUpdatedAt, lztBundleError]);

  const handleSaveConfig = async () => {
    if (!config) return;
    const p = parseFloat(maxPrice);
    if (isNaN(p) || p <= 0) { toast({ title: "Preço máximo inválido", variant: "destructive" }); return; }

    const parsedMarkups: Record<string, number> = {};
    for (const field of gameMarkupFields) {
      const marginPercent = parseFloat(markups[field.key]);
      if (isNaN(marginPercent) || marginPercent < 0) {
        toast({ title: `Margem ${field.label} inválida (mínimo 0%)`, variant: "destructive" });
        return;
      }
      parsedMarkups[field.key] = marginPercentToMultiplier(marginPercent);
    }

    // Preserva `markup_multiplier` da linha atual (fallback em código legado); não sobrescrever com média dos jogos.
    const preserveGlobal =
      typeof config.markup_multiplier === "number" &&
      Number.isFinite(config.markup_multiplier) &&
      config.markup_multiplier >= 1
        ? config.markup_multiplier
        : Math.max(...Object.values(parsedMarkups));

    setSaving(true);
    const payload = {
      markup_multiplier: preserveGlobal,
      max_fetch_price: p,
      currency: config.currency,
      ...parsedMarkups,
    };

    let error: PostgrestError | null = null;
    let savedRow: Tables<"lzt_config"> | null = null;

    if (config.id) {
      const result = await supabase
        .from("lzt_config")
        .update(payload)
        .eq("id", config.id)
        .select("*")
        .single();
      error = result.error;
      savedRow = result.data;
    } else {
      const result = await supabase
        .from("lzt_config")
        .insert(payload)
        .select("*")
        .single();
      error = result.error;
      savedRow = result.data;
    }

    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Configurações salvas!" });
      applyConfig(mapLztConfigRow(savedRow));
      void refetchLzt();
    }
    setSaving(false);
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copiado!" }),
      () => toast({ title: "Não foi possível copiar", description: "Permissão do navegador ou contexto inseguro.", variant: "destructive" }),
    );
  };

  const filteredSales = allSales.filter((sale) => {
    if (!salesSearch.trim()) return true;
    const q = salesSearch.toLowerCase();
    const id = (sale.lzt_item_id || "").toLowerCase();
    return id.includes(q) || (sale.title || "").toLowerCase().includes(q) || (sale.game || "").toLowerCase().includes(q) || (sale.buyer_user_id || "").toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / SALES_PER_PAGE));
  const paginatedSales = filteredSales.slice(salesPage * SALES_PER_PAGE, (salesPage + 1) * SALES_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setSalesPage(0); }, [salesSearch]);

  /** Evita página inexistente quando o filtro reduz `filteredSales` (ex.: estava na p.5 e a busca esvazia páginas). */
  useEffect(() => {
    setSalesPage((p) => Math.min(Math.max(0, p), Math.max(0, totalPages - 1)));
  }, [totalPages]);

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<DollarSign className="h-5 w-5 text-success" />} label="Gasto Total (Compra)" value={`R$ ${boughtDisplay.toFixed(2)}`} />
        <StatCard icon={<ShoppingCart className="h-5 w-5 text-success" />} label="Receita (Venda)" value={`R$ ${soldDisplay.toFixed(2)}`} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-success" />} label="Lucro Total" value={`R$ ${profitDisplay.toFixed(2)}`} highlight />
        <StatCard icon={<ShoppingCart className="h-5 w-5 text-muted-foreground" />} label="Total Vendas" value={String(totalSalesCount)} />
      </div>

      {/* View Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveView("config")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${activeView === "config" ? "bg-success/20 text-success border border-success/30" : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground"}`}>
          <Settings className="h-4 w-4" /> Configurações
        </button>
        <button onClick={() => setActiveView("price")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${activeView === "price" ? "bg-success/20 text-success border border-success/30" : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground"}`}>
          <Tag className="h-4 w-4" /> Alterar Preço
        </button>
        <button onClick={() => { setActiveView("sales"); setSalesPage(0); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${activeView === "sales" ? "bg-success/20 text-success border border-success/30" : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground"}`}>
          <ShoppingCart className="h-4 w-4" /> Todas as Vendas ({allSales.length})
        </button>
      </div>

      {activeView === "config" && (
        <>
          {/* Per-Game Markup */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-success" /> Margem de Lucro por Categoria
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Defina a margem de lucro (%) sobre o custo em R$ (após conversão RUB/USD). O preço final na loja ainda passa por piso/teto por conteúdo na edge <code className="text-[10px]">lzt-market</code>.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {gameMarkupFields.map((field) => {
                const parsed = parseFloat(markups[field.key]);
                const previewMarginPercent = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
                const previewMult = marginPercentToMultiplier(previewMarginPercent);
                const ex10 = 10 * previewMult;
                const ex50 = 50 * previewMult;
                return (
                  <div key={field.key} className="rounded-lg border border-border bg-secondary/30 p-4">
                    <label className={`text-xs font-bold ${field.color}`}>{field.label}</label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={markups[field.key]}
                        onChange={(e) => {
                          lztConfigFormDirtyRef.current = true;
                          setMarkups((prev) => ({ ...prev, [field.key]: e.target.value }));
                        }}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-success/50"
                      />
                      <span className="text-sm font-bold text-muted-foreground">%</span>
                    </div>
                    <div className="mt-2 flex justify-between gap-1 text-[10px] text-muted-foreground">
                      <span>
                        R$10 →{" "}
                        <span className={field.color}>
                          R${ex10.toFixed(0)}
                        </span>
                      </span>
                      <span>
                        R$50 →{" "}
                        <span className={field.color}>
                          R${ex50.toFixed(0)}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Max Price + Save */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-success" /> Configurações Gerais
            </h3>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Preço máximo (limite de busca LZT)</label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground">R$</span>
                  <input type="number" step="10" min="1" value={maxPrice} onChange={(e) => { lztConfigFormDirtyRef.current = true; setMaxPrice(e.target.value); }}
                    className="w-32 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50" />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground max-w-md">
                  Em R$ ao cliente: usado para montar o <strong className="text-foreground/90">pmax</strong> na API LZT quando o visitante não escolhe filtro de preço — evita puxar anúncios caríssimos.{" "}
                  <strong className="text-foreground/90">Não</strong> força todos os preços do site para este valor; o valor de cada conta continua a ser margem + piso/teto por conteúdo.
                </p>
              </div>
              <button onClick={handleSaveConfig} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Tudo
              </button>
            </div>
          </div>

          {/* Last 5 Sales */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-success" /> Últimas 5 Vendas
              </h3>
              <button type="button" onClick={() => void refetchLzt()} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {allSales.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
              ) : allSales.slice(0, 5).map((sale) => (
                <SaleRow key={sale.id} sale={sale} onCopy={copyToClipboard} />
              ))}
            </div>
            {allSales.length > 5 && (
              <button onClick={() => { setActiveView("sales"); setSalesPage(0); }}
                className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-success/30">
                Ver todas as {allSales.length} vendas →
              </button>
            )}
          </div>
        </>
      )}

      {activeView === "price" && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Tag className="h-4 w-4 text-success" /> Definir Preço de Venda no Site
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Defina um preço personalizado em R$ (BRL) para uma conta específica no seu site. Esse valor substitui o cálculo automático de markup.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">ID da Conta (LZT)</label>
              <input
                type="text"
                placeholder="Ex: 12345678"
                value={priceItemId}
                onChange={(e) => setPriceItemId(e.target.value)}
                className="mt-1 w-48 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Preço de Venda (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 49.90"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="mt-1 w-36 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50"
              />
            </div>
            <button
              onClick={async () => {
                const trimmedItemId = priceItemId.trim();
                if (!trimmedItemId || !newPrice.trim()) {
                  toast({ title: "Preencha o ID e o preço", variant: "destructive" });
                  return;
                }
                const p = parseFloat(newPrice);
                if (isNaN(p) || p <= 0) {
                  toast({ title: "Preço inválido", variant: "destructive" });
                  return;
                }
                setChangingPrice(true);
                try {
                  const { data: existingRows, error: selectError } = await supabase
                    .from("lzt_price_overrides")
                    .select("lzt_item_id")
                    .eq("lzt_item_id", trimmedItemId);

                  if (selectError) throw selectError;

                  const saveResult = existingRows && existingRows.length > 0
                    ? await supabase
                        .from("lzt_price_overrides")
                        .update({ custom_price_brl: p, updated_at: new Date().toISOString() })
                        .eq("lzt_item_id", trimmedItemId)
                    : await supabase
                        .from("lzt_price_overrides")
                        .insert({ lzt_item_id: trimmedItemId, custom_price_brl: p });

                  if (saveResult.error) throw saveResult.error;
                  toast({ title: "Preço definido!", description: `Conta #${trimmedItemId} → R$ ${p.toFixed(2)}` });
                  setPriceItemId("");
                  setNewPrice("");
                  void refetchOverrides();
                } catch (err: unknown) {
                  toast({
                    title: "Erro ao salvar",
                    description: err instanceof Error ? err.message : "Falha desconhecida",
                    variant: "destructive",
                  });
                }
                setChangingPrice(false);
              }}
              disabled={changingPrice}
              className="flex items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-50"
            >
              {changingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              Salvar Preço
            </button>
          </div>

          {overrides.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Preços Personalizados Ativos</h4>
              <div className="space-y-1.5">
                {overrides.map((o) => (
                  <div key={o.lzt_item_id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-2">
                    <span className="text-sm font-mono text-foreground">#{o.lzt_item_id}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-success">
                        R$ {(Number.isFinite(Number(o.custom_price_brl)) ? Number(o.custom_price_brl) : 0).toFixed(2)}
                      </span>
                      <button
                        onClick={async () => {
                          const { error } = await supabase.from("lzt_price_overrides").delete().eq("lzt_item_id", o.lzt_item_id);
                          if (error) { toast({ title: "Erro ao remover", description: error.message, variant: "destructive" }); return; }
                          toast({ title: "Override removido", description: `Conta #${o.lzt_item_id} voltou ao preço automático.` });
                          void refetchOverrides();
                        }}
                        className="text-xs text-destructive hover:text-destructive/80"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}



      {activeView === "sales" && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-success" /> Todas as Vendas ({filteredSales.length})
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" placeholder="Buscar por ID, título ou comprador..."
                  value={salesSearch} onChange={(e) => { setSalesSearch(e.target.value); setSalesPage(0); }}
                  className="w-full sm:w-72 rounded-lg border border-border bg-secondary/50 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
              </div>
              <button type="button" onClick={() => void refetchLzt()} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-xs font-semibold text-muted-foreground">ID LZT</th>
                  <th className="pb-3 text-xs font-semibold text-muted-foreground">Título</th>
                  <th className="pb-3 text-xs font-semibold text-muted-foreground">Jogo</th>
                  <th className="pb-3 text-xs font-semibold text-muted-foreground">Compra</th>
                  <th className="pb-3 text-xs font-semibold text-muted-foreground">Venda</th>
                  <th className="pb-3 text-xs font-semibold text-muted-foreground">Lucro</th>
                  <th className="pb-3 text-xs font-semibold text-muted-foreground">Comprador</th>
                  <th className="pb-3 text-xs font-semibold text-muted-foreground">Data</th>
                  <th className="pb-3 text-xs font-semibold text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedSales.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    {salesSearch ? "Nenhuma venda encontrada." : "Nenhuma venda registrada ainda."}
                  </td></tr>
                ) : paginatedSales.map((sale) => (
                  <tr key={sale.id} className="group hover:bg-secondary/20">
                    <td className="py-3 pr-3">
                      <button onClick={() => copyToClipboard(sale.lzt_item_id)}
                        className="flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-success" title="Copiar ID">
                        #{sale.lzt_item_id}
                        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                      </button>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-sm text-foreground truncate block max-w-[200px]">{sale.title || "—"}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-xs text-muted-foreground capitalize">{sale.game || "—"}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-xs font-bold text-destructive">R${Number(sale.buy_price).toFixed(2)}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-xs font-bold text-foreground">R${Number(sale.sell_price).toFixed(2)}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`text-xs font-bold ${Number(sale.profit) >= 0 ? "text-success" : "text-destructive"}`}>
                        {Number(sale.profit) >= 0 ? "+" : ""}R${Number(sale.profit).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      {sale.buyer_user_id ? (
                        <button onClick={() => copyToClipboard(sale.buyer_user_id!)}
                          className="font-mono text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1" title="Copiar ID">
                          {sale.buyer_user_id.slice(0, 8)}...
                          <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                        </button>
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(sale.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                        {" "}
                        {new Date(sale.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-3">
                      <a href={`https://lzt.market/${sale.lzt_item_id}`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-success" title="Abrir no LZT Market">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Página {salesPage + 1} de {totalPages} · {filteredSales.length} vendas</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setSalesPage(p => Math.max(0, p - 1))} disabled={salesPage === 0}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) page = i;
                  else if (salesPage < 3) page = i;
                  else if (salesPage > totalPages - 4) page = totalPages - 5 + i;
                  else page = salesPage - 2 + i;
                  return (
                    <button key={page} onClick={() => setSalesPage(page)}
                      className={`h-7 w-7 rounded-lg text-xs font-medium ${page === salesPage ? "bg-success/20 text-success border border-success/30" : "text-muted-foreground hover:text-foreground"}`}>
                      {page + 1}
                    </button>
                  );
                })}
                <button onClick={() => setSalesPage(p => Math.min(totalPages - 1, p + 1))} disabled={salesPage === totalPages - 1}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SaleRow = ({ sale, onCopy }: { sale: LztSale; onCopy: (t: string) => void }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 group">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground truncate">
        {sale.title || `Conta #${sale.lzt_item_id}`}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        <button onClick={() => onCopy(sale.lzt_item_id)}
          className="text-xs text-muted-foreground hover:text-success flex items-center gap-1 font-mono">
          LZT #{sale.lzt_item_id}
          <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60" />
        </button>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-xs text-muted-foreground">
          {new Date(sale.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Compra: <span className="text-destructive font-bold">R${Number(sale.buy_price).toFixed(2)}</span></span>
        <span className="text-muted-foreground">→</span>
        <span className="text-muted-foreground">Venda: <span className="text-foreground font-bold">R${Number(sale.sell_price).toFixed(2)}</span></span>
      </div>
      <span className={`text-xs font-bold ${Number(sale.profit) >= 0 ? "text-success" : "text-destructive"}`}>
        {Number(sale.profit) >= 0 ? "+" : ""}R${Number(sale.profit).toFixed(2)}
      </span>
    </div>
  </div>
);

const StatCard = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-lg border p-5 ${highlight ? "border-success/30 bg-success/5" : "border-border bg-card"}`}>
    <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-muted-foreground">{label}</span></div>
    <p className={`text-2xl font-bold ${highlight ? "text-success" : "text-foreground"}`}>{value}</p>
  </div>
);

export default LztTab;
