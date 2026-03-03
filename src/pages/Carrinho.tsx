import { useState } from "react";
import Header from "@/components/Header";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2, Zap, Tag, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AuthModal from "@/components/AuthModal";

interface AppliedCoupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
}

const Carrinho = () => {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    if (!user) { toast({ title: "Faça login para usar cupons", variant: "destructive" }); return; }
    setCouponLoading(true);

    // Fetch coupon
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .single();

    if (error || !coupon) {
      toast({ title: "Cupom inválido", description: "Este cupom não existe ou está inativo.", variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      toast({ title: "Cupom expirado", variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    // Check max uses
    if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
      toast({ title: "Cupom esgotado", variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    // Check min order value
    if (coupon.min_order_value && totalPrice < Number(coupon.min_order_value)) {
      toast({ title: "Valor mínimo não atingido", description: `Pedido mínimo: R$ ${Number(coupon.min_order_value).toFixed(2)}`, variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    // Check if user is allowed
    const { data: allowedUsers } = await supabase
      .from("coupon_users")
      .select("id")
      .eq("coupon_id", coupon.id);

    if (allowedUsers && allowedUsers.length > 0) {
      const isAllowed = allowedUsers.some((u: any) => u.user_id === user.id);
      if (!isAllowed) {
        toast({ title: "Cupom não disponível para você", variant: "destructive" });
        setCouponLoading(false);
        return;
      }
    }

    // Check allowed products
    const { data: allowedProducts } = await supabase
      .from("coupon_products")
      .select("product_id")
      .eq("coupon_id", coupon.id);

    if (allowedProducts && allowedProducts.length > 0) {
      const allowedIds = allowedProducts.map((p: any) => p.product_id);
      const hasValidItem = items.some(i => allowedIds.includes(i.productId));
      if (!hasValidItem) {
        toast({ title: "Cupom não aplicável", description: "Nenhum produto do carrinho é elegível.", variant: "destructive" });
        setCouponLoading(false);
        return;
      }
    }

    // Check user usage
    const { data: usage } = await supabase
      .from("coupon_usage")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", user.id);

    if (usage && usage.length > 0) {
      toast({ title: "Cupom já utilizado", variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    setAppliedCoupon({
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type as "percentage" | "fixed",
      discount_value: Number(coupon.discount_value),
    });
    toast({ title: "Cupom aplicado!", description: `${coupon.code} - ${coupon.discount_type === "percentage" ? `${coupon.discount_value}% de desconto` : `R$ ${Number(coupon.discount_value).toFixed(2)} de desconto`}` });
    setCouponLoading(false);
  };

  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? totalPrice * (appliedCoupon.discount_value / 100)
      : Math.min(appliedCoupon.discount_value, totalPrice)
    : 0;

  const finalPrice = Math.max(0, totalPrice - discountAmount);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-6 pt-28 pb-20">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-success hover:text-success"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="mb-8 flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-success" />
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
            MEU CARRINHO
          </h1>
          {totalItems > 0 && (
            <span className="rounded-full bg-success/10 px-3 py-0.5 text-xs font-bold text-success">
              {totalItems} {totalItems === 1 ? "item" : "itens"}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <ShoppingCart className="h-16 w-16 text-muted-foreground/20" />
            <p className="mt-4 text-lg font-semibold text-muted-foreground">Seu carrinho está vazio</p>
            <p className="mt-1 text-sm text-muted-foreground/60">Adicione produtos para continuar</p>
            <button
              onClick={() => navigate("/produtos")}
              className="mt-6 rounded-lg bg-success px-6 py-3 text-sm font-bold uppercase tracking-wider text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(130,99%,41%,0.4)]"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              VER PRODUTOS
            </button>
          </motion.div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Items list */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item, idx) => (
                <motion.div
                  key={`${item.productId}-${item.planId}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-success/30"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ShoppingCart className="h-6 w-6 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <h3 className="text-sm font-bold text-foreground truncate">{item.productName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Plano: {item.planName}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.planId, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-success hover:text-success"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.planId, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-success hover:text-success"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeItem(item.productId, item.planId)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="text-right">
                      <span className="text-sm font-bold text-success">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                      {item.quantity > 1 && (
                        <p className="text-[10px] text-muted-foreground">R$ {item.price.toFixed(2)} /un</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              <button
                onClick={clearCart}
                className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Limpar carrinho
              </button>
            </div>

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="h-fit rounded-xl border border-border bg-card p-6 lg:sticky lg:top-28"
            >
              <div className="mb-5 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-success/50 to-transparent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-success">Resumo</span>
                <div className="h-px flex-1 bg-gradient-to-l from-success/50 to-transparent" />
              </div>

              {/* Items breakdown */}
              <div className="space-y-2.5 mb-5">
                {items.map((item) => (
                  <div key={`${item.productId}-${item.planId}`} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">{item.planName} × {item.quantity}</p>
                    </div>
                    <span className="text-xs font-bold text-foreground shrink-0">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coupon input */}
              <div className="mb-5 border-t border-border pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Cupom de desconto
                </p>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 px-3 py-2">
                    <div>
                      <span className="text-xs font-bold text-success">{appliedCoupon.code}</span>
                      <p className="text-[10px] text-muted-foreground">
                        {appliedCoupon.discount_type === "percentage"
                          ? `-${appliedCoupon.discount_value}%`
                          : `-R$ ${appliedCoupon.discount_value.toFixed(2)}`}
                      </p>
                    </div>
                    <button onClick={() => setAppliedCoupon(null)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase().slice(0, 20))}
                      placeholder="CÓDIGO"
                      className="flex-1 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-medium text-foreground uppercase placeholder:text-muted-foreground outline-none focus:border-success/50"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-xs font-bold text-success transition-colors hover:bg-success/20 disabled:opacity-50"
                    >
                      {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
                    </button>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground font-medium">R$ {totalPrice.toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-xs">
                    <span className="text-success">Desconto</span>
                    <span className="text-success font-medium">- R$ {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-end justify-between pt-2 border-t border-border">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold text-success">R$ {finalPrice.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!user) { setAuthOpen(true); return; }
                  const params = new URLSearchParams();
                  if (appliedCoupon) {
                    params.set("coupon_id", appliedCoupon.id);
                    params.set("discount", discountAmount.toString());
                  }
                  navigate(`/checkout${params.toString() ? `?${params.toString()}` : ""}`);
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-success py-3.5 text-sm font-bold uppercase tracking-wider text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(130,99%,41%,0.4)]"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                <svg height="20" width="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>
                FINALIZAR COMPRA
              </button>
            </motion.div>
          </div>
        )}
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab="register" />
    </div>
  );
};

export default Carrinho;
