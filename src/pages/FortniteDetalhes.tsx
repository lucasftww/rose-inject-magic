import { useParams, useNavigate } from "react-router-dom";
import { throwApiError } from "@/lib/apiErrors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, Shield, ShoppingCart, X, Zap, Gift,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { trackViewContent, trackInitiateCheckout } from "@/lib/metaPixel";
import { checkLztAvailability } from "@/lib/lztAvailability";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { getLztDetailDisplayTitle } from "@/lib/lztDisplayTitles";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import type { LztFortniteCosmeticEntry, LztFortniteItemExtras } from "@/types/lztGameDetailExtras";
import { lztItemAsFortniteExtras } from "@/lib/lztMergedItemExtras";
import { hideImgOnError, setImgOpacityOnError, withHTMLElementTarget } from "@/lib/domEventHelpers";
import { errorMessage } from "@/lib/errorMessage";

const getProxiedImageUrl = (url: string) => {
  if (!url) return "";
  if (url.includes("lzt.market") || url.includes("img.lzt.market")) {
    return `${supabaseUrl}/functions/v1/lzt-market?action=image-proxy&url=${encodeURIComponent(url)}`;
  }
  return url;
};

const FN_PURPLE = "hsl(265,80%,65%)";
const FN_BLUE = "hsl(210,100%,56%)";

const fetchAccountDetail = async (itemId: string) => {
  const res = await fetch(
    `${supabaseUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=fortnite`,
    { headers: { "Content-Type": "application/json", apikey: supabaseAnonKey } }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 410) {
      throw new Error(body?.error === "Account already sold" ? "Esta conta já foi vendida." : "Esta conta não está mais disponível.");
    }
    throwApiError(res.status);
  }
  return res.json();
};

// Fetch all Fortnite cosmetics (outfits, pickaxes, emotes, gliders) from fortnite-api.com
const fetchFortniteCosmetics = async (): Promise<Map<string, { name: string; image: string; rarity: string }>> => {
  try {
    // Use /v2/cosmetics/br which covers ALL types: outfits, pickaxes, emotes, gliders, backpacks
    const res = await fetch("https://fortnite-api.com/v2/cosmetics/br?language=pt-BR");
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();
    const map = new Map<string, { name: string; image: string; rarity: string }>();
    for (const item of (data.data || [])) {
      const image = item.images?.smallIcon || item.images?.icon || item.images?.featured;
      if (image && item.id) {
        map.set(item.id.toLowerCase(), {
          name: item.name || item.id,
          image,
          rarity: item.rarity?.displayValue || item.rarity?.value || "",
        });
      }
    }
    return map;
  } catch {
    return new Map();
  }
};

interface CosmeticPreview {
  id: string;
  name: string;
  image: string;
  rarity: string;
}

const rarityColors: Record<string, string> = {
  "common": "#b0b0b0",
  "uncommon": "#56cc44",
  "rare": "#4e9de5",
  "epic": "#9d48e0",
  "legendary": "#e5a124",
  "superrare": "#e5a124",
  "mythic": "#f0d030",
};

const getRarityColor = (rarity: string): string =>
  rarityColors[rarity?.toLowerCase() ?? ""] ?? "#b0b0b0";

type InventoryTab = "skins" | "pickaxes" | "dances" | "gliders";

const FortniteDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPrice, getDisplayPrice } = useLztMarkup();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTab>("skins");
  const { addItem } = useCart();
  const queryClient = useQueryClient();

  // Reset state when navigating between accounts
  useEffect(() => {
    setSelectedIndex(0);
    setLightboxIndex(null);
    setActiveTab("skins");
  }, [id]);

  const { data, isLoading, error } = useQuery({
    queryKey: lztAccountDetailQueryKey("fortnite", id ?? ""),
    queryFn: () => fetchAccountDetail(id!),
    enabled: !!id,
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });

  const { data: cosmeticsDb = new Map() } = useQuery({
    queryKey: ["fortnite-cosmetics"],
    queryFn: fetchFortniteCosmetics,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const item = data?.item;
  const raw: LztFortniteItemExtras | undefined = lztItemAsFortniteExtras(item);

  // Build preview list from a cosmetics array (fortniteSkins, fortnitePickaxe, etc.)
  const buildPreviews = useCallback((arr: LztFortniteCosmeticEntry[], skipDefault = true): CosmeticPreview[] => {
    const results: CosmeticPreview[] = [];
    for (const c of (arr || [])) {
      if (skipDefault && (c.id === "defaultpickaxe" || c.id === "defaultglider")) continue;
      const found = cosmeticsDb.get(String(c.id).toLowerCase());
      results.push({
        id: c.id,
        name: found?.name || c.title || c.id,
        image: found?.image || `https://fortnite-api.com/images/cosmetics/br/${String(c.id).toLowerCase()}/smallicon.png`,
        rarity: found?.rarity || c.rarity || "",
      });
    }
    return results;
  }, [cosmeticsDb]);

  const skinPreviews = useMemo(() => buildPreviews(raw?.fortniteSkins || []), [raw?.fortniteSkins, buildPreviews]);
  const pickaxePreviews = useMemo(() => buildPreviews(raw?.fortnitePickaxe || []), [raw?.fortnitePickaxe, buildPreviews]);
  const dancePreviews = useMemo(() => buildPreviews(raw?.fortniteDance || []), [raw?.fortniteDance, buildPreviews]);
  const gliderPreviews = useMemo(() => buildPreviews(raw?.fortniteGliders || []), [raw?.fortniteGliders, buildPreviews]);

  const tabPreviews: Record<InventoryTab, CosmeticPreview[]> = {
    skins: skinPreviews,
    pickaxes: pickaxePreviews,
    dances: dancePreviews,
    gliders: gliderPreviews,
  };

  const currentPreviews = tabPreviews[activeTab];

  const vbucks = (raw?.fortnite_balance || raw?.fortnite_vbucks) ?? 0;
  const skinCount = raw?.fortnite_skin_count ?? 0;
  const level = raw?.fortnite_level ?? 0;

  const cleanedTitle = useMemo(
    () =>
      getLztDetailDisplayTitle(item?.title, {
        game: "fortnite",
        skinCount: raw?.fortnite_skin_count ?? raw?.fortnite_outfit_count ?? 0,
        level: raw?.fortnite_level ?? 0,
        vbucks: raw?.fortnite_balance ?? raw?.fortnite_vbucks ?? 0,
      }),
    [
      item?.title,
      raw?.fortnite_skin_count,
      raw?.fortnite_outfit_count,
      raw?.fortnite_level,
      raw?.fortnite_balance,
      raw?.fortnite_vbucks,
    ],
  );

  // Gallery uses skins, fallback to pickaxes
  const galleryPreviews = skinPreviews.length > 0 ? skinPreviews : pickaxePreviews;

  // ViewContent tracking
  const viewTracked = useRef(false);
  useEffect(() => {
    viewTracked.current = false;
  }, [id]);
  useEffect(() => {
    if (item && !viewTracked.current) {
      viewTracked.current = true;
      const priceBRL = getPrice(item, "fortnite");
      trackViewContent({
        contentName: cleanedTitle,
        contentIds: [`lzt-fn-${item.item_id}`],
        value: priceBRL,
      });
    }
  }, [item, getPrice, cleanedTitle]);

  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const handleBuyNow = async () => {
    if (!item || checkingAvailability) return;
    setCheckingAvailability(true);
    const available = await checkLztAvailability(String(item.item_id), "fortnite", { queryClient });
    setCheckingAvailability(false);
    if (!available) return;
    const priceBRL = getPrice(item, "fortnite");

    trackInitiateCheckout({
      contentName: cleanedTitle,
      contentIds: [`lzt-fn-${item.item_id}`],
      value: priceBRL,
    });

    const added = addItem({
      productId: `lzt-fn-${item.item_id}`,
      productName: cleanedTitle,
      productImage: null,
      planId: "lzt-fn-account",
      planName: "Conta Fortnite",
      price: priceBRL,
      type: "lzt-account",
      lztItemId: String(item.item_id),
      lztPrice: item.price,
      lztCurrency: item.price_currency || "rub",
      lztGame: "fortnite",
      skinsCount: skinCount,
    });
    if (added) navigate("/checkout");
  };

  const tabs: { id: InventoryTab; label: string; count: number }[] = [
    { id: "skins", label: "Skins", count: skinPreviews.length },
    { id: "pickaxes", label: "Picaretas", count: pickaxePreviews.length },
    { id: "dances", label: "Danças", count: dancePreviews.length },
    { id: "gliders", label: "Planadores", count: gliderPreviews.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-28 sm:pb-20">
        <button
          onClick={() => navigate("/contas?game=fortnite")}
          className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-all hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Contas Fortnite
        </button>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: FN_PURPLE }} />
            <p className="mt-3 text-sm text-muted-foreground">Carregando conta...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-lg font-semibold text-destructive">Erro ao carregar conta</p>
            <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
          </div>
        )}

        {item && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {/* Breadcrumb */}
            <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Início</button>
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => navigate("/contas")} className="hover:text-foreground transition-colors">Contas</button>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: FN_PURPLE }} className="font-medium">Fortnite #{item.item_id}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* LEFT: Gallery */}
              <div className="lg:col-span-3 space-y-4">
                {galleryPreviews.length > 0 ? (
                  <div className="rounded-lg border border-border bg-card overflow-hidden aspect-square sm:aspect-video relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(265,40%,8%)] to-[hsl(210,40%,12%)]" />
                    <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${FN_PURPLE}20, transparent 70%)` }} />

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedIndex}
                        className="relative z-[1] flex items-center justify-center h-full w-full cursor-pointer overflow-hidden p-6"
                        onClick={() => setLightboxIndex(selectedIndex)}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <img
                          src={getProxiedImageUrl(galleryPreviews[selectedIndex].image)}
                          alt={galleryPreviews[selectedIndex].name}
                          className="relative z-[1] h-full w-auto max-w-full object-contain drop-shadow-2xl"
                          onError={(e) => setImgOpacityOnError(e, "0.2")}
                        />
                      </motion.div>
                    </AnimatePresence>

                    {galleryPreviews.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedIndex(p => (p - 1 + galleryPreviews.length) % galleryPreviews.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setSelectedIndex(p => (p + 1) % galleryPreviews.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}

                    {/* Name badge */}
                    <div className="absolute top-3 left-3 z-[2] rounded-lg bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5">
                      <p className="text-xs font-semibold text-foreground">{galleryPreviews[selectedIndex].name}</p>
                      {galleryPreviews[selectedIndex].rarity && (
                        <p className="text-[10px]" style={{ color: getRarityColor(galleryPreviews[selectedIndex].rarity) }}>
                          {galleryPreviews[selectedIndex].rarity}
                        </p>
                      )}
                    </div>

                    {/* Counter */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[2] rounded-lg bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{selectedIndex + 1} / {galleryPreviews.length}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card flex items-center justify-center aspect-video">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-muted-foreground">Sem itens para exibir</p>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Informações da Conta</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {skinCount > 0 && <StatCell label="Skins" value={skinCount} color={FN_PURPLE} />}
                    {vbucks > 0 && <StatCell label="V-Bucks" value={vbucks.toLocaleString()} color={FN_BLUE} />}
                    {level > 0 && <StatCell label="Nível" value={level} color={FN_PURPLE} />}
                    {pickaxePreviews.length > 0 && <StatCell label="Picaretas" value={pickaxePreviews.length} color={FN_PURPLE} />}
                    {dancePreviews.length > 0 && <StatCell label="Danças" value={dancePreviews.length} color={FN_PURPLE} />}
                    {gliderPreviews.length > 0 && <StatCell label="Planadores" value={gliderPreviews.length} color={FN_PURPLE} />}
                  </div>
                </div>
              </div>

              {/* RIGHT: Purchase card */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-lg border bg-card p-5 space-y-3.5" style={{ borderColor: `${FN_PURPLE}40` }}>
                  <h1 className="text-lg font-bold text-foreground leading-snug">
                    {cleanedTitle}
                  </h1>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-positive/10 border border-positive/30 px-3 py-1 text-[11px] font-semibold text-positive">
                      <CheckCircle2 className="h-3 w-3" />
                      FULL ACESSO
                    </span>
                    {vbucks > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: FN_BLUE, borderColor: `${FN_BLUE}40`, background: `${FN_BLUE}15` }}>
                        <Gift className="h-3 w-3" />
                        {vbucks} V-Bucks
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      Conta verificável
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2"><span className="font-bold" style={{ color: FN_PURPLE }}>✓</span> Entrega automática</p>
                    <p className="flex items-center gap-2"><span className="font-bold" style={{ color: FN_PURPLE }}>✓</span> Liberação instantânea</p>
                    <p className="flex items-center gap-2"><span className="font-bold" style={{ color: FN_PURPLE }}>✓</span> Email e senha inclusos</p>
                  </div>

                  <div className="rounded-lg bg-card border border-border p-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Por</p>
                      <p className="text-2xl font-bold" style={{ color: FN_PURPLE }}>{getDisplayPrice(item, "fortnite")}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={checkingAvailability}
                    aria-busy={checkingAvailability}
                    className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-positive py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-positive-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                  >
                    {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {checkingAvailability ? "VERIFICANDO..." : "COMPRAR AGORA"}
                  </button>

                  {item.item_id && (
                    <p className="text-[10px] text-muted-foreground/50 text-center break-all">Código: {item.item_id}</p>
                  )}

                  <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg overflow-hidden">
                    <StatHighlight label="Skins" value={skinCount} color={FN_PURPLE} />
                    <StatHighlight label="V-Bucks" value={vbucks > 0 ? vbucks.toLocaleString() : "—"} color={FN_BLUE} />
                    <StatHighlight label="Nível" value={level > 0 ? level : "—"} color={FN_PURPLE} />
                  </div>
                </div>

                {/* Full Access info */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="h-8 w-8 flex-shrink-0" fill={FN_PURPLE} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m15.767 14.171.097-5.05H12.4V5.197h3.99L16.872 0H7.128v24l5.271-.985V14.17z"/></svg>
                    <h3 className="text-xl font-bold text-foreground">Conta FULL ACESSO</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2.5"><span style={{ color: FN_PURPLE }}>•</span> Email e senha inclusos</li>
                    <li className="flex items-center gap-2.5"><span style={{ color: FN_PURPLE }}>•</span> Senha alterável</li>
                    <li className="flex items-center gap-2.5"><span style={{ color: FN_PURPLE }}>•</span> Conta verificável</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ─── Inventory Tabs ─── */}
            <div className="mt-8">
              {/* Tab bar */}
              <div className="flex items-center gap-1 mb-5 border-b border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setSelectedIndex(0); }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? "border-[hsl(265,80%,65%)] text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          background: activeTab === tab.id ? `${FN_PURPLE}25` : "hsl(var(--secondary))",
                          color: activeTab === tab.id ? FN_PURPLE : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Item grid */}
              {currentPreviews.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {currentPreviews.map((cosmetic, i) => (
                    <motion.div
                      key={`${cosmetic.id}-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.008 }}
                      className="group rounded-lg border border-border bg-card overflow-hidden cursor-pointer transition-all hover:shadow-md"
                      style={{ "--hover-border": `${FN_PURPLE}40` } as CSSProperties}
                      onMouseEnter={(e) =>
                        withHTMLElementTarget(e, (el) => {
                          el.style.borderColor = `${FN_PURPLE}50`;
                        })
                      }
                      onMouseLeave={(e) =>
                        withHTMLElementTarget(e, (el) => {
                          el.style.borderColor = "";
                        })
                      }
                      onClick={() => {
                        setActiveTab(activeTab);
                        setLightboxIndex(i);
                      }}
                    >
                      <div className="aspect-square bg-secondary/20 overflow-hidden p-1 relative">
                        {/* Rarity glow */}
                        <div
                          className="absolute inset-0 opacity-10"
                          style={{ background: getRarityColor(cosmetic.rarity) }}
                        />
                        <img
                          src={getProxiedImageUrl(cosmetic.image)}
                          alt={cosmetic.name}
                          className="relative z-[1] h-full w-full object-contain group-hover:scale-110 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => setImgOpacityOnError(e, "0.2")}
                        />
                      </div>
                      <div className="p-1.5 border-t border-border">
                        <p className="text-[9px] font-medium text-foreground truncate leading-tight">{cosmetic.name}</p>
                        {cosmetic.rarity && (
                          <p className="text-[8px] truncate" style={{ color: getRarityColor(cosmetic.rarity) }}>
                            {cosmetic.rarity}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">Nenhum item nesta categoria</p>
                </div>
              )}
            </div>

            {/* Lightbox */}
            <AnimatePresence>
              {lightboxIndex !== null && currentPreviews[lightboxIndex] && (() => {
                const cur = currentPreviews[lightboxIndex];
                const total = currentPreviews.length;
                const goPrev = () => setLightboxIndex(p => p !== null ? (p - 1 + total) % total : null);
                const goNext = () => setLightboxIndex(p => p !== null ? (p + 1) % total : null);
                return (
                  <motion.div
                    key="fn-lightbox"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
                    onClick={() => setLightboxIndex(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setLightboxIndex(null);
                      if (e.key === "ArrowLeft") goPrev();
                      if (e.key === "ArrowRight") goNext();
                    }}
                    tabIndex={0}
                    ref={(el) => { el?.focus(); }}
                  >
                    <motion.div
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.92, opacity: 0 }}
                      className="relative bg-card border border-border rounded-xl w-[90vw] max-w-sm overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button onClick={() => setLightboxIndex(null)} className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                      </button>
                      <div
                        className="relative aspect-square overflow-hidden p-6"
                        style={{ background: `linear-gradient(135deg, hsl(265,40%,8%), hsl(210,40%,12%))` }}
                      >
                        <div
                          className="absolute inset-0 opacity-20"
                          style={{ background: `radial-gradient(ellipse at center, ${getRarityColor(cur.rarity)}, transparent 70%)` }}
                        />
                        <img src={getProxiedImageUrl(cur.image)} alt={cur.name} className="relative z-[1] h-full w-full object-contain drop-shadow-2xl" />
                      </div>
                      <div className="p-4 flex flex-col items-center gap-3">
                        <div className="text-center">
                          <h3 className="text-base font-bold text-foreground">{cur.name}</h3>
                          {cur.rarity && (
                            <p className="text-xs font-semibold" style={{ color: getRarityColor(cur.rarity) }}>
                              {cur.rarity}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={goPrev} className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-sm text-muted-foreground tabular-nums">{lightboxIndex + 1}/{total}</span>
                          <button onClick={goNext} className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">ESC para fechar</p>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Description */}
            {item.description && (() => {
              const raw = String(item.description).trim();
              const stripped = raw.replace(/\[URL=[^\]]*\][^\[]*\[\/URL\]/gi, "").replace(/\[\/?\w+\]/g, "").replace(/https?:\/\/\S+/g, "").trim();
              if (stripped.length < 10) return null;
              return (
                <div className="mt-6 rounded-lg border border-border bg-card p-5">
                  <h3 className="text-sm font-bold text-foreground mb-2">Descrição</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{stripped}</p>
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>

      {/* Sticky mobile bottom bar */}
      {item && (
        <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
          <div className="border-t border-border bg-card/95 backdrop-blur-xl px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-lg font-bold leading-tight" style={{ color: FN_PURPLE }}>
                  {getDisplayPrice(item, "fortnite")}
                </span>
              </div>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={checkingAvailability}
                aria-busy={checkingAvailability}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider text-white transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: FN_PURPLE, fontFamily: "'Valorant', sans-serif" }}
              >
                {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                {checkingAvailability ? "Verificando..." : "Comprar Agora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCell = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <div className="flex flex-col gap-0.5 rounded-lg bg-secondary/40 px-3 py-2.5">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className="text-base font-bold" style={{ color }}>{value}</span>
  </div>
);

const StatHighlight = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <div className="flex flex-col items-center justify-center py-3 px-2">
    <span className="text-base font-bold" style={{ color }}>{value}</span>
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </div>
);

export default FortniteDetalhes;
