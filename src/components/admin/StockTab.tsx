import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Package, ChevronDown, ChevronRight, Plus, Trash2, Loader2, Sparkles, AlertTriangle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  product_plans: Plan[];
}

interface Plan {
  id: string;
  name: string;
  product_id: string;
  sort_order: number;
}

interface StockItem {
  id: string;
  product_plan_id: string;
  content: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 5;

const StockTab = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [stockMap, setStockMap] = useState<Record<string, StockItem[]>>({});
  const [stockCounts, setStockCounts] = useState<Record<string, { total: number; available: number }>>({});
  const [loadingStock, setLoadingStock] = useState<string | null>(null);
  const [newStockText, setNewStockText] = useState("");
  const [addingStock, setAddingStock] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiLines, setAiLines] = useState(5);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, image_url, product_plans(id, name, product_id, sort_order)")
      .order("sort_order", { ascending: true });
    if (!error && data) {
      setProducts(data as Product[]);
      // Fetch stock counts for all plans
      const planIds = data.flatMap((p: any) => p.product_plans.map((pl: any) => pl.id));
      if (planIds.length > 0) {
        const { data: stockData } = await supabase
          .from("stock_items")
          .select("product_plan_id, used")
          .in("product_plan_id", planIds);
        if (stockData) {
          const counts: Record<string, { total: number; available: number }> = {};
          stockData.forEach((s: any) => {
            if (!counts[s.product_plan_id]) counts[s.product_plan_id] = { total: 0, available: 0 };
            counts[s.product_plan_id].total++;
            if (!s.used) counts[s.product_plan_id].available++;
          });
          setStockCounts(counts);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const fetchStockForPlan = async (planId: string) => {
    setLoadingStock(planId);
    const { data, error } = await supabase
      .from("stock_items" as any)
      .select("*")
      .eq("product_plan_id", planId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setStockMap(prev => ({ ...prev, [planId]: data as unknown as StockItem[] }));
    }
    setLoadingStock(null);
  };

  const toggleProduct = (productId: string) => {
    setExpandedProduct(prev => prev === productId ? null : productId);
    setExpandedPlan(null);
  };

  const togglePlan = (planId: string) => {
    if (expandedPlan !== planId) {
      fetchStockForPlan(planId);
    }
    setExpandedPlan(prev => prev === planId ? null : planId);
    setNewStockText("");
  };

  const handleAddStock = async (planId: string) => {
    const lines = newStockText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast({ title: "Adicione pelo menos uma linha", variant: "destructive" }); return; }
    setAddingStock(true);
    const items = lines.map(content => ({ product_plan_id: planId, content }));
    const { error } = await supabase.from("stock_items" as any).insert(items);
    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${lines.length} item(s) adicionado(s)!` });
      setNewStockText("");
      fetchStockForPlan(planId);
      fetchProducts(); // refresh counts
    }
    setAddingStock(false);
  };

  const handleGenerateAI = async (planId: string) => {
    setGeneratingAI(true);
    try {
      // Generate fake stock lines
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const generated: string[] = [];
      for (let i = 0; i < aiLines; i++) {
        const segments = [4, 4, 4, 4].map(() =>
          Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
        );
        generated.push(segments.join("-"));
      }
      setNewStockText(prev => prev ? prev + "\n" + generated.join("\n") : generated.join("\n"));
      toast({ title: `${aiLines} chaves geradas!` });
    } catch {
      toast({ title: "Erro ao gerar", variant: "destructive" });
    }
    setGeneratingAI(false);
  };

  const handleDeleteStock = async (stockId: string, planId: string) => {
    const { error } = await supabase.from("stock_items" as any).delete().eq("id", stockId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Item removido!" });
      fetchStockForPlan(planId);
      fetchProducts();
    }
  };

  const handleDeleteAllAvailable = async (planId: string) => {
    if (!confirm("Excluir todo estoque disponível deste plano?")) return;
    const { error } = await supabase.from("stock_items" as any).delete().eq("product_plan_id", planId).eq("used", false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Estoque limpo!" });
      fetchStockForPlan(planId);
      fetchProducts();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">Gerenciar Estoque</h2>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-muted-foreground">
          <Package className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-semibold">Nenhum produto cadastrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
            const paginated = products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
            return (<>
          {paginated.map(product => {
            const isExpanded = expandedProduct === product.id;
            const totalAvailable = product.product_plans.reduce((sum, pl) => sum + (stockCounts[pl.id]?.available || 0), 0);
            const totalStock = product.product_plans.reduce((sum, pl) => sum + (stockCounts[pl.id]?.total || 0), 0);

            return (
              <div key={product.id} className="rounded-lg border border-border bg-card overflow-hidden">
                {/* Product header */}
                <button
                  onClick={() => toggleProduct(product.id)}
                  className="flex w-full items-center gap-4 p-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-success shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded-lg border border-border object-cover shrink-0" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.product_plans.length} plano(s)</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {totalAvailable === 0 && totalStock === 0 ? (
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                        Sem estoque
                      </span>
                    ) : totalAvailable === 0 ? (
                      <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Esgotado
                      </span>
                    ) : (
                      <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
                        {totalAvailable} disponível
                      </span>
                    )}
                  </div>
                </button>

                {/* Plans */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {product.product_plans.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">Nenhum plano cadastrado</p>
                    ) : product.product_plans
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(plan => {
                      const planExpanded = expandedPlan === plan.id;
                      const counts = stockCounts[plan.id] || { total: 0, available: 0 };
                      const items = stockMap[plan.id] || [];

                      return (
                        <div key={plan.id} className="border-b border-border last:border-b-0">
                          {/* Plan header */}
                          <button
                            onClick={() => togglePlan(plan.id)}
                            className="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-secondary/20 transition-colors"
                          >
                            {planExpanded ? <ChevronDown className="h-3.5 w-3.5 text-success shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                            <div className="flex items-center gap-2 ml-auto">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${counts.available > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                                {counts.available}/{counts.total}
                              </span>
                            </div>
                          </button>

                          {/* Plan stock content */}
                          {planExpanded && (
                            <div className="px-6 pb-4 space-y-4">
                              {/* Add stock area */}
                              <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-muted-foreground">Adicionar estoque (uma chave por linha)</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      max={100}
                                      value={aiLines}
                                      onChange={e => setAiLines(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                      className="w-14 rounded border border-border bg-secondary/50 px-2 py-1 text-xs text-foreground text-center outline-none"
                                    />
                                    <button
                                      onClick={() => handleGenerateAI(plan.id)}
                                      disabled={generatingAI}
                                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                                    >
                                      {generatingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                      Gerar
                                    </button>
                                  </div>
                                </div>
                                <textarea
                                  value={newStockText}
                                  onChange={e => setNewStockText(e.target.value)}
                                  placeholder={"XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY\n..."}
                                  rows={5}
                                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/40 outline-none focus:border-success/50 resize-y"
                                />
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">
                                    {newStockText.split("\n").filter(l => l.trim()).length} linha(s)
                                  </span>
                                  <button
                                    onClick={() => handleAddStock(plan.id)}
                                    disabled={addingStock || !newStockText.trim()}
                                    className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-xs font-semibold text-success-foreground hover:shadow-[0_0_24px_hsl(130,99%,41%,0.45)] disabled:opacity-50"
                                  >
                                    {addingStock ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                    Adicionar
                                  </button>
                                </div>
                              </div>

                              {/* Stock list */}
                              {loadingStock === plan.id ? (
                                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-success" /></div>
                              ) : items.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-4">Nenhum item no estoque</p>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {items.filter(i => !i.used).length} disponível · {items.filter(i => i.used).length} usado
                                    </span>
                                    {items.some(i => !i.used) && (
                                      <button onClick={() => handleDeleteAllAvailable(plan.id)}
                                        className="text-[10px] font-medium text-destructive hover:underline">
                                        Limpar disponíveis
                                      </button>
                                    )}
                                  </div>
                                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                                    {items.map(item => (
                                      <div key={item.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${item.used ? "bg-muted/30" : ""}`}>
                                        <span className={`h-2 w-2 rounded-full shrink-0 ${item.used ? "bg-destructive" : "bg-success"}`} />
                                        <span className={`flex-1 font-mono truncate ${item.used ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                          {item.content}
                                        </span>
                                        {item.used && item.used_at && (
                                          <span className="text-[10px] text-muted-foreground shrink-0">
                                            {new Date(item.used_at).toLocaleDateString("pt-BR")}
                                          </span>
                                        )}
                                        {!item.used && (
                                          <button onClick={() => handleDeleteStock(item.id, plan.id)}
                                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0">
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${p === currentPage ? "bg-success text-success-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{p}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30">›</button>
            </div>
          )}
          </>);
          })()}
        </div>
      )}
    </div>
  );
};

export default StockTab;
