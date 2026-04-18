import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ChevronRight, Package } from "lucide-react";
import Header from "@/components/Header";
import { trackPurchase } from "@/lib/metaPixel";
import { normalizeGameSlug } from "@/lib/gameSlug";

type PurchasePayload = {
  contentName: string;
  contentIds: string[];
  contents: { id: string; quantity: number }[];
  value: number;
  contentCategory?: string;
  section?: "contas" | "produtos" | "multi";
};

function readPendingPurchasePayload(paymentId: string): PurchasePayload | null {
  try {
    const raw = sessionStorage.getItem(`pending_purchase_${paymentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PurchasePayload>;
    if (!parsed || !Array.isArray(parsed.contentIds) || parsed.contentIds.length === 0) return null;
    if (!Array.isArray(parsed.contents)) return null;
    if (typeof parsed.contentName !== "string" || parsed.contentName.length === 0) return null;
    const value = Number(parsed.value);
    if (!Number.isFinite(value) || value < 0) return null;
    return {
      contentName: parsed.contentName,
      contentIds: parsed.contentIds.map((v) => String(v)).filter(Boolean),
      contents: parsed.contents.map((c) => ({
        id: String(c.id || ""),
        quantity: Math.max(1, Math.floor(Number(c.quantity) || 1)),
      })).filter((c) => c.id.length > 0),
      value,
      ...(parsed.section === "contas" || parsed.section === "produtos" || parsed.section === "multi"
        ? { section: parsed.section }
        : {}),
      ...(typeof parsed.contentCategory === "string" && parsed.contentCategory ? { contentCategory: parsed.contentCategory } : {}),
    };
  } catch {
    return null;
  }
}

const PedidoSucesso = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paymentId = searchParams.get("payment_id") || "";
  const gameParam = (searchParams.get("game") || "").trim();
  const sectionParam = (searchParams.get("section") || "").trim();
  const ticketId = (searchParams.get("ticket_id") || "").trim();

  const fallbackCategory = useMemo(() => {
    const normalized = normalizeGameSlug(gameParam);
    if (!normalized || normalized === "produto" || normalized === "multi") return undefined;
    return normalized;
  }, [gameParam]);

  const fallbackSection = useMemo(() => {
    if (sectionParam === "contas" || sectionParam === "produtos" || sectionParam === "multi") {
      return sectionParam;
    }
    return undefined;
  }, [sectionParam]);

  useEffect(() => {
    if (!paymentId) return;
    const payload = readPendingPurchasePayload(paymentId);
    if (!payload) return;
    trackPurchase({
      ...payload,
      ...(payload.contentCategory ? {} : fallbackCategory ? { contentCategory: fallbackCategory } : {}),
      ...(payload.section ? {} : fallbackSection ? { section: fallbackSection } : {}),
      transactionId: paymentId,
    });
  }, [paymentId, fallbackCategory, fallbackSection]);

  return (
    <div className="min-h-dvh bg-background">
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
          <p className="text-sm text-muted-foreground mb-3 max-w-md mx-auto">
            Seus produtos ja estao disponiveis. Obrigado por comprar na Royal Store!
          </p>
          {gameParam && (
            <p className="text-xs text-muted-foreground mb-10">
              Categoria da compra: <span className="font-semibold text-foreground">{gameParam}</span>
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => (ticketId ? navigate(`/pedido/${ticketId}`) : navigate("/dashboard?tab=purchases"))}
              className="group inline-flex items-center justify-center gap-2.5 rounded-md bg-emerald-500 px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-emerald-600"
            >
              <Package className="h-4 w-4" /> {ticketId ? "Abrir Pedido" : "Meus Pedidos"}{" "}
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => navigate("/produtos")}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-8 py-3.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-card"
            >
              Continuar comprando
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PedidoSucesso;
