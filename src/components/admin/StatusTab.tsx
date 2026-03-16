import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw, Clock, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ProductRow {
  id: string;
  name: string;
  image_url: string | null;
  status: string;
  status_label: string;
  game_name: string;
}

const statusOptions = [
  { value: "undetected", label: "Indetectável", color: "text-success", icon: ShieldCheck },
  { value: "detected", label: "Detectável", color: "text-destructive", icon: ShieldAlert },
  { value: "updating", label: "Atualizando", color: "text-warning", icon: RefreshCw },
  { value: "offline", label: "Offline", color: "text-muted-foreground", icon: Clock },
];

const StatusTab = () => {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { status: string; status_label: string }>>({});

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, image_url, status, status_label, games(name)")
      .order("sort_order");

    if (data) {
      setProducts(
        data.map((p: any) => ({
          id: p.id,
          name: p.name,
          image_url: p.image_url,
          status: p.status,
          status_label: p.status_label,
          game_name: p.games?.name || "",
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleStatusChange = (productId: string, newStatus: string) => {
    const opt = statusOptions.find(o => o.value === newStatus);
    setEdits(prev => ({
      ...prev,
      [productId]: { status: newStatus, status_label: opt?.label || newStatus },
    }));
  };

  const handleLabelChange = (productId: string, label: string) => {
    setEdits(prev => ({
      ...prev,
      [productId]: { ...prev[productId], status_label: label },
    }));
  };

  const handleSave = async (productId: string) => {
    const edit = edits[productId];
    if (!edit) return;
    setSaving(productId);
    const { error } = await supabase
      .from("products")
      .update({ status: edit.status, status_label: edit.status_label, status_updated_at: new Date().toISOString() })
      .eq("id", productId);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status atualizado!" });
      setEdits(prev => { const n = { ...prev }; delete n[productId]; return n; });
      fetchProducts();
    }
    setSaving(null);
  };

  const handleSaveAll = async () => {
    const ids = Object.keys(edits);
    if (!ids.length) return;
    setSaving("all");
    for (const id of ids) {
      const edit = edits[id];
      await supabase
        .from("products")
        .update({ status: edit.status, status_label: edit.status_label, status_updated_at: new Date().toISOString() })
        .eq("id", id);
    }
    toast({ title: `${ids.length} produto(s) atualizado(s)!` });
    setEdits({});
    fetchProducts();
    setSaving(null);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>;

  const grouped = products.reduce<Record<string, ProductRow[]>>((acc, p) => {
    if (!acc[p.game_name]) acc[p.game_name] = [];
    acc[p.game_name].push(p);
    return acc;
  }, {});

  const hasEdits = Object.keys(edits).length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">Status dos Produtos</h2>
        {hasEdits && (
          <button
            onClick={handleSaveAll}
            disabled={saving === "all"}
            className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-50"
          >
            {saving === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Todos ({Object.keys(edits).length})
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 opacity-20" />
          <p className="mt-3 font-semibold">Nenhum produto cadastrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([gameName, prods]) => (
            <div key={gameName}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{gameName}</h3>
              <div className="space-y-2">
                {prods.map((product) => {
                  const edit = edits[product.id];
                  const currentStatus = edit?.status || product.status;
                  const currentLabel = edit?.status_label || product.status_label;
                  const opt = statusOptions.find(o => o.value === currentStatus);
                  const Icon = opt?.icon || ShieldCheck;
                  const hasChange = !!edit;

                  return (
                    <div
                      key={product.id}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
                        hasChange ? "border-success/50 bg-success/5" : "border-border bg-card"
                      }`}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-foreground truncate">{product.name}</h4>
                      </div>

                      {/* Status selector */}
                      <div className="flex items-center gap-1">
                        {statusOptions.map((so) => {
                          const SoIcon = so.icon;
                          const active = currentStatus === so.value;
                          return (
                            <button
                              key={so.value}
                              onClick={() => handleStatusChange(product.id, so.value)}
                              title={so.label}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
                                active
                                  ? `${so.color} border-current bg-current/10`
                                  : "text-muted-foreground/40 border-transparent hover:text-muted-foreground"
                              }`}
                            >
                              <SoIcon className="h-3 w-3" />
                              <span className="hidden sm:inline">{so.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom label */}
                      <input
                        type="text"
                        value={currentLabel}
                        onChange={(e) => handleLabelChange(product.id, e.target.value.slice(0, 30))}
                        className="w-32 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-success/50"
                        placeholder="Label"
                      />

                      {hasChange && (
                        <button
                          onClick={() => handleSave(product.id)}
                          disabled={saving === product.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-success text-success-foreground transition-all hover:shadow-md disabled:opacity-50"
                        >
                          {saving === product.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatusTab;
