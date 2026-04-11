import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAdminScratchCardBundle } from "@/hooks/useAdminData";
import { toast } from "@/hooks/use-toast";
import { Pencil, Loader2, Gift, RefreshCw, Save } from "lucide-react";

interface Prize {
  id: string;
  name: string;
  image_url: string | null;
  win_percentage: number;
  prize_value: number;
  active: boolean;
  sort_order: number;
  product_id: string | null;
}

interface Config {
  id: string;
  price: number;
  active: boolean;
}

type ScratchPrizeRow = Tables<"scratch_card_prizes">;
type ScratchConfigRow = Tables<"scratch_card_config">;

function mapScratchPrizeRow(r: ScratchPrizeRow): Prize {
  return {
    id: r.id,
    name: r.name,
    image_url: r.image_url,
    win_percentage: r.win_percentage ?? 0,
    prize_value: r.prize_value ?? 0,
    active: r.active ?? false,
    sort_order: r.sort_order ?? 0,
    product_id: r.product_id,
  };
}

function mapScratchConfigRow(r: ScratchConfigRow): Config {
  return {
    id: r.id,
    price: r.price ?? 2.5,
    active: r.active ?? false,
  };
}

const ScratchCardTab = () => {
  const { data: bundle, isPending: loading, isError, error, refetch: refetchScratch } = useAdminScratchCardBundle();
  const prizes = useMemo(() => (bundle?.prizes ?? []).map(mapScratchPrizeRow), [bundle]);
  const config = useMemo(
    () => (bundle?.config ? mapScratchConfigRow(bundle.config) : null),
    [bundle],
  );
  const [syncing, setSyncing] = useState(false);
  const [savingPct, setSavingPct] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPct, setEditPct] = useState("");
  const [editActive, setEditActive] = useState(true);

  const [configPrice, setConfigPrice] = useState("2.50");
  const [configActive, setConfigActive] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const totalPlays = bundle?.stats?.total_plays ?? 0;
  const totalWins = bundle?.stats?.total_wins ?? 0;
  const totalRevenue = bundle?.stats?.total_revenue ?? 0;

  useEffect(() => {
    if (!config) return;
    setConfigPrice(String(config.price));
    setConfigActive(config.active);
  }, [config]);

  useEffect(() => {
    if (!isError) return;
    toast({
      title: "Erro ao carregar raspadinha",
      description: error instanceof Error ? error.message : "Tente novamente.",
      variant: "destructive",
    });
  }, [isError, error]);

  const handleSyncProducts = async () => {
    setSyncing(true);
    // Fetch all active products
    const { data: products } = await supabase.from("products").select("id, name, image_url, sort_order").eq("active", true).order("sort_order");
    if (!products) { setSyncing(false); return; }

    // Get existing prize product_ids
    const existingIds = prizes.filter(p => p.product_id).map(p => p.product_id);

    // Insert missing products as prizes
    const newPrizes = products
      .filter(p => !existingIds.includes(p.id))
      .map((p, i) => ({
        name: p.name,
        image_url: p.image_url,
        win_percentage: 5,
        prize_value: 0,
        active: true,
        sort_order: prizes.length + i,
        product_id: p.id,
      }));

    if (newPrizes.length > 0) {
      const { error } = await supabase.from("scratch_card_prizes").insert(newPrizes);
      if (error) toast({ title: "Erro ao sincronizar", description: error.message, variant: "destructive" });
      else toast({ title: `${newPrizes.length} produto(s) adicionado(s)!` });
    } else {
      toast({ title: "Todos os produtos já estão sincronizados" });
    }

    // Update names/images of existing
    for (const product of products) {
      const existing = prizes.find(p => p.product_id === product.id);
      if (existing && (existing.name !== product.name || existing.image_url !== product.image_url)) {
        await supabase.from("scratch_card_prizes").update({
          name: product.name,
          image_url: product.image_url,
        }).eq("id", existing.id);
      }
    }

    await refetchScratch();
    setSyncing(false);
  };

  const handleSavePrize = async (prize: Prize) => {
    setSavingPct(prize.id);
    const { error } = await supabase.from("scratch_card_prizes").update({
      win_percentage: parseFloat(editPct) || 0,
      active: editActive,
    }).eq("id", prize.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Atualizado!" });
    setEditingId(null);
    setSavingPct(null);
    void refetchScratch();
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    const { error } = await supabase.from("scratch_card_config").update({
      price: parseFloat(configPrice) || 2.50,
      active: configActive,
    }).eq("id", config.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Configurações salvas!" });
      void refetchScratch();
    }
    setSavingConfig(false);
  };

  const totalPct = prizes.filter(p => p.active).reduce((s, p) => s + p.win_percentage, 0);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-destructive">Não foi possível carregar os dados da raspadinha.</p>
        <button
          type="button"
          onClick={() => void refetchScratch()}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-success"
        >
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Total Jogadas</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalPlays}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Vitórias</p>
          <p className="text-2xl font-bold text-success mt-1">{totalWins}</p>
          <p className="text-xs text-muted-foreground">{totalPlays > 0 ? ((totalWins / totalPlays) * 100).toFixed(1) : 0}% taxa</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Receita Total</p>
          <p className="text-2xl font-bold text-foreground mt-1">R$ {totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Config */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Configurações</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
            <input type="number" step="0.50" min="0" value={configPrice} onChange={(e) => setConfigPrice(e.target.value)}
              className="mt-1 w-32 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50" />
          </div>
          <label className="flex cursor-pointer items-center gap-3 pb-2">
            <div className="relative">
              <input type="checkbox" checked={configActive} onChange={(e) => setConfigActive(e.target.checked)} className="peer sr-only" />
              <div className="h-5 w-9 rounded-full border border-border bg-secondary peer-checked:border-success peer-checked:bg-success" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 peer-checked:left-[18px] peer-checked:bg-success-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Raspadinha Ativa</span>
          </label>
          <button onClick={handleSaveConfig} disabled={savingConfig}
            className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-50">
            {savingConfig && <Loader2 className="h-4 w-4 animate-spin" />} Salvar Config
          </button>
        </div>
      </div>

      {/* Prizes (synced from products) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Prêmios (Produtos)</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Os prêmios são seus produtos. Ajuste a % de chance de cada um.
            </p>
            <p className={`text-xs mt-1 ${totalPct > 100 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              Soma das probabilidades: {totalPct.toFixed(1)}% {totalPct > 100 && "⚠️ acima de 100%"} · Chance de "Nada": {Math.max(0, 100 - totalPct).toFixed(1)}%
            </p>
          </div>
          <button onClick={handleSyncProducts} disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-success/30 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar Produtos
          </button>
        </div>

        {prizes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-muted-foreground">
            <Gift className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-semibold">Nenhum prêmio</p>
            <p className="text-sm mt-1">Clique em "Sincronizar Produtos" para importar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {prizes.map((prize) => (
              <div key={prize.id} className={`flex items-center justify-between rounded-lg border p-4 ${
                !prize.active ? "border-border/50 bg-card/50 opacity-60" : "border-border bg-card hover:border-success/30"
              }`}>
                <div className="flex items-center gap-3">
                  {prize.image_url ? (
                    <img src={prize.image_url} alt={prize.name} className="h-12 w-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                      <Gift className="h-6 w-6 text-success" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{prize.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-success font-medium">{prize.win_percentage}% chance</span>
                      {!prize.active && <span className="text-xs text-destructive">Desativado</span>}
                    </div>
                  </div>
                </div>

                {editingId === prize.id ? (
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground">% Chance</label>
                      <input type="number" step="0.1" min="0" max="100" value={editPct}
                        onChange={(e) => setEditPct(e.target.value)}
                        className="w-20 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm text-foreground outline-none focus:border-success/50" />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2">
                      <div className="relative">
                        <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="peer sr-only" />
                        <div className="h-4 w-7 rounded-full border border-border bg-secondary peer-checked:border-success peer-checked:bg-success" />
                        <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-foreground/60 peer-checked:left-[13px] peer-checked:bg-success-foreground" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">Ativo</span>
                    </label>
                    <button onClick={() => handleSavePrize(prize)} disabled={savingPct === prize.id}
                      className="p-2 rounded-lg bg-success text-success-foreground disabled:opacity-50">
                      {savingPct === prize.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingId(prize.id); setEditPct(String(prize.win_percentage)); setEditActive(prize.active); }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScratchCardTab;
