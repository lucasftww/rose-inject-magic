import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, Clock, ArrowLeft, Package, ShieldCheck, Zap, CreditCard, Wallet, Sparkles, ChevronRight, ExternalLink } from "lucide-react";
import logoRoyal from "@/assets/logo-royal.png";
import { motion } from "framer-motion";

type PaymentMethod = "pix" | "card" | "crypto" | null;

const Checkout = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, clearCart } = useCart();
  const [searchParams] = useSearchParams();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [chargeData, setChargeData] = useState<{
    brCode: string;
    qrCodeImage: string;
    expiresAt: string;
  } | null>(null);
  const [cardPaymentUrl, setCardPaymentUrl] = useState<string | null>(null);
  const [cryptoData, setCryptoData] = useState<{
    address: string;
    qrCode: string;
    payAmount: number;
    payCurrency: string;
    network: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>("ACTIVE");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [enabledMethods, setEnabledMethods] = useState<Record<string, boolean>>({ pix: true, card: true, crypto: true });
  const hasLztItems = items.some((i) => i.type === "lzt-account");
  const couponId = searchParams.get("coupon_id");
  // Price is calculated from cart items — never trust URL params
  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = parseFloat(searchParams.get("discount") || "0");
  const cartFinalPrice = Math.max(0, cartTotal - discountAmount);
  // Store the display price so it survives cart clearing
  const [displayPrice, setDisplayPrice] = useState<{ total: number; final: number; discount: number } | null>(null);
  const totalPrice = displayPrice?.total ?? cartTotal;
  const finalPrice = displayPrice?.final ?? cartFinalPrice;

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
    if (!authLoading && user && items.length === 0 && !paymentId) navigate("/carrinho");
  }, [authLoading, user, items.length, navigate, paymentId]);

  useEffect(() => {
    supabase.from("payment_settings").select("method, enabled").then(({ data }) => {
      if (data) {
        const map: Record<string, boolean> = {};
        data.forEach((r: any) => { map[r.method] = r.enabled; });
        setEnabledMethods(map);
      }
    });
  }, []);

  const buildCartSnapshot = () =>
    items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      productImage: i.productImage,
      planId: i.planId,
      planName: i.planName,
      price: i.price,
      quantity: i.quantity,
      ...(i.type === "lzt-account"
        ? {
            type: i.type,
            lztItemId: i.lztItemId,
            lztPrice: i.lztPrice,
            lztCurrency: i.lztCurrency,
          }
        : {}),
    }));

  const getAuthHeaders = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    return {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  };

  // PIX charge
  const createPixCharge = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-payment?action=create`,
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            cart_snapshot: buildCartSnapshot(),
            coupon_id: couponId,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Erro ao criar cobrança");
      setPaymentId(result.payment_id);
      setChargeData(result.charge);
      setDisplayPrice({ total: cartTotal, final: cartFinalPrice, discount: discountAmount });
      clearCart();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar PIX", description: err.message, variant: "destructive" });
      setPaymentMethod(null);
    } finally {
      setLoading(false);
    }
  };

  // Card charge
  const createCardCharge = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-payment?action=create-card`,
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            cart_snapshot: buildCartSnapshot(),
            coupon_id: couponId,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Erro ao criar cobrança");
      setPaymentId(result.payment_id);
      setCardPaymentUrl(result.paymentUrl);
      setDisplayPrice({ total: cartTotal, final: cartFinalPrice, discount: discountAmount });
      clearCart();
      // Open the checkout URL in a new tab
      window.open(result.paymentUrl, "_blank");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar pagamento com cartão", description: err.message, variant: "destructive" });
      setPaymentMethod(null);
    } finally {
      setLoading(false);
    }
  };

  // Crypto (USDT) charge
  const createCryptoCharge = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-payment?action=create-crypto`,
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            amount: Math.round(finalPrice * 100),
            description: `Compra Royal Store - ${items.length} item(s)`,
            cart_snapshot: buildCartSnapshot(),
            coupon_id: couponId,
            discount_amount: discountAmount,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Erro ao criar cobrança");
      setPaymentId(result.payment_id);
      setCryptoData(result.crypto);
      setDisplayPrice({ total: cartTotal, final: cartFinalPrice, discount: discountAmount });
      clearCart();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar pagamento USDT", description: err.message, variant: "destructive" });
      setPaymentMethod(null);
    } finally {
      setLoading(false);
    }
  };

  // Select payment method
  const handleSelectMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    if (method === "pix") createPixCharge();
    if (method === "card") createCardCharge();
    if (method === "crypto") createCryptoCharge();
  };

  // Poll status (works for PIX, card, and crypto)
  useEffect(() => {
    if (!paymentId || paymentStatus !== "ACTIVE") return;
    const statusAction = paymentMethod === "card" ? "card-status" : paymentMethod === "crypto" ? "crypto-status" : "status";
    const checkStatus = async () => {
      setChecking(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-payment?action=${statusAction}&payment_id=${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        const data = await res.json();
        if (data.status && data.status !== "ACTIVE") {
          setPaymentStatus(data.status);
          if (data.status === "COMPLETED" && intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch { /* silent */ }
      setChecking(false);
    };
    intervalRef.current = setInterval(checkStatus, 5000);
    checkStatus();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paymentId, paymentStatus, paymentMethod]);

  const copyCode = () => {
    if (chargeData?.brCode) {
      navigator.clipboard.writeText(chargeData.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Código copiado!" });
    }
  };


  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-40">
          <Loader2 className="h-8 w-8 animate-spin text-success" />
        </div>
      </div>
    );
  }

  // Payment completed
  if (paymentStatus === "COMPLETED") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-3xl px-6 pt-32 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            {/* Animated success ring */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="mx-auto mb-8 relative"
            >
              <div className="absolute inset-0 h-24 w-24 mx-auto rounded-full bg-success/20 blur-2xl animate-pulse" />
              <div className="relative flex h-24 w-24 mx-auto items-center justify-center rounded-full border-2 border-success/40 bg-gradient-to-br from-success/20 to-success/5">
                <Check className="h-12 w-12 text-success" strokeWidth={2.5} />
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl md:text-4xl font-bold text-foreground mb-3"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              <span className="text-success">PAGAMENTO</span> CONFIRMADO
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-muted-foreground mb-12 max-w-md mx-auto"
            >
              Seus produtos já estão disponíveis. Obrigado por comprar na Royal Store!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <button
                onClick={() => navigate("/dashboard?tab=purchases")}
                className="group inline-flex items-center justify-center gap-2.5 rounded-md bg-success px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-success-foreground transition-all hover:shadow-[0_0_40px_hsl(var(--success)/0.4)]"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                <Package className="h-4 w-4" />
                Meus Pedidos
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={() => navigate("/produtos")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-8 py-3.5 text-sm font-medium text-muted-foreground transition-all hover:border-success/40 hover:text-foreground hover:bg-success/5"
              >
                Continuar comprando
              </button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Payment expired/failed/cancelled
  if (paymentStatus === "EXPIRED" || paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-2xl px-6 pt-32 pb-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
              <Clock className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              {paymentStatus === "EXPIRED" ? "Pagamento Expirado" : paymentStatus === "FAILED" ? "Pagamento Falhou" : "Pagamento Cancelado"}
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              {paymentStatus === "EXPIRED" ? "O tempo para pagamento expirou." : paymentStatus === "FAILED" ? "O cartão foi recusado ou houve um erro." : "O pagamento foi cancelado."}
            </p>
            <button
              onClick={() => navigate("/carrinho")}
              className="rounded-md bg-success px-8 py-3 text-sm font-bold text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(var(--success)/0.4)]"
            >
              Voltar ao carrinho
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Main checkout view
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] bg-success/[0.03] blur-[120px] rounded-full" />

      <Header />
      <div className="relative mx-auto max-w-3xl px-6 pt-28 pb-20">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-success group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Voltar
        </motion.button>

        {/* Payment method selection */}
        {!paymentMethod && !paymentId && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 rounded-md border border-success/20 bg-success/5 px-4 py-1.5 mb-5"
              >
                <Sparkles className="h-3.5 w-3.5 text-success" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-success">Checkout Seguro</span>
              </motion.div>

              <h1
                className="text-3xl sm:text-4xl font-bold text-foreground mb-3"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                COMO DESEJA <span className="text-success">PAGAR</span>?
              </h1>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Escolha sua forma de pagamento preferida
              </p>
            </div>

            {/* Total price card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mx-auto mb-12 max-w-xs"
            >
              <div className="relative overflow-hidden rounded-lg border border-success/20 bg-gradient-to-br from-success/10 via-card to-card p-6 text-center">
                <div className="absolute top-0 right-0 h-20 w-20 bg-success/10 blur-3xl rounded-full" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-success/70 mb-1">Valor total</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-success/60 font-medium">R$</span>
                  <span className="text-4xl font-bold text-foreground tracking-tight">{finalPrice.toFixed(2).replace(".", ",")}</span>
                </div>
                {discountAmount > 0 && (
                  <p className="text-xs text-muted-foreground/50 line-through mt-1">R$ {totalPrice.toFixed(2).replace(".", ",")}</p>
                )}
              </div>
            </motion.div>

            {/* Payment methods */}
            <div className="flex flex-col gap-3 max-w-lg mx-auto">
              {/* PIX */}
              {enabledMethods.pix !== false && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectMethod("pix")}
                  className="group relative overflow-hidden rounded-lg border border-border/80 bg-card px-6 py-5 text-left transition-all duration-500 hover:border-success/50 hover:shadow-[0_8px_50px_-12px_hsl(var(--success)/0.25)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-success/5 via-transparent to-success/3 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-secondary/50 border border-border/60 transition-all duration-500 group-hover:border-success/40 group-hover:from-success/15 group-hover:to-success/5">
                      <svg className="h-6 w-6 text-muted-foreground transition-colors duration-500 group-hover:text-success" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"/></svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-foreground tracking-tight">PIX</h3>
                      <p className="text-xs text-muted-foreground">Pagamento instantâneo</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:text-success group-hover:translate-x-0.5" />
                  </div>
                </motion.button>
              )}

              {/* Card — hidden for LZT account purchases */}
              {enabledMethods.card !== false && !hasLztItems && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectMethod("card")}
                  className="group relative overflow-hidden rounded-lg border border-border/80 bg-card px-6 py-5 text-left transition-all duration-500 hover:border-success/50 hover:shadow-[0_8px_50px_-12px_hsl(var(--success)/0.25)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-success/5 via-transparent to-success/3 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-secondary/50 border border-border/60 transition-all duration-500 group-hover:border-success/40 group-hover:from-success/15 group-hover:to-success/5">
                      <CreditCard className="h-6 w-6 text-muted-foreground transition-colors duration-500 group-hover:text-success" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-foreground tracking-tight">Cartão</h3>
                      <p className="text-xs text-muted-foreground">Visa, Master, Elo</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:text-success group-hover:translate-x-0.5" />
                  </div>
                </motion.button>
              )}

              {/* Crypto USDT */}
              {enabledMethods.crypto !== false && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectMethod("crypto")}
                  className="group relative overflow-hidden rounded-lg border border-border/80 bg-card px-6 py-5 text-left transition-all duration-500 hover:border-success/50 hover:shadow-[0_8px_50px_-12px_hsl(var(--success)/0.25)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-success/5 via-transparent to-success/3 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-secondary/50 border border-border/60 transition-all duration-500 group-hover:border-success/40 group-hover:from-success/15 group-hover:to-success/5">
                      <Wallet className="h-6 w-6 text-muted-foreground transition-colors duration-500 group-hover:text-success" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-foreground tracking-tight">USDT</h3>
                      <p className="text-xs text-muted-foreground">Rede TRC20</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:text-success group-hover:translate-x-0.5" />
                  </div>
                </motion.button>
              )}
            </div>

            {/* Security footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-12 flex items-center justify-center gap-6 text-muted-foreground/40"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wider">Criptografia SSL</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wider">Entrega automática</span>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Loading state — animated progress steps */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-16"
          >
            {/* Pulsing ring */}
            <div className="relative mb-10">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.05, 0.15] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 h-24 w-24 rounded-full bg-success blur-2xl"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                className="relative flex h-24 w-24 items-center justify-center"
              >
                <svg className="h-24 w-24" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="44" fill="none" stroke="hsl(var(--border))" strokeWidth="2" opacity="0.3" />
                  <circle cx="48" cy="48" r="44" fill="none" stroke="hsl(var(--success))" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="80 200" />
                </svg>
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="h-8 w-8 text-success" />
              </div>
            </div>

            <p className="text-base font-bold text-foreground mb-2" style={{ fontFamily: "'Valorant', sans-serif" }}>
              {paymentMethod === "card" ? "CRIANDO PAGAMENTO" : paymentMethod === "crypto" ? "CRIANDO PAGAMENTO" : "GERANDO PIX"}
            </p>

            {/* Animated progress steps */}
            <div className="flex flex-col gap-2.5 mt-4 w-full max-w-xs">
              {[
                { label: "Validando carrinho", delay: 0 },
                { label: "Conectando ao gateway", delay: 0.8 },
                { label: "Gerando QR Code", delay: 1.8 },
              ].map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: step.delay, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: step.delay + 0.2, type: "spring", stiffness: 300 }}
                  >
                    <div className="h-5 w-5 rounded-full border border-success/40 bg-success/10 flex items-center justify-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: step.delay + 0.5 }}
                        className="h-2 w-2 rounded-full bg-success"
                      />
                    </div>
                  </motion.div>
                  <span className="text-xs text-muted-foreground">{step.label}</span>
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              className="text-[10px] text-muted-foreground/50 mt-6 uppercase tracking-widest"
            >
              Isso leva apenas alguns segundos
            </motion.p>
          </motion.div>
        )}

        {/* PIX view */}
        {paymentMethod === "pix" && !loading && chargeData && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-5xl"
          >
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_8px_60px_-16px_hsl(var(--success)/0.08)]">
              <div className="flex flex-col lg:flex-row min-h-[520px]">

                {/* ── Left panel — Branding & info ── */}
                <div className="hidden lg:flex flex-col w-[44%] relative overflow-hidden">
                  {/* Gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-success/[0.06] via-card to-card" />
                  <div className="absolute bottom-0 left-0 h-48 w-48 bg-success/[0.04] blur-[80px] rounded-full" />
                  <div className="absolute top-0 right-0 h-32 w-32 bg-success/[0.06] blur-[60px] rounded-full" />

                  <div className="relative z-10 flex flex-col h-full p-10 border-r border-border/40">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-10">
                      <img src={logoRoyal} alt="Royal Store" className="h-9 object-contain" />
                      <span className="text-lg font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}>
                        <span className="text-primary">ROYAL</span>
                        <span className="text-foreground/80"> STORE</span>
                      </span>
                    </div>

                    {/* Title */}
                    <h2
                      className="text-2xl font-bold text-foreground mb-1.5"
                      style={{ fontFamily: "'Valorant', sans-serif" }}
                    >
                      PAGUE VIA <span className="text-success">PIX</span>
                    </h2>
                    <p className="text-[13px] text-muted-foreground mb-10 leading-relaxed">
                      Escaneie o QR Code ou copie o código Pix para realizar o pagamento.
                    </p>

                    {/* Price card */}
                    <div className="rounded-xl border border-success/15 bg-success/[0.04] p-5 mb-6">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-success/50 mb-2">Valor a pagar</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm text-success/50 font-medium">R$</span>
                        <span className="text-4xl font-bold text-foreground tracking-tight">{finalPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                      {discountAmount > 0 && (
                        <p className="text-xs text-muted-foreground/40 line-through mt-1.5">R$ {totalPrice.toFixed(2).replace(".", ",")}</p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-success">Aguardando pagamento</span>
                    </div>

                    {/* Expiry */}
                    <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3.5 py-2 w-fit mb-8">
                      <Clock className="h-3 w-3 text-muted-foreground/40" />
                      <span className="text-[10px] text-muted-foreground">
                        Expira às{" "}
                        <span className="font-semibold text-foreground">
                          {chargeData.expiresAt
                            ? new Date(chargeData.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                            : "30 min"}
                        </span>
                      </span>
                    </div>

                    <div className="flex-1" />

                    {/* Security badges */}
                    <div className="flex items-center gap-5 text-muted-foreground/30">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="text-[9px] uppercase tracking-wider font-medium">Criptografia SSL</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" />
                        <span className="text-[9px] uppercase tracking-wider font-medium">Aprovação imediata</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Right panel — QR Code + Copy ── */}
                <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-10 lg:py-12">
                  {/* Mobile header */}
                  <div className="lg:hidden text-center mb-8">
                    <h2
                      className="text-xl font-bold text-foreground mb-2"
                      style={{ fontFamily: "'Valorant', sans-serif" }}
                    >
                      PAGUE VIA <span className="text-success">PIX</span>
                    </h2>
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-success">Aguardando</span>
                      </div>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-lg font-bold text-foreground">R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center mb-8">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="relative"
                    >
                      <div className="absolute -inset-5 rounded-2xl bg-success/[0.04] blur-2xl" />
                      <div className="relative rounded-2xl border border-border/30 bg-white p-4 shadow-sm">
                        <img src={chargeData.qrCodeImage} alt="QR Code PIX" className="h-52 w-52 sm:h-60 sm:w-60 rounded-xl" />
                      </div>
                    </motion.div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">Copia e Cola</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  {/* Code block */}
                  <div className="rounded-xl border border-border/50 bg-background/60 p-4 mb-5">
                    <p className="text-[10px] font-mono text-muted-foreground/60 break-all leading-relaxed select-all line-clamp-3">{chargeData.brCode}</p>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={copyCode}
                    className={`w-full inline-flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                      copied
                        ? "bg-success text-success-foreground shadow-[0_0_40px_hsl(var(--success)/0.35)]"
                        : "bg-success text-success-foreground hover:shadow-[0_0_50px_hsl(var(--success)/0.3)] btn-shine"
                    }`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Código copiado!" : "Copiar código PIX"}
                  </button>

                  {/* Auto confirm */}
                  <div className="mt-7 flex items-center justify-center gap-2 text-muted-foreground/30">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[9px] uppercase tracking-wider font-medium">Confirmação automática ao pagar</span>
                  </div>

                  {/* Mobile expiry */}
                  <div className="lg:hidden mt-4 flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-4 py-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground/40" />
                      <span className="text-[10px] text-muted-foreground">
                        Expira às{" "}
                        <span className="font-medium text-foreground">
                          {chargeData.expiresAt
                            ? new Date(chargeData.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                            : "30 min"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}

        {/* Card view */}
        {paymentMethod === "card" && !loading && cardPaymentUrl && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-5xl"
          >
             <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="hidden md:flex flex-col w-[45%] bg-card border-r border-border/60 relative overflow-hidden">
                  <div className="relative z-10 flex flex-col h-full p-10">
                    <div className="flex items-center gap-3 mb-8">
                      <img src={logoRoyal} alt="Royal Store" className="h-10 object-contain" />
                      <span className="text-xl font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}>
                        <span className="text-primary">ROYAL</span>
                        <span className="text-foreground"> STORE</span>
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "'Valorant', sans-serif" }}>
                      PAGAMENTO COM <span className="text-success">CARTÃO</span>
                    </h2>
                    <p className="text-sm text-muted-foreground mb-8">Complete o pagamento na página externa</p>

                     <div className="rounded-md border border-success/20 bg-success/5 p-5 mb-6">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-success/70 mb-1">Valor total</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-success/60 font-medium">R$</span>
                        <span className="text-3xl font-bold text-foreground tracking-tight">{finalPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-6">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-success" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-success">Aguardando pagamento</span>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-4 text-muted-foreground/40">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase tracking-wider">Checkout seguro</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase tracking-wider">Entrega automática</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center px-8 md:px-12 py-14">
                  <div className="md:hidden text-center mb-6">
                    <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Valorant', sans-serif" }}>
                      PAGAMENTO COM <span className="text-success">CARTÃO</span>
                    </h2>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-success" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-success">Aguardando</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span className="text-lg font-bold text-foreground">R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>

                  <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-success/10 border border-success/20 mb-8">
                    <CreditCard className="h-12 w-12 text-success" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-xs mb-8">
                    Uma aba foi aberta para completar o pagamento. O status será atualizado automaticamente.
                  </p>
                  <a
                    href={cardPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full max-w-xs flex items-center justify-center gap-2.5 rounded-md bg-success py-3.5 text-sm font-bold uppercase tracking-wider text-success-foreground transition-all hover:shadow-[0_0_40px_hsl(var(--success)/0.4)]"
                    style={{ fontFamily: "'Valorant', sans-serif" }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir página de pagamento
                  </a>

                  <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/40">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[10px] uppercase tracking-wider">Confirmação automática</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Crypto USDT view */}
        {paymentMethod === "crypto" && !loading && cryptoData && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-5xl"
          >
            <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="hidden md:flex flex-col w-[45%] bg-card border-r border-border/60 relative overflow-hidden">
                  <div className="relative z-10 flex flex-col h-full p-10">
                    <div className="flex items-center gap-3 mb-8">
                      <img src={logoRoyal} alt="Royal Store" className="h-10 object-contain" />
                      <span className="text-xl font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}>
                        <span className="text-primary">ROYAL</span>
                        <span className="text-foreground"> STORE</span>
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "'Valorant', sans-serif" }}>
                      PAGAMENTO COM <span className="text-success">USDT</span>
                    </h2>
                    <p className="text-sm text-muted-foreground mb-8">Envie o valor exato via rede {cryptoData.network}</p>

                    <div className="rounded-md border border-success/20 bg-success/5 p-5 mb-6">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-success/70 mb-1">Valor total</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-success/60 font-medium">R$</span>
                        <span className="text-3xl font-bold text-foreground tracking-tight">{finalPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-lg font-bold text-success">{cryptoData.payAmount}</span>
                        <span className="text-xs text-success/70">{cryptoData.payCurrency}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-success">Aguardando pagamento</span>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-4 py-1.5 w-fit mb-6">
                      <Clock className="h-3 w-3 text-success/60" />
                      <span className="text-[11px] text-muted-foreground">
                        Expira às{" "}
                        <span className="font-medium text-foreground">
                          {cryptoData.expiresAt
                            ? new Date(cryptoData.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                            : "30 min"}
                        </span>
                      </span>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-4 text-muted-foreground/40">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase tracking-wider">Criptografia SSL</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase tracking-wider">Aprovação imediata</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center px-8 md:px-12 py-10">
                  <div className="md:hidden text-center mb-6">
                    <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Valorant', sans-serif" }}>
                      PAGAMENTO COM <span className="text-success">USDT</span>
                    </h2>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-success">Aguardando</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span className="text-lg font-bold text-foreground">R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>

                  {cryptoData.qrCode && (
                    <div className="flex justify-center mb-8">
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="relative">
                         <div className="absolute -inset-4 rounded-lg bg-success/5 blur-xl" />
                         <div className="relative rounded-lg border border-success/15 bg-white p-4">
                           <img src={cryptoData.qrCode} alt="QR Code USDT" className="h-52 w-52 sm:h-60 sm:w-60 rounded-md" />
                        </div>
                      </motion.div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">Endereço {cryptoData.network}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div className="rounded-md border border-border bg-background/60 p-3.5 mb-4">
                    <p className="text-[11px] font-mono text-muted-foreground break-all leading-relaxed select-all">{cryptoData.address}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(cryptoData.address);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast({ title: "Endereço copiado!" });
                    }}
                     className={`w-full inline-flex items-center justify-center gap-2.5 rounded-md py-3 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                       copied ? "bg-success text-success-foreground shadow-[0_0_30px_hsl(var(--success)/0.3)]" : "bg-success/10 border border-success/30 text-success hover:bg-success/20 hover:border-success/50"
                     }`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Endereço copiado!" : "Copiar endereço"}
                  </button>

                  <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground/40">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[10px] uppercase tracking-wider">Confirmação automática</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Checkout;