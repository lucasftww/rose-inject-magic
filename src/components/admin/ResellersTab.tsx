import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Loader2, Search, ChevronDown, ChevronRight,
  UserCheck, ShieldCheck, ShieldOff, Package, Key, DollarSign
} from "lucide-react";

interface Reseller {
  id: string;
  user_id: string;
  discount_percent: number;
  active: boolean;
  expires_at: string | null;
  total_purchases: number;
  created_at: string;
  username?: string;
  email?: string;
}

interface ResellerProduct {
  id: string;
  reseller_id: string;
  product_id: string;
}

interface Product {
  id: string;
  name: string;
}

interface Purchase {
  id: string;
  original_price: number;
  paid_price: number;
  created_at: string;
  plan_name?: string;
  stock_content?: string;
}

const ResellersTab = () => {
  const { users: adminUsersData } = useAdminUsers();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; email: string; username: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserLabel, setSelectedUserLabel] = useState("");
  const [formDiscount, setFormDiscount] = useState(10);
  const [formActive, setFormActive] = useState(true);
  const [formExpires, setFormExpires] = useState("");
  const [formProductIds, setFormProductIds] = useState<string[]>([]);

  // Expanded reseller detail
  const [expandedReseller, setExpandedReseller] = useState<string | null>(null);
  const [resellerProducts, setResellerProducts] = useState<Record<string, string[]>>({});
  const [resellerPurchases, setResellerPurchases] = useState<Record<string, Purchase[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDiscount, setEditDiscount] = useState(10);
  const [editActive, setEditActive] = useState(true);
  const [editExpires, setEditExpires] = useState("");
  const [editProductIds, setEditProductIds] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchResellers = async () => {
    const { data, error } = await supabase
      .from("resellers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const enriched = (data as any[]).map((r: any) => {
        const user = adminUsersData.find((u: any) => u.id === r.user_id);
        return { ...r, username: user?.username || null, email: user?.email || "?" };
      });
      setResellers(enriched);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name").order("name", { ascending: true });
    if (data) setProducts(data);
  };

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { if (adminUsersData.length > 0) fetchResellers(); }, [adminUsersData]);

  const searchUsers = async () => {
    if (searchEmail.trim().length < 2) return;
    setSearching(true);
    const users = adminUsersData.filter((u: any) =>
      u.email?.toLowerCase().includes(searchEmail.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchEmail.toLowerCase())
    );
    setSearchResults(users.slice(0, 5).map((u: any) => ({ id: u.id, email: u.email, username: u.username || "" })));
    setSearching(false);
  };

  useEffect(() => {
    const t = setTimeout(() => { if (searchEmail.trim().length >= 2) searchUsers(); }, 400);
    return () => clearTimeout(t);
  }, [searchEmail]);

  const handleAddReseller = async () => {
    if (!selectedUserId) { toast({ title: "Selecione um usuário", variant: "destructive" }); return; }
    setSaving(true);
    const { data: resData, error } = await supabase.from("resellers").insert({
      user_id: selectedUserId,
      discount_percent: formDiscount,
      active: formActive,
      expires_at: formExpires || null,
    }).select().single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    // Add product associations
    if (formProductIds.length > 0 && resData) {
      const items = formProductIds.map(pid => ({ reseller_id: resData.id, product_id: pid }));
      await supabase.from("reseller_products").insert(items);
    }
    toast({ title: "Revendedor adicionado!" });
    resetForm();
    fetchResellers();
    setSaving(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedUserId(null);
    setSelectedUserLabel("");
    setSearchEmail("");
    setSearchResults([]);
    setFormDiscount(10);
    setFormActive(true);
    setFormExpires("");
    setFormProductIds([]);
  };

  const toggleExpand = async (reseller: Reseller) => {
    if (expandedReseller === reseller.id) {
      setExpandedReseller(null);
      return;
    }
    setExpandedReseller(reseller.id);
    setLoadingDetail(reseller.id);

    // Load products and purchases
    const [prodRes, purchRes] = await Promise.all([
      supabase.from("reseller_products").select("product_id").eq("reseller_id", reseller.id),
      supabase.from("reseller_purchases").select("*").eq("reseller_id", reseller.id).order("created_at", { ascending: false }),
    ]);

    if (prodRes.data) {
      setResellerProducts(prev => ({ ...prev, [reseller.id]: (prodRes.data as any[]).map((p: any) => p.product_id) }));
    }

    if (purchRes.data) {
      // Enrich with plan names
      const purchases = (purchRes.data as any[]).map((p: any) => ({
        id: p.id,
        original_price: p.original_price,
        paid_price: p.paid_price,
        created_at: p.created_at,
        plan_name: "",
        stock_content: "",
      }));
      setResellerPurchases(prev => ({ ...prev, [reseller.id]: purchases }));
    }

    // Set edit state
    setEditingId(null);
    setLoadingDetail(null);
  };

  const startEdit = (reseller: Reseller) => {
    setEditingId(reseller.id);
    setEditDiscount(reseller.discount_percent);
    setEditActive(reseller.active);
    setEditExpires(reseller.expires_at ? reseller.expires_at.split("T")[0] : "");
    setEditProductIds(resellerProducts[reseller.id] || []);
  };

  const saveEdit = async (reseller: Reseller) => {
    setSavingEdit(true);
    const { error } = await supabase.from("resellers").update({
      discount_percent: editDiscount,
      active: editActive,
      expires_at: editExpires || null,
    }).eq("id", reseller.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSavingEdit(false);
      return;
    }

    // Update product associations
    await supabase.from("reseller_products").delete().eq("reseller_id", reseller.id);
    if (editProductIds.length > 0) {
      const items = editProductIds.map(pid => ({ reseller_id: reseller.id, product_id: pid }));
      await supabase.from("reseller_products").insert(items);
    }
    setResellerProducts(prev => ({ ...prev, [reseller.id]: editProductIds }));

    toast({ title: "Revendedor atualizado!" });
    setEditingId(null);
    fetchResellers();
    setSavingEdit(false);
  };

  const handleDelete = async (reseller: Reseller) => {
    if (!confirm(`Remover revendedor ${reseller.email || reseller.user_id}?`)) return;
    const { error } = await supabase.from("resellers").delete().eq("id", reseller.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Removido!" }); fetchResellers(); }
  };

  const toggleProductId = (id: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter(p => p !== id) : [...list, id]);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Revendedores</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground">
          <Plus className="h-4 w-4" /> Novo Revendedor
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="text-lg font-bold text-foreground">Adicionar Revendedor</h3>

          {/* User search */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Buscar usuário</label>
            {selectedUserId ? (
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-2.5">
                <UserCheck className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-foreground flex-1">{selectedUserLabel}</span>
                <button onClick={() => { setSelectedUserId(null); setSelectedUserLabel(""); setSearchEmail(""); }}
                  className="text-xs text-muted-foreground hover:text-destructive">Trocar</button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)}
                  placeholder="Email ou username..."
                  className="w-full rounded-lg border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-success" />}
                {searchResults.length > 0 && !selectedUserId && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-40 overflow-y-auto">
                    {searchResults.map(u => (
                      <button key={u.id} onClick={() => {
                        setSelectedUserId(u.id);
                        setSelectedUserLabel(`${u.username || "?"} (${u.email})`);
                        setSearchResults([]);
                      }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50 text-left">
                        <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{u.username || "Sem username"}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Desconto (%)</label>
              <input type="number" min={1} max={100} value={formDiscount}
                onChange={e => setFormDiscount(e.target.value === "" ? 0 : Number(e.target.value))}
                onBlur={() => setFormDiscount(Math.max(1, Math.min(100, formDiscount)))}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Expira em (opcional)</label>
              <input type="date" value={formExpires} onChange={e => setFormExpires(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50" />
            </div>
            <label className="flex cursor-pointer items-center gap-3 self-end pb-2.5">
              <div className="relative">
                <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full border border-border bg-secondary peer-checked:border-success peer-checked:bg-success" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 peer-checked:left-[18px] peer-checked:bg-success-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Ativo</span>
            </label>
          </div>

          {/* Product selection */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Produtos permitidos ({formProductIds.length === 0 ? "Todos" : formProductIds.length + " selecionado(s)"})
            </label>
            <div className="flex flex-wrap gap-2">
              {products.map(p => (
                <button key={p.id} onClick={() => toggleProductId(p.id, formProductIds, setFormProductIds)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                    formProductIds.includes(p.id)
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}>
                  {p.name}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio = todos os produtos</p>
          </div>

          <div className="flex gap-3">
            <button onClick={handleAddReseller} disabled={saving || !selectedUserId}
              className="flex items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar
            </button>
            <button onClick={resetForm} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-6 space-y-3">
        {resellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-muted-foreground">
            <UserCheck className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-semibold">Nenhum revendedor cadastrado</p>
          </div>
        ) : resellers.map(reseller => {
          const isExpanded = expandedReseller === reseller.id;
          const isEditing = editingId === reseller.id;
          const rProducts = resellerProducts[reseller.id] || [];
          const rPurchases = resellerPurchases[reseller.id] || [];
          const isExpired = reseller.expires_at && new Date(reseller.expires_at) < new Date();

          return (
            <div key={reseller.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <button onClick={() => toggleExpand(reseller)}
                className="flex w-full items-center gap-4 p-4 text-left hover:bg-secondary/30">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-success shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 shrink-0">
                  <UserCheck className="h-4 w-4 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground truncate">{reseller.username || "Sem username"}</h4>
                    {reseller.active && !isExpired ? (
                      <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-success/20 text-success">
                        <ShieldCheck className="h-3 w-3" /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-destructive/20 text-destructive">
                        <ShieldOff className="h-3 w-3" /> {isExpired ? "Expirado" : "Inativo"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{reseller.email} · {reseller.discount_percent}% desconto · {reseller.total_purchases} compras</p>
                </div>
                <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold text-accent-foreground shrink-0">
                  -{reseller.discount_percent}%
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-border p-4 space-y-4">
                  {loadingDetail === reseller.id ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-success" /></div>
                  ) : (
                    <>
                      {/* Edit / View details */}
                      {isEditing ? (
                        <div className="rounded-lg border border-border bg-secondary/10 p-4 space-y-4">
                          <h4 className="text-sm font-bold text-foreground">Editar Revendedor</h4>
                          <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Desconto (%)</label>
                              <input type="number" min={1} max={100} value={editDiscount}
                                onChange={e => setEditDiscount(e.target.value === "" ? 0 : Number(e.target.value))}
                                onBlur={() => setEditDiscount(Math.max(1, Math.min(100, editDiscount)))}
                                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Expira em</label>
                              <input type="date" value={editExpires} onChange={e => setEditExpires(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50" />
                            </div>
                            <label className="flex cursor-pointer items-center gap-3 self-end pb-2.5">
                              <div className="relative">
                                <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="peer sr-only" />
                                <div className="h-5 w-9 rounded-full border border-border bg-secondary peer-checked:border-success peer-checked:bg-success" />
                                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 peer-checked:left-[18px] peer-checked:bg-success-foreground" />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">Ativo</span>
                            </label>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-2 block">Produtos</label>
                            <div className="flex flex-wrap gap-2">
                              {products.map(p => (
                                <button key={p.id} onClick={() => toggleProductId(p.id, editProductIds, setEditProductIds)}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                                    editProductIds.includes(p.id)
                                      ? "border-success/30 bg-success/10 text-success"
                                      : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                                  }`}>
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button onClick={() => saveEdit(reseller)} disabled={savingEdit}
                              className="flex items-center gap-2 rounded-lg bg-success px-5 py-2 text-xs font-semibold text-success-foreground disabled:opacity-50">
                              {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />} Salvar
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="rounded-lg border border-border px-5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button onClick={() => startEdit(reseller)}
                            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-success/30">
                            Editar
                          </button>
                          <button onClick={() => handleDelete(reseller)}
                            className="rounded-lg border border-destructive/30 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3 inline mr-1" /> Remover
                          </button>
                        </div>
                      )}

                      {/* Products info */}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5" /> Produtos permitidos
                        </h4>
                        {rProducts.length === 0 ? (
                          <span className="text-xs text-success">Todos os produtos</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {rProducts.map(pid => {
                              const prod = products.find(p => p.id === pid);
                              return prod ? (
                                <span key={pid} className="rounded bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">{prod.name}</span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>

                      {/* Purchases */}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Key className="h-3.5 w-3.5" /> Compras ({rPurchases.length})
                        </h4>
                        {rPurchases.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma compra registrada</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                            {rPurchases.map(purchase => (
                              <div key={purchase.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                                <DollarSign className="h-3.5 w-3.5 text-success shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-foreground font-medium">
                                    R$ {Number(purchase.paid_price).toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground ml-2 line-through">
                                    R$ {Number(purchase.original_price).toFixed(2)}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {new Date(purchase.created_at).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-border bg-secondary/20 p-3 text-center">
                          <p className="text-lg font-bold text-foreground">{reseller.total_purchases}</p>
                          <p className="text-[10px] text-muted-foreground">Total compras</p>
                        </div>
                        <div className="rounded-lg border border-border bg-secondary/20 p-3 text-center">
                          <p className="text-lg font-bold text-success">{reseller.discount_percent}%</p>
                          <p className="text-[10px] text-muted-foreground">Desconto</p>
                        </div>
                        <div className="rounded-lg border border-border bg-secondary/20 p-3 text-center">
                          <p className="text-lg font-bold text-foreground">
                            R$ {rPurchases.reduce((s, p) => s + Number(p.paid_price), 0).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Total pago</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResellersTab;
