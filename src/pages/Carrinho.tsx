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

    const productIds = items.map(i => i.productId).filter(id => !id.startsWith("lzt-"));
    const { data: rawResult, error } = await supabase.rpc("validate_coupon", {
      _code: code,
      _user_id: user.id,
      _cart_product_ids: productIds,
    });
    const result = rawResult as any;

    if (error || !result || !result.valid) {
      toast({ title: result?.error || "Cupom inválido", variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    // Check min order value client-side for UX
    if (result.min_order_value && totalPrice < Number(result.min_order_value)) {
      toast({ title: "Valor mínimo não atingido", description: `Pedido mínimo: R$ ${Number(result.min_order_value).toFixed(2)}`, variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    setAppliedCoupon({
      id: result.id,
      code: code,
      discount_type: result.discount_type as "percentage" | "fixed",
      discount_value: Number(result.discount_value),
    });
    toast({ title: "Cupom aplicado!", description: `${code} - ${result.discount_type === "percentage" ? `${result.discount_value}% de desconto` : `R$ ${Number(result.discount_value).toFixed(2)} de desconto`}` });
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
      <div className="mx-auto max-w-5xl px-6 pt-4 pb-20">
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
                    {item.type !== "lzt-account" && (
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
                    )}
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
                <Zap className="h-4 w-4" />
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
