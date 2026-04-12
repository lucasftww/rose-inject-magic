import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Copy, Check, Clock, ArrowLeft, Package, ShieldCheck, Zap,
  CreditCard, Wallet, Sparkles, ChevronRight, ExternalLink, Lock,
  CheckCircle, AlertCircle, Trash2, Tag,
} from "lucide-react";
import logoRoyal from "@/assets/logo-royal.png";
import { motion } from "framer-motion";
import { trackPurchase, getUserData, setAdvancedMatching } from "@/lib/metaPixel";
import { buildMetaPurchasePayloadFromCartItems } from "@/lib/buildMetaPurchasePayload";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import { safeHttpUrl } from "@/lib/safeUrl";
import { buildCartSnapshotFromItems } from "@/lib/buildCartSnapshot";
import type { PixPaymentCreateResult, PixPaymentStatusResult } from "@/lib/edgeFunctionTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PaymentMethod = "pix" | "card" | "crypto" | null;

/** Resposta de `validate_coupon` (jsonb) — manter alinhado ao RPC em migrations. */
type ValidateCouponRpcResult = {
  valid?: boolean;
  error?: string;
  id?: string;
  discount_type?: string;
  discount_value?: number;
  min_order_value?: number;
};

function parseValidateCouponRpc(data: unknown): ValidateCouponRpcResult {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return {};
  return data as ValidateCouponRpcResult;
}

/* ── CPF checksum validation ── */
function validateCpfChecksum(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // all same digits
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10], 10);
}

/* ── CPF mask ── */
function applyCpfMask(value: string): string {
  let v = value.replace(/\D/g, "").slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return v;
}

/* ── Phone mask ── */
function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  let v = digits;
  if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  // 11 digits (mobile): (XX) XXXXX-XXXX — hyphen after 5th digit
  // 10 digits (landline): (XX) XXXX-XXXX — hyphen after 4th digit
  if (digits.length > 6) {
    const splitAt = digits.length === 11 ? 5 : 4;
    const local = digits.slice(2);
    v = `(${digits.slice(0, 2)}) ${local.slice(0, splitAt)}-${local.slice(splitAt)}`;
  }
  return v;
}

/** Dígitos com código do país 55 (Meta / gateways). Evita `55` órfão se o campo estiver vazio. */
function toBrazilPhoneDigits(maskedPhone: string): string {
  const d = maskedPhone.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

/* ── Field validation helpers ── */
function validateName(name: string): boolean {
  const t = name.trim();
  return t.length >= 3 && t.includes(" ") && t.split(" ").filter(Boolean).length >= 2;
}
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* ── PIX icon SVG ── */
const PixIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" />
  </svg>
);

/* ── Stepper ── */
const STEPS = [
  { label: "Dados", num: 1 },
  { label: "Pagamento", num: 2 },
  { label: "Entrega", num: 3 },
];
function CheckoutStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {STEPS.map((s, i) => {
        const done = s.num < currentStep;
        const active = s.num === currentStep;
        return (
          <div key={s.num} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && (
              <div className={`h-px w-4 sm:w-8 ${done ? "bg-emerald-500" : "bg-border"}`} />
            )}
            <div className="flex items-center gap-1.5">
              {done ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border-2 ${
                    active
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground/50"
                  }`}
                >
                  {s.num}
                </div>
              )}
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  done ? "text-emerald-500" : active ? "text-foreground" : "text-muted-foreground/50"
                }`}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Checkout = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, clearCart } = useCart();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    name: "",
    email: user?.email || "",
    phone: "",
    document: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formValid, setFormValid] = useState(false);

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
  const checkoutEmailUserIdRef = useRef<string | null>(null);
  const [enabledMethods, setEnabledMethods] = useState<Record<string, boolean> | null>(null);
  const hasLztItems = items.some((i) => i.type === "lzt-account");

  // Coupon state
  const urlCouponId = searchParams.get("coupon_id");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ id: string; code: string; discount: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const [cartSnapshot, setCartSnapshot] = useState<typeof items>([]);

  const cartTotal = items.reduce((sum, i) => {
    const p = Number.isFinite(i.price) && i.price >= 0 ? i.price : 0;
    const q = Number.isFinite(i.quantity) && i.quantity >= 1 ? Math.floor(i.quantity) : 0;
    return sum + p * q;
  }, 0);
  const safeCartTotal = Number.isFinite(cartTotal) ? cartTotal : 0;

  const rawUrlDiscount = parseFloat(searchParams.get("discount") || "0");
  const urlDiscount = Number.isFinite(rawUrlDiscount) ? rawUrlDiscount : 0;
  const discountFromCoupon = couponApplied?.discount ?? 0;
  const discountAmount = Math.max(0, Math.min(urlDiscount + discountFromCoupon, safeCartTotal));
  const cartFinalPrice = Math.max(0, safeCartTotal - discountAmount);

  const [displayPrice, setDisplayPrice] = useState<{ total: number; final: number; discount: number } | null>(null);
  const totalPrice = displayPrice?.total ?? safeCartTotal;
  const finalPrice = displayPrice?.final ?? cartFinalPrice;
  const displayDiscount = displayPrice?.discount ?? discountAmount;

  const activeCouponId = couponApplied?.id || urlCouponId;

  // Field validations (memoized)
  const nameValid = useMemo(() => validateName(formData.name), [formData.name]);
  const emailValid = useMemo(() => validateEmail(formData.email), [formData.email]);
  const phoneDigits = formData.phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 10;
  const cpfDigits = formData.document.replace(/\D/g, "");
  const cpfComplete = cpfDigits.length === 11;
  const cpfValid = cpfComplete && validateCpfChecksum(formData.document);

  // InitiateCheckout is already tracked on the product detail pages (ProdutoDetalhes, ContaDetalhes, etc.)
  // before navigating here, so we do NOT fire it again to avoid duplicate events in Meta.

  useEffect(() => {
    if (formData.email.includes("@") && formData.name.length > 2) {
      import("@/lib/metaPixel").then(({ setAdvancedMatching }) => {
        setAdvancedMatching({
          email: formData.email,
          firstName: formData.name.split(" ")[0],
          lastName: formData.name.split(" ").slice(1).join(" "),
          externalId: user?.id,
        });
      });
    }
  }, [formData.email, formData.name, user?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      checkoutEmailUserIdRef.current = null;
      navigate("/");
      return;
    }
    if (!authLoading && user && items.length === 0 && !paymentId) {
      navigate("/");
      return;
    }
    if (authLoading || !user?.email) return;
    if (checkoutEmailUserIdRef.current !== user.id) {
      checkoutEmailUserIdRef.current = user.id;
      setFormData((prev) => ({ ...prev, email: user.email! }));
    }
  }, [authLoading, user, items.length, navigate, paymentId]);

  useEffect(() => {
    const isValid = nameValid && emailValid && phoneValid && cpfValid;
    setFormValid(isValid);
  }, [nameValid, emailValid, phoneValid, cpfValid]);

  useEffect(() => {
    void supabase
      .from("payment_settings")
      .select("method, enabled")
      .then(({ data, error }) => {
        if (error || !data) {
          // Fallback: only enable PIX since card/crypto are not supported by the current gateway
          setEnabledMethods({ pix: true });
          return;
        }
        const map: Record<string, boolean> = {};
        for (const r of data) {
          if (typeof r.method === "string") map[r.method] = r.enabled ?? false;
        }
        setEnabledMethods(map);
      })
      .catch(() => {
        setEnabledMethods({ pix: true });
      });
  }, []);

  const buildCartSnapshot2 = useCallback(() => buildCartSnapshotFromItems(items), [items]);

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Sessão expirada. Entre novamente para continuar.");
    const apikey = supabaseAnonKey;
    if (!apikey.trim()) throw new Error("Configuração do aplicativo incompleta.");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", apikey };
  };

  /* ── Free checkout ── */
  const freeCheckoutClaimRef = useRef(false);
  useEffect(() => {
    if (items.length === 0 || cartFinalPrice > 0) freeCheckoutClaimRef.current = false;
    if (authLoading || !user || items.length === 0 || paymentId || displayPrice !== null) return;
    if (cartFinalPrice > 0) return;
    if (!formValid) return; // Don't auto-claim free items without valid form data
    if (freeCheckoutClaimRef.current) return;
    freeCheckoutClaimRef.current = true;
    void (async () => {
      try {
        const result = await safeJsonFetch<PixPaymentCreateResult>(
          `${supabaseUrl}/functions/v1/pix-payment?action=create`,
          {
            method: "POST",
            headers: await getAuthHeaders(),
            body: JSON.stringify({
              cart_snapshot: buildCartSnapshot2(),
              coupon_id: activeCouponId,
              meta_user_data: getUserData(),
              customer_data: {
                name: formData.name.trim() || user.email?.split("@")[0] || "Cliente",
                email: formData.email.trim() || user.email || "",
                phone: toBrazilPhoneDigits(formData.phone) || formData.phone.trim(),
                document: formData.document,
              },
            }),
          },
        );
        if (!result.success || !result.claimed_free) {
          freeCheckoutClaimRef.current = false;
          toast({ title: "Não foi possível concluir", description: result.error || "Verifique o carrinho.", variant: "destructive" });
          return;
        }
        const freePayload = buildMetaPurchasePayloadFromCartItems(items, 0);
        if (freePayload && result.payment_id) {
          trackPurchase({ ...freePayload, transactionId: result.payment_id });
        }
        clearCart();
        if (result.ticket_id) {
          toast({ title: "Pronto!", description: "Abrindo o pedido com o download." });
          navigate(`/pedido/${result.ticket_id}`);
        } else navigate("/meus-pedidos");
      } catch (e: unknown) {
        freeCheckoutClaimRef.current = false;
        toast({ title: "Erro", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      }
    })();
  }, [authLoading, user, items, paymentId, displayPrice, cartFinalPrice, activeCouponId, formData, formValid, navigate, clearCart, buildCartSnapshot2]);

  /* ── Coupon apply ── */
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !user) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const { data, error } = await supabase.rpc("validate_coupon", {
        _code: couponCode.trim().toUpperCase(),
        _user_id: user.id,
        _cart_product_ids: items.map((i) => i.productId),
      });
      if (error) throw error;
      const result = parseValidateCouponRpc(data);
      if (!result.valid) {
        setCouponError(result.error || "Cupom inválido");
        return;
      }
      // Check minimum order value
      const minOrder = typeof result.min_order_value === "number" ? result.min_order_value : 0;
      if (minOrder > 0 && safeCartTotal < minOrder) {
        setCouponError(`Pedido mínimo de R$ ${minOrder.toFixed(2).replace(".", ",")} para este cupom`);
        return;
      }
      const rawValue = typeof result.discount_value === "number" && Number.isFinite(result.discount_value) ? result.discount_value : 0;
      const discount =
        result.discount_type === "percentage"
          ? (safeCartTotal * rawValue) / 100
          : rawValue;
      const couponId = typeof result.id === "string" && result.id.length > 0 ? result.id : "";
      if (!couponId) {
        setCouponError("Resposta do cupom inválida. Tente novamente.");
        return;
      }
      setCouponApplied({ id: couponId, code: couponCode.trim().toUpperCase(), discount: Math.min(discount, safeCartTotal) });
      setCouponCode("");
    } catch (e: unknown) {
      if (import.meta.env.DEV) console.warn("validate_coupon:", e instanceof Error ? e.message : String(e));
      setCouponError("Erro ao validar cupom");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponError("");
  };

  /* ── PIX charge ── */
  const createPixCharge = async () => {
    if (!user || loading) return;
    setLoading(true);
    await setAdvancedMatching({
      email: formData.email,
      phone: toBrazilPhoneDigits(formData.phone),
      firstName: formData.name.split(" ")[0],
      lastName: formData.name.split(" ").slice(1).join(" "),
      externalId: user.id,
    });
    try {
      const result = await safeJsonFetch<PixPaymentCreateResult>(`${supabaseUrl}/functions/v1/pix-payment?action=create`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ cart_snapshot: buildCartSnapshot2(), coupon_id: activeCouponId, meta_user_data: getUserData(), customer_data: formData }),
      });
      if (!result.success) throw new Error(result.error || "Erro ao criar cobrança");
      if (result.claimed_free) {
        const freePayload = buildMetaPurchasePayloadFromCartItems(items, 0);
        if (freePayload && result.payment_id) {
          trackPurchase({ ...freePayload, transactionId: result.payment_id });
        }
        clearCart();
        if (result.ticket_id) { toast({ title: "Pronto!", description: "Abrindo o pedido." }); navigate(`/pedido/${result.ticket_id}`); }
        else navigate("/meus-pedidos");
        return;
      }
      setPaymentId(result.payment_id ?? null);
      setChargeData(result.charge ?? null);
      const serverTotal = result.validated_amount ?? cartFinalPrice;
      const serverDiscount = result.validated_discount ?? discountAmount;
      setDisplayPrice({ total: serverTotal + serverDiscount, final: serverTotal, discount: serverDiscount });
      setCartSnapshot([...items]);
      clearCart();
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error(err);
      toast({ title: "Erro ao gerar PIX", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      setPaymentMethod(null);
    } finally {
      setLoading(false);
    }
  };

  /* ── Card charge ── */
  const createCardCharge = async () => {
    if (!user || loading) return;
    setLoading(true);
    await setAdvancedMatching({ email: formData.email, phone: toBrazilPhoneDigits(formData.phone), firstName: formData.name.split(" ")[0], lastName: formData.name.split(" ").slice(1).join(" "), externalId: user.id });
    try {
      const result = await safeJsonFetch<PixPaymentCreateResult>(`${supabaseUrl}/functions/v1/pix-payment?action=create-card`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ cart_snapshot: buildCartSnapshot2(), coupon_id: activeCouponId, meta_user_data: getUserData(), customer_data: formData }),
      });
      if (!result.success) throw new Error(result.error || "Erro ao criar cobrança");
      setPaymentId(result.payment_id ?? null);
      const cardUrl = safeHttpUrl(result.paymentUrl ?? undefined);
      setCardPaymentUrl(cardUrl);
      const serverTotal = result.validated_amount ?? cartFinalPrice;
      const serverDiscount = result.validated_discount ?? discountAmount;
      setDisplayPrice({ total: serverTotal + serverDiscount, final: serverTotal, discount: serverDiscount });
      setCartSnapshot([...items]);
      clearCart();
      if (cardUrl) window.open(cardUrl, "_blank", "noopener,noreferrer");
      else if (result.paymentUrl) toast({ title: "URL de pagamento inválida", variant: "destructive" });
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error(err);
      toast({ title: "Erro ao gerar pagamento com cartão", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      setPaymentMethod(null);
    } finally {
      setLoading(false);
    }
  };

  /* ── Crypto charge ── */
  const createCryptoCharge = async () => {
    if (!user || loading) return;
    setLoading(true);
    await setAdvancedMatching({ email: formData.email, phone: toBrazilPhoneDigits(formData.phone), firstName: formData.name.split(" ")[0], lastName: formData.name.split(" ").slice(1).join(" "), externalId: user.id });
    try {
      const result = await safeJsonFetch<PixPaymentCreateResult>(`${supabaseUrl}/functions/v1/pix-payment?action=create-crypto`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ cart_snapshot: buildCartSnapshot2(), coupon_id: activeCouponId, meta_user_data: getUserData(), customer_data: formData }),
      });
      if (!result.success) throw new Error(result.error || "Erro ao criar cobrança");
      setPaymentId(result.payment_id ?? null);
      setCryptoData(result.crypto ?? null);
      const serverTotal = result.validated_amount ?? cartFinalPrice;
      const serverDiscount = result.validated_discount ?? discountAmount;
      setDisplayPrice({ total: serverTotal + serverDiscount, final: serverTotal, discount: serverDiscount });
      setCartSnapshot([...items]);
      clearCart();
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error(err);
      toast({ title: "Erro ao gerar pagamento USDT", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      setPaymentMethod(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMethodRef = useRef(false);
  const handleSelectMethod = (method: PaymentMethod) => {
    if (loading || handleSelectMethodRef.current) return; // prevent double-submit
    handleSelectMethodRef.current = true;
    setPaymentMethod(method);
    const done = () => { handleSelectMethodRef.current = false; };
    if (method === "pix") createPixCharge().finally(done);
    else if (method === "card") createCardCharge().finally(done);
    else if (method === "crypto") createCryptoCharge().finally(done);
    else done();
  };

  /* ── Polling refs ── */
  const cartSnapshotRef = useRef(cartSnapshot);
  const finalPriceRef = useRef(finalPrice);
  const paymentIdRef = useRef(paymentId);
  const statusPollFailCountRef = useRef(0);
  const statusPollNotifiedRef = useRef(false);
  const statusPollInFlightRef = useRef(false);
  useEffect(() => { cartSnapshotRef.current = cartSnapshot; }, [cartSnapshot]);
  useEffect(() => { finalPriceRef.current = finalPrice; }, [finalPrice]);
  useEffect(() => { paymentIdRef.current = paymentId; }, [paymentId]);

  /* ── Poll status ── */
  useEffect(() => {
    if (!paymentId || paymentStatus !== "ACTIVE") return;
    let cancelled = false;
    statusPollFailCountRef.current = 0;
    statusPollNotifiedRef.current = false;
    statusPollInFlightRef.current = false;
    const statusAction = paymentMethod === "card" ? "card-status" : paymentMethod === "crypto" ? "crypto-status" : "status";
    const checkStatus = async () => {
      if (cancelled) return;
      if (statusPollInFlightRef.current) return;
      statusPollInFlightRef.current = true;
      setChecking(true);
      try {
        const data = await safeJsonFetch<PixPaymentStatusResult>(
          `${supabaseUrl}/functions/v1/pix-payment?action=${statusAction}&payment_id=${paymentId}`,
          { headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`, apikey: supabaseAnonKey } },
        );
        if (cancelled) return;
        statusPollFailCountRef.current = 0;
        if (data.status && data.status !== "ACTIVE") {
          setPaymentStatus(data.status);
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (data.status === "COMPLETED") {
            const snap = cartSnapshotRef.current;
            const purchasePayload = buildMetaPurchasePayloadFromCartItems(snap, finalPriceRef.current);
            if (purchasePayload) {
              trackPurchase({ ...purchasePayload, transactionId: paymentId });
            }
          }
        }
      } catch (e) {
        if (cancelled) return;
        statusPollFailCountRef.current += 1;
        if (import.meta.env.DEV) console.error("Checkout poll failed:", e);
        if (statusPollFailCountRef.current >= 5 && !statusPollNotifiedRef.current) {
          statusPollNotifiedRef.current = true;
          toast({ title: "Não foi possível verificar o pagamento", description: "Verifique sua conexão.", variant: "destructive" });
        }
      } finally {
        statusPollInFlightRef.current = false;
        if (!cancelled) setChecking(false);
      }
    };
    intervalRef.current = setInterval(checkStatus, 3000);
    checkStatus();
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paymentId, paymentStatus, paymentMethod]);

  const copyCode = () => {
    if (chargeData?.brCode) {
      navigator.clipboard.writeText(chargeData.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Código copiado!" });
    }
  };

  /* ── Derive current step ── */
  const currentStep = paymentStatus === "COMPLETED" ? 3 : paymentId ? 2 : 1;

  // ──────────────────────────── RENDER ────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  /* ── COMPLETED ── */
  if (paymentStatus === "COMPLETED") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-4 pb-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center">
            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }} className="mx-auto mb-8 relative">
              <div className="absolute inset-0 h-24 w-24 mx-auto rounded-full bg-emerald-500/20 blur-2xl animate-pulse" />
              <div className="relative flex h-24 w-24 mx-auto items-center justify-center rounded-full border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                <Check className="h-12 w-12 text-emerald-500" strokeWidth={2.5} />
              </div>
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3" style={{ fontFamily: "'Valorant', sans-serif" }}>
              <span className="text-emerald-500">PAGAMENTO</span> CONFIRMADO
            </h1>
            <p className="text-sm text-muted-foreground mb-12 max-w-md mx-auto">
              Seus produtos já estão disponíveis. Obrigado por comprar na Royal Store!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate("/dashboard?tab=purchases")} className="group inline-flex items-center justify-center gap-2.5 rounded-md bg-emerald-500 px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-emerald-600">
                <Package className="h-4 w-4" /> Meus Pedidos <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button onClick={() => navigate("/produtos")} className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-8 py-3.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-card">
                Continuar comprando
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── EXPIRED / FAILED / CANCELLED ── */
  if (paymentStatus === "EXPIRED" || paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-4 pb-20 text-center">
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
            <button onClick={() => navigate("/produtos")} className="rounded-md bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90">
              Voltar aos produtos
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── LOADING ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-3xl px-4 pt-4">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-8 rounded-lg border border-border bg-card px-4 py-3">
            <img src={logoRoyal} alt="Royal Store" className="h-7 object-contain" />
            <CheckoutStepper currentStep={2} />
            <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground/50">
              <Lock className="h-3.5 w-3.5" /><span className="text-[10px]">SSL 256 bits</span>
            </div>
          </div>
        </div>
        <motion.div role="status" aria-live="polite" aria-busy="true" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16">
          <span className="sr-only">Processando pagamento, aguarde.</span>
          <div className="relative mb-10">
            <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.05, 0.15] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 h-24 w-24 rounded-full bg-primary blur-2xl" />
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} className="relative flex h-24 w-24 items-center justify-center">
              <svg className="h-24 w-24" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="44" fill="none" stroke="hsl(var(--border))" strokeWidth="2" opacity="0.3" />
                <circle cx="48" cy="48" r="44" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="80 200" />
              </svg>
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center"><Zap className="h-8 w-8 text-primary" /></div>
          </div>
          <p className="text-base font-bold text-foreground mb-2" style={{ fontFamily: "'Valorant', sans-serif" }}>
            {paymentMethod === "card" ? "CRIANDO PAGAMENTO" : paymentMethod === "crypto" ? "CRIANDO PAGAMENTO" : "GERANDO PIX"}
          </p>
          <div className="flex flex-col gap-2.5 mt-4 w-full max-w-xs">
            {[{ label: "Validando carrinho", delay: 0 }, { label: "Conectando ao gateway", delay: 0.8 }, { label: "Gerando QR Code", delay: 1.8 }].map((step) => (
              <motion.div key={step.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: step.delay, duration: 0.3 }} className="flex items-center gap-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: step.delay + 0.2, type: "spring", stiffness: 300 }}>
                  <div className="h-5 w-5 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: step.delay + 0.5 }} className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                </motion.div>
                <span className="text-xs text-muted-foreground">{step.label}</span>
              </motion.div>
            ))}
          </div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="text-[10px] text-muted-foreground/50 mt-6 uppercase tracking-widest">
            Isso leva apenas alguns segundos
          </motion.p>
        </motion.div>
      </div>
    );
  }

  /* ── PIX / Card / Crypto payment view ── */
  if (paymentId && (chargeData || cardPaymentUrl || cryptoData)) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-4 pb-20">
          {/* Stepper bar */}
          <div className="flex items-center justify-between mb-6 rounded-lg border border-border bg-card px-4 py-3">
            <img src={logoRoyal} alt="Royal Store" className="h-7 object-contain" />
            <CheckoutStepper currentStep={2} />
            <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground/50">
              <Lock className="h-3.5 w-3.5" /><span className="text-[10px]">SSL 256 bits</span>
            </div>
          </div>

          {/* PIX */}
          {paymentMethod === "pix" && chargeData && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-lg">
                <div className="flex flex-col lg:flex-row min-h-[520px]">
                  {/* Left panel */}
                  <div className="hidden lg:flex flex-col w-[44%] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#32BCAD]/[0.06] via-card to-card" />
                    <div className="relative z-10 flex flex-col h-full p-10 border-r border-border/40">
                      <div className="flex items-center gap-3 mb-10">
                        <img src={logoRoyal} alt="Royal Store" className="h-9 object-contain" />
                        <span className="text-lg font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}>
                          <span className="text-primary">ROYAL</span><span className="text-foreground/80"> STORE</span>
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-1.5" style={{ fontFamily: "'Valorant', sans-serif" }}>
                        PAGUE VIA <span className="text-[#32BCAD]">PIX</span>
                      </h2>
                      <p className="text-[13px] text-muted-foreground mb-10 leading-relaxed">Escaneie o QR Code ou copie o código Pix.</p>
                      <div className="rounded-xl border border-[#32BCAD]/15 bg-[#32BCAD]/[0.04] p-5 mb-6">
                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#32BCAD]/50 mb-2">Valor a pagar</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm text-[#32BCAD]/50 font-medium">R$</span>
                          <span className="text-4xl font-bold text-foreground tracking-tight">{finalPrice.toFixed(2).replace(".", ",")}</span>
                        </div>
                        {displayDiscount > 0 && <p className="text-xs text-muted-foreground/40 line-through mt-1.5">R$ {totalPrice.toFixed(2).replace(".", ",")}</p>}
                      </div>
                      <div className="flex items-center gap-2.5 mb-3"><div className="h-2 w-2 rounded-full bg-[#32BCAD] animate-pulse" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#32BCAD]">Aguardando pagamento</span></div>
                      <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3.5 py-2 w-fit mb-8">
                        <Clock className="h-3 w-3 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground">Expira às <span className="font-semibold text-foreground">{chargeData.expiresAt ? new Date(chargeData.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "30 min"}</span></span>
                      </div>
                      <div className="flex-1" />
                      <div className="flex items-center gap-5 text-muted-foreground/30">
                        <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /><span className="text-[9px] uppercase tracking-wider font-medium">SSL</span></div>
                        <div className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /><span className="text-[9px] uppercase tracking-wider font-medium">Aprovação imediata</span></div>
                      </div>
                    </div>
                  </div>
                  {/* Right panel */}
                  <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-10 lg:py-12">
                    <div className="lg:hidden text-center mb-8">
                      <h2 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Valorant', sans-serif" }}>PAGUE VIA <span className="text-[#32BCAD]">PIX</span></h2>
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-[#32BCAD] animate-pulse" /><span className="text-[10px] font-semibold uppercase tracking-widest text-[#32BCAD]">Aguardando</span></div>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-lg font-bold text-foreground">R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>
                    <div className="flex justify-center mb-8">
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="relative">
                        <div className="absolute -inset-5 rounded-2xl bg-[#32BCAD]/[0.04] blur-2xl" />
                        <div className="relative rounded-2xl border border-border/30 bg-white p-4 shadow-sm">
                          <img src={chargeData.qrCodeImage} alt="QR Code PIX" className="h-52 w-52 sm:h-60 sm:w-60 rounded-xl" />
                        </div>
                      </motion.div>
                    </div>
                    <div className="flex items-center gap-3 mb-5"><div className="flex-1 h-px bg-border/50" /><span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">Copia e Cola</span><div className="flex-1 h-px bg-border/50" /></div>
                    <div className="rounded-xl border border-border/50 bg-background/60 p-4 mb-5">
                      <p className="text-[10px] font-mono text-muted-foreground/60 break-all leading-relaxed select-all line-clamp-3">{chargeData.brCode}</p>
                    </div>
                    <button onClick={copyCode} className={`w-full inline-flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${copied ? "bg-[#32BCAD] text-white" : "bg-[#32BCAD] text-white hover:shadow-[0_0_50px_rgba(50,188,173,0.3)] btn-shine"}`}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Código copiado!" : "Copiar código PIX"}
                    </button>
                    <div className="mt-7 flex items-center justify-center gap-2 text-muted-foreground/30"><Loader2 className="h-3 w-3 animate-spin" /><span className="text-[9px] uppercase tracking-wider font-medium">Confirmação automática ao pagar</span></div>
                    <div className="lg:hidden mt-4 flex justify-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-4 py-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground">Expira às <span className="font-medium text-foreground">{chargeData.expiresAt ? new Date(chargeData.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "30 min"}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Card */}
          {paymentMethod === "card" && cardPaymentUrl && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="hidden md:flex flex-col w-[45%] bg-card border-r border-border/60 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col h-full p-10">
                      <div className="flex items-center gap-3 mb-8"><img src={logoRoyal} alt="Royal Store" className="h-10 object-contain" /><span className="text-xl font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}><span className="text-primary">ROYAL</span><span className="text-foreground"> STORE</span></span></div>
                      <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "'Valorant', sans-serif" }}>PAGAMENTO COM <span className="text-primary">CARTÃO</span></h2>
                      <p className="text-sm text-muted-foreground mb-8">Complete o pagamento na página externa</p>
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-5 mb-6">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70 mb-1">Valor total</p>
                        <div className="flex items-baseline gap-1"><span className="text-sm text-primary/60 font-medium">R$</span><span className="text-3xl font-bold text-foreground tracking-tight">{finalPrice.toFixed(2).replace(".", ",")}</span></div>
                      </div>
                      <div className="flex items-center gap-2 mb-6"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Aguardando pagamento</span></div>
                      <div className="flex-1" />
                      <div className="flex items-center gap-4 text-muted-foreground/40">
                        <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Checkout seguro</span></div>
                        <div className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Entrega automática</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center px-8 md:px-12 py-14">
                    <div className="md:hidden text-center mb-6">
                      <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Valorant', sans-serif" }}>PAGAMENTO COM <span className="text-primary">CARTÃO</span></h2>
                      <div className="flex items-center justify-center gap-2 mb-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Aguardando</span><span className="text-muted-foreground mx-1">·</span><span className="text-lg font-bold text-foreground">R$ {finalPrice.toFixed(2).replace(".", ",")}</span></div>
                    </div>
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 mb-8"><CreditCard className="h-12 w-12 text-primary" /></div>
                    <p className="text-sm text-muted-foreground text-center max-w-xs mb-8">Uma aba foi aberta para completar o pagamento. O status será atualizado automaticamente.</p>
                    <a href={cardPaymentUrl} target="_blank" rel="noopener noreferrer" className="w-full max-w-xs flex items-center justify-center gap-2.5 rounded-md bg-primary py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90" style={{ fontFamily: "'Valorant', sans-serif" }}>
                      <ExternalLink className="h-4 w-4" /> Abrir página de pagamento
                    </a>
                    <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground/40"><Loader2 className="h-3 w-3 animate-spin" /><span className="text-[10px] uppercase tracking-wider">Confirmação automática</span></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Crypto */}
          {paymentMethod === "crypto" && cryptoData && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="hidden md:flex flex-col w-[45%] bg-card border-r border-border/60 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col h-full p-10">
                      <div className="flex items-center gap-3 mb-8"><img src={logoRoyal} alt="Royal Store" className="h-10 object-contain" /><span className="text-xl font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}><span className="text-primary">ROYAL</span><span className="text-foreground"> STORE</span></span></div>
                      <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "'Valorant', sans-serif" }}>PAGAMENTO COM <span className="text-primary">USDT</span></h2>
                      <p className="text-sm text-muted-foreground mb-8">Envie o valor exato via rede {cryptoData.network}</p>
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-5 mb-6">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70 mb-1">Valor total</p>
                        <div className="flex items-baseline gap-1"><span className="text-sm text-primary/60 font-medium">R$</span><span className="text-3xl font-bold text-foreground tracking-tight">{finalPrice.toFixed(2).replace(".", ",")}</span></div>
                        <div className="flex items-baseline gap-1 mt-1"><span className="text-lg font-bold text-primary">{cryptoData.payAmount}</span><span className="text-xs text-primary/70">{cryptoData.payCurrency}</span></div>
                      </div>
                      <div className="flex items-center gap-2 mb-4"><div className="h-2 w-2 rounded-full bg-primary animate-pulse" /><span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Aguardando pagamento</span></div>
                      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-4 py-1.5 w-fit mb-6">
                        <Clock className="h-3 w-3 text-primary/60" />
                        <span className="text-[11px] text-muted-foreground">Expira às <span className="font-medium text-foreground">{cryptoData.expiresAt ? new Date(cryptoData.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "30 min"}</span></span>
                      </div>
                      <div className="flex-1" />
                      <div className="flex items-center gap-4 text-muted-foreground/40">
                        <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">SSL</span></div>
                        <div className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Aprovação imediata</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center px-8 md:px-12 py-10">
                    <div className="md:hidden text-center mb-6">
                      <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Valorant', sans-serif" }}>PAGAMENTO COM <span className="text-primary">USDT</span></h2>
                      <div className="flex items-center justify-center gap-2 mb-2"><div className="h-2 w-2 rounded-full bg-primary animate-pulse" /><span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Aguardando</span><span className="text-muted-foreground mx-1">·</span><span className="text-lg font-bold text-foreground">R$ {finalPrice.toFixed(2).replace(".", ",")}</span></div>
                    </div>
                    {cryptoData.qrCode && (
                      <div className="flex justify-center mb-8">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="relative">
                          <div className="absolute -inset-4 rounded-lg bg-primary/5 blur-xl" />
                          <div className="relative rounded-lg border border-primary/15 bg-white p-4"><img src={cryptoData.qrCode} alt="QR Code USDT" className="h-52 w-52 sm:h-60 sm:w-60 rounded-md" /></div>
                        </motion.div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-5"><div className="flex-1 h-px bg-border" /><span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">Endereço {cryptoData.network}</span><div className="flex-1 h-px bg-border" /></div>
                    <div className="rounded-md border border-border bg-background/60 p-3.5 mb-4"><p className="text-[11px] font-mono text-muted-foreground break-all leading-relaxed select-all">{cryptoData.address}</p></div>
                    <button onClick={() => { navigator.clipboard.writeText(cryptoData.address); setCopied(true); setTimeout(() => setCopied(false), 2000); toast({ title: "Endereço copiado!" }); }} className={`w-full inline-flex items-center justify-center gap-2.5 rounded-md py-3 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${copied ? "bg-primary text-primary-foreground" : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"}`}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Endereço copiado!" : "Copiar endereço"}
                    </button>
                    <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground/40"><Loader2 className="h-3 w-3 animate-spin" /><span className="text-[10px] uppercase tracking-wider">Confirmação automática</span></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     MAIN CHECKOUT VIEW — 2 Column layout
     ═══════════════════════════════════════════════════════ */
  const firstItem = items[0];
  const productImage = firstItem?.productImage;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] bg-primary/[0.03] blur-[120px] rounded-full" />

      <Header />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-20">
        {/* ── Checkout Header Bar ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6 rounded-lg border border-border bg-card px-4 py-3">
          <img src={logoRoyal} alt="Royal Store" className="h-7 object-contain" />
          <CheckoutStepper currentStep={currentStep} />
          <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-medium text-emerald-500">Pagamento seguro — SSL 256 bits</span>
          </div>
          <div className="sm:hidden flex items-center gap-1 text-emerald-500">
            <Lock className="h-3.5 w-3.5" />
          </div>
        </motion.div>

        {/* Back button */}
        <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary group">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Voltar
        </motion.button>

        {/* ── 2 Column Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ═══ LEFT COLUMN (2/3) ═══ */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── Payment Method Selection ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold text-foreground mb-1">Forma de pagamento</h2>
              <p className="text-xs text-muted-foreground mb-5">Selecione como deseja pagar</p>

              {!enabledMethods && (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Carregando métodos de pagamento...</span>
                </div>
              )}

              {enabledMethods && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* PIX */}
                  {enabledMethods.pix !== false && (
                    <button
                      onClick={() => setPaymentMethod("pix")}
                      className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                        paymentMethod === "pix"
                          ? "border-[#32BCAD] bg-[#32BCAD]/5 shadow-[0_0_20px_rgba(50,188,173,0.15)]"
                          : "border-border hover:border-[#32BCAD]/40 hover:bg-[#32BCAD]/[0.02]"
                      }`}
                    >
                      <PixIcon className={`h-7 w-7 ${paymentMethod === "pix" ? "text-[#32BCAD]" : "text-muted-foreground group-hover:text-[#32BCAD]"}`} />
                      <span className={`text-sm font-bold ${paymentMethod === "pix" ? "text-[#32BCAD]" : "text-foreground"}`}>PIX</span>
                      <span className="text-[10px] text-muted-foreground">Instantâneo</span>
                    </button>
                  )}

                  {/* Card */}
                  {enabledMethods.card !== false && !hasLztItems && (
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                        paymentMethod === "card"
                          ? "border-primary bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                          : "border-border hover:border-primary/40 hover:bg-primary/[0.02]"
                      }`}
                    >
                      <CreditCard className={`h-7 w-7 ${paymentMethod === "card" ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                      <span className={`text-sm font-bold ${paymentMethod === "card" ? "text-primary" : "text-foreground"}`}>Cartão</span>
                      <span className="text-[10px] text-muted-foreground">Visa, Master, Elo</span>
                    </button>
                  )}

                  {/* Crypto */}
                  {enabledMethods.crypto !== false && (
                    <button
                      onClick={() => setPaymentMethod("crypto")}
                      className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                        paymentMethod === "crypto"
                          ? "border-primary bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                          : "border-border hover:border-primary/40 hover:bg-primary/[0.02]"
                      }`}
                    >
                      <Wallet className={`h-7 w-7 ${paymentMethod === "crypto" ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                      <span className={`text-sm font-bold ${paymentMethod === "crypto" ? "text-primary" : "text-foreground"}`}>USDT</span>
                      <span className="text-[10px] text-muted-foreground">TRC20</span>
                    </button>
                  )}

                  {/* Disabled methods */}
                  <button disabled className="flex flex-col items-center gap-2 rounded-lg border-2 border-border p-4 opacity-40 cursor-not-allowed">
                    <span className="text-xs font-bold text-muted-foreground">Binance Pay</span>
                    <span className="text-[10px] text-muted-foreground">Em breve</span>
                  </button>
                  <button disabled className="flex flex-col items-center gap-2 rounded-lg border-2 border-border p-4 opacity-40 cursor-not-allowed">
                    <span className="text-xs font-bold text-muted-foreground">PicPay</span>
                    <span className="text-[10px] text-muted-foreground">Em breve</span>
                  </button>
                </div>
              )}

              {/* Info box for selected method */}
              {paymentMethod && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 rounded-lg border border-border bg-background/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {paymentMethod === "pix" && "💳 Pagamento via PIX com aprovação instantânea. O QR Code será gerado automaticamente."}
                    {paymentMethod === "card" && "💳 Você será redirecionado para uma página segura para concluir o pagamento com cartão."}
                    {paymentMethod === "crypto" && "💳 Envie USDT via rede TRC20. O endereço será gerado automaticamente."}
                  </p>
                </motion.div>
              )}
            </motion.div>

            {/* ── Buyer Information Form ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold text-foreground mb-1">Informações do comprador</h2>
              <p className="text-xs text-muted-foreground mb-5">Preencha seus dados para emissão e entrega</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nome completo</label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                      placeholder="Nome e sobrenome"
                      className={`h-11 bg-background pr-9 ${
                        touched.name ? (nameValid ? "border-emerald-500 focus-visible:ring-emerald-500/50" : "border-amber-500 focus-visible:ring-amber-500/50") : ""
                      }`}
                    />
                    {touched.name && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {nameValid ? <Check className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                      </div>
                    )}
                  </div>
                  {touched.name && !nameValid && <p className="text-[11px] text-amber-500">Informe nome e sobrenome (mín. 3 caracteres)</p>}
                </div>

                {/* CPF */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-foreground">CPF</label>
                    {touched.document && cpfValid && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                        <Check className="h-3 w-3" /> Válido
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type="text"
                      value={formData.document}
                      onChange={(e) => setFormData((p) => ({ ...p, document: applyCpfMask(e.target.value) }))}
                      onBlur={() => setTouched((p) => ({ ...p, document: true }))}
                      placeholder="000.000.000-00"
                      className={`h-11 bg-background pr-9 ${
                        touched.document && cpfComplete ? (cpfValid ? "border-emerald-500 focus-visible:ring-emerald-500/50" : "border-amber-500 focus-visible:ring-amber-500/50") : ""
                      }`}
                    />
                    {touched.document && cpfComplete && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {cpfValid ? <Check className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                      </div>
                    )}
                  </div>
                  {touched.document && cpfComplete && !cpfValid && <p className="text-[11px] text-amber-500">CPF inválido — verifique os dígitos</p>}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">E-mail</label>
                  <div className="relative">
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                      placeholder="email@exemplo.com"
                      className={`h-11 bg-background pr-9 ${
                        touched.email ? (emailValid ? "border-emerald-500 focus-visible:ring-emerald-500/50" : "border-amber-500 focus-visible:ring-amber-500/50") : ""
                      }`}
                    />
                    {touched.email && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {emailValid ? <Check className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                      </div>
                    )}
                  </div>
                  {touched.email && !emailValid && <p className="text-[11px] text-amber-500">Informe um e-mail válido</p>}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Telefone <span className="text-muted-foreground font-normal">(WhatsApp)</span></label>
                  <div className="relative">
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: applyPhoneMask(e.target.value) }))}
                      onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                      placeholder="(00) 00000-0000"
                      className={`h-11 bg-background pr-9 ${
                        touched.phone ? (phoneValid ? "border-emerald-500 focus-visible:ring-emerald-500/50" : "border-amber-500 focus-visible:ring-amber-500/50") : ""
                      }`}
                    />
                    {touched.phone && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {phoneValid ? <Check className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                      </div>
                    )}
                  </div>
                  {touched.phone && !phoneValid && <p className="text-[11px] text-amber-500">Informe um número válido com DDD</p>}
                </div>
              </div>

              {/* Security microcopy */}
              <div className="mt-5 flex items-center gap-2 text-muted-foreground/50">
                <Lock className="h-3.5 w-3.5" />
                <span className="text-[11px]">Seus dados estão protegidos com criptografia de ponta a ponta</span>
              </div>
            </motion.div>
          </div>

          {/* ═══ RIGHT COLUMN (1/3) — Order Summary ═══ */}
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:sticky lg:top-24 space-y-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-4">Resumo do pedido</h3>

                {/* Product */}
                {firstItem && (
                  <div className="flex gap-3 mb-4 pb-4 border-b border-border">
                    <div className="h-16 w-16 rounded-lg bg-secondary border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {productImage ? (
                        <img src={productImage} alt={firstItem.productName} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{firstItem.productName}</p>
                      <p className="text-xs text-muted-foreground truncate">{firstItem.planName}</p>
                      {items.length > 1 && <p className="text-[10px] text-muted-foreground mt-1">+ {items.length - 1} item(ns)</p>}
                    </div>
                  </div>
                )}

                {/* Coupon */}
                {!couponApplied ? (
                  <div className="mb-4 pb-4 border-b border-border">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Cupom de desconto</label>
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                        placeholder="CÓDIGO"
                        className="h-9 bg-background text-xs uppercase"
                      />
                      <Button onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()} size="sm" variant="outline" className="h-9 px-3 text-xs whitespace-nowrap">
                        {couponLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
                      </Button>
                    </div>
                    {couponError && <p className="text-[11px] text-destructive mt-1.5">{couponError}</p>}
                  </div>
                ) : (
                  <div className="mb-4 pb-4 border-b border-border">
                    <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-500">{couponApplied.code}</span>
                      </div>
                      <button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Price breakdown */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">R$ {safeCartTotal.toFixed(2).replace(".", ",")}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-500">Desconto</span>
                      <span className="text-emerald-500">- R$ {discountAmount.toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-foreground">Total</span>
                    <div className="text-right">
                      {discountAmount > 0 && <p className="text-xs text-muted-foreground line-through">R$ {safeCartTotal.toFixed(2).replace(".", ",")}</p>}
                      <p className="text-2xl font-bold text-primary">R$ {cartFinalPrice.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => {
                    if (!paymentMethod) {
                      toast({ title: "Selecione um método de pagamento", variant: "destructive" });
                      return;
                    }
                    handleSelectMethod(paymentMethod);
                  }}
                  disabled={!formValid || !paymentMethod || !enabledMethods || loading}
                  className="w-full h-12 text-sm font-bold uppercase tracking-wider gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Finalizar Pedido R$ {cartFinalPrice.toFixed(2).replace(".", ",")}
                    </>
                  )}
                </Button>

                {!formValid && enabledMethods && (
                  <p className="text-center text-[11px] text-destructive mt-2">Preencha todos os campos corretamente</p>
                )}

                {/* Trust badges */}
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { icon: ShieldCheck, label: "Pagamento seguro" },
                    { icon: Zap, label: "Entrega instantânea" },
                    { icon: Sparkles, label: "Suporte 24h" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background/50 p-2.5">
                      <Icon className="h-4 w-4 text-muted-foreground/50" />
                      <span className="text-[9px] text-center text-muted-foreground/60 leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
