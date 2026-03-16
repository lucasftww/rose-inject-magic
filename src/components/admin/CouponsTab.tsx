import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Tag, X } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_order_value: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface CouponProduct {
  id: string;
  coupon_id: string;
  product_id: string;
}

interface Product {
  id: string;
  name: string;
}

const CouponsTab = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"percentage" | "fixed">("percentage");
  const [formValue, setFormValue] = useState("");
  const [formMaxUses, setFormMaxUses] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formExpires, setFormExpires] = useState("");
  const [formProductIds, setFormProductIds] = useState<string[]>([]);

  const fetchCoupons = async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (data) setCoupons(data as Coupon[]);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name").order("name");
    if (data) setProducts(data);
  };

  useEffect(() => { fetchCoupons(); fetchProducts(); }, []);

  const resetForm = () => {
    setFormCode(""); setFormType("percentage"); setFormValue(""); setFormMaxUses("");
    setFormMinOrder(""); setFormActive(true); setFormExpires(""); setFormProductIds([]);
    setEditing(null); setShowForm(false);
  };

  const openEdit = async (coupon: Coupon) => {
    setEditing(coupon);
    setFormCode(coupon.code);
    setFormType(coupon.discount_type as "percentage" | "fixed");
    setFormValue(String(coupon.discount_value));
    setFormMaxUses(coupon.max_uses !== null ? String(coupon.max_uses) : "");
    setFormMinOrder(coupon.min_order_value ? String(coupon.min_order_value) : "");
    setFormActive(coupon.active);
    setFormExpires(coupon.expires_at ? coupon.expires_at.slice(0, 16) : "");
    // Load associated products
    const { data } = await supabase.from("coupon_products").select("product_id").eq("coupon_id", coupon.id);
    setFormProductIds(data ? data.map((p: any) => p.product_id) : []);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formCode.trim() || !formValue) {
      toast({ title: "Preencha código e valor", variant: "destructive" }); return;
    }
    setSaving(true);

    const payload = {
      code: formCode.trim().toUpperCase(),
      discount_type: formType,
      discount_value: Number(formValue),
      max_uses: formMaxUses ? Number(formMaxUses) : null,
      min_order_value: formMinOrder ? Number(formMinOrder) : 0,
      active: formActive,
      expires_at: formExpires ? new Date(formExpires).toISOString() : null,
    };

    let couponId: string;

    if (editing) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSaving(false); return; }
      couponId = editing.id;
    } else {
      const { data, error } = await supabase.from("coupons").insert(payload).select("id").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); setSaving(false); return; }
      couponId = data.id;
    }

    // Update product associations
    await supabase.from("coupon_products").delete().eq("coupon_id", couponId);
    if (formProductIds.length > 0) {
      await supabase.from("coupon_products").insert(
        formProductIds.map(pid => ({ coupon_id: couponId, product_id: pid }))
      );
    }

    toast({ title: editing ? "Cupom atualizado!" : "Cupom criado!" });
    resetForm();
    fetchCoupons();
    setSaving(false);
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`Excluir cupom "${coupon.code}"?`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", coupon.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Cupom excluído!" }); fetchCoupons(); }
  };

  const toggleProduct = (pid: string) => {
    setFormProductIds(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Cupons de Desconto</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground">
          <Plus className="h-4 w-4" /> Novo Cupom
        </button>
      </div>

      {showForm && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-bold text-foreground">{editing ? "Editar Cupom" : "Novo Cupom"}</h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Código</label>
              <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))}
                placeholder="EX: DESCONTO10"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de desconto</label>
              <div className="mt-1 flex gap-2">
                {(["percentage", "fixed"] as const).map((t) => (
                  <button key={t} onClick={() => setFormType(t)}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${formType === t ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {t === "percentage" ? "% Porcentagem" : "R$ Valor fixo"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Valor {formType === "percentage" ? "(%)" : "(R$)"}
              </label>
              <input type="number" value={formValue} onChange={(e) => setFormValue(e.target.value)}
                placeholder={formType === "percentage" ? "Ex: 10" : "Ex: 25.00"}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Máximo de usos (vazio = ilimitado)</label>
              <input type="number" value={formMaxUses} onChange={(e) => setFormMaxUses(e.target.value)}
                placeholder="Ex: 100"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Valor mínimo do pedido (R$)</label>
              <input type="number" value={formMinOrder} onChange={(e) => setFormMinOrder(e.target.value)}
                placeholder="Ex: 50.00"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Data de expiração (opcional)</label>
              <input type="datetime-local" value={formExpires} onChange={(e) => setFormExpires(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50" />
            </div>

            {/* Product filter */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Produtos permitidos (vazio = todos)
              </label>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <button key={p.id} onClick={() => toggleProduct(p.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      formProductIds.includes(p.id)
                        ? "border-success bg-success/10 text-success"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}>
                    {p.name}
                  </button>
                ))}
                {products.length === 0 && <p className="text-xs text-muted-foreground">Nenhum produto cadastrado</p>}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full border border-border bg-secondary transition-colors peer-checked:border-success peer-checked:bg-success" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 transition-all peer-checked:left-[18px] peer-checked:bg-success-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Ativo</span>
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground hover:shadow-[0_0_24px_hsl(var(--success)/0.35)] disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Salvar" : "Criar"}
            </button>
            <button onClick={resetForm} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {/* Coupons list */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-muted-foreground">
            <Tag className="h-10 w-10 mb-3 opacity-40" /><p className="font-semibold">Nenhum cupom cadastrado</p>
          </div>
        ) : coupons.map((coupon) => (
          <div key={coupon.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-success/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
              <Tag className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold font-mono text-foreground">{coupon.code}</h4>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${coupon.active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                  {coupon.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `R$ ${Number(coupon.discount_value).toFixed(2)}`}
                {coupon.max_uses !== null && ` · ${coupon.current_uses}/${coupon.max_uses} usos`}
                {coupon.expires_at && ` · Expira: ${new Date(coupon.expires_at).toLocaleDateString("pt-BR")}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(coupon)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(coupon)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CouponsTab;
