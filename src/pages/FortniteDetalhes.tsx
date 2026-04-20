import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, Shield, ShoppingCart, X, Zap, Gift, Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useCallback, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { checkLztAvailability } from "@/lib/lztAvailability";
import { fetchLztAccountDetail, LZT_ACCOUNT_DETAIL_STALE_MS } from "@/lib/lztAccountDetailFetch";
import { getLztDetailDisplayTitle } from "@/lib/lztDisplayTitles";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import type { LztFortniteCosmeticEntry, LztFortniteItemExtras } from "@/types/lztGameDetailExtras";
import { lztItemAsFortniteExtras } from "@/lib/lztMergedItemExtras";
import { hideImgOnError, setImgOpacityOnError, withHTMLElementTarget } from "@/lib/domEventHelpers";
import { errorMessage } from "@/lib/errorMessage";
import { getProxiedImageUrl, cleanLztDescription } from "@/lib/lztImageProxy";
import { compareFortniteCardRows } from "@/lib/fortniteCosmeticSort";
import { fetchFortniteCosmeticsBrMap } from "@/lib/fortniteCosmeticsFetch";

const FN_PURPLE = "hsl(265,80%,65%)";
const FN_BLUE = "hsl(210,100%,56%)";

interface CosmeticPreview {
  id: string;
  name: string;
  image: string;
  rarity: string;
  rarityValue: string;
  ageKey: number;
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
  const { getPrice, getDisplayPrice, formatPriceBrl } = useLztMarkup();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTab>("skins");
  const [inventorySearch, setInventorySearch] = useState("");
  const { addItem } = useCart();
  const queryClient = useQueryClient();

  // Price lock: prevents silent price changes from background React Query refetches
  const [lockedPriceBrl, setLockedPriceBrl] = useState<number | null>(null);

  // Reset state when navigating between accounts
  useEffect(() => {
    setSelectedIndex(0);
    setLightboxIndex(null);
    setActiveTab("skins");
    setLockedPriceBrl(null);
    setInventorySearch("");
  }, [id]);

  const { data, isLoading, error } = useQuery({
    queryKey: lztAccountDetailQueryKey("fortnite", id ?? ""),
    queryFn: ({ signal }) => fetchLztAccountDetail("fortnite", id!, signal),
    enabled: !!id,
    staleTime: LZT_ACCOUNT_DETAIL_STALE_MS,
    retry: false,
  });

  const { data: cosmeticsDb = new Map() } = useQuery({
    queryKey: ["fortnite-cosmetics"],
    queryFn: fetchFortniteCosmeticsBrMap,
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
        rarity: found?.rarityDisplay || c.rarity || "",
        rarityValue: found?.rarityValue || "",
        ageKey: found?.ageKey ?? 999999,
      });
    }
    return results;
  }, [cosmeticsDb]);

  const sortPreviewList = useCallback((list: CosmeticPreview[]) => {
    const toRow = (c: CosmeticPreview) => ({
      name: c.name,
      image: c.image,
      rarityValue: c.rarityValue,
      ageKey: c.ageKey,
    });
    return [...list].sort((a, b) => compareFortniteCardRows(toRow(a), toRow(b)));
  }, []);

  const skinPreviews = useMemo(
    () => sortPreviewList(buildPreviews(raw?.fortniteSkins || [])),
    [raw?.fortniteSkins, buildPreviews, sortPreviewList],
  );
  const pickaxePreviews = useMemo(
    () => sortPreviewList(buildPreviews(raw?.fortnitePickaxe || [])),
    [raw?.fortnitePickaxe, buildPreviews, sortPreviewList],
  );
  const dancePreviews = useMemo(
    () => sortPreviewList(buildPreviews(raw?.fortniteDance || [])),
    [raw?.fortniteDance, buildPreviews, sortPreviewList],
  );
  const gliderPreviews = useMemo(
    () => sortPreviewList(buildPreviews(raw?.fortniteGliders || [])),
    [raw?.fortniteGliders, buildPreviews, sortPreviewList],
  );

  const tabPreviews: Record<InventoryTab, CosmeticPreview[]> = {
    skins: skinPreviews,
    pickaxes: pickaxePreviews,
    dances: dancePreviews,
    gliders: gliderPreviews,
  };

  const allCurrentPreviews = tabPreviews[activeTab];

  // Sort alphabetically and filter by search
  const currentPreviews = useMemo(() => {
    const toRow = (c: CosmeticPreview) => ({
      name: c.name,
      image: c.image,
      rarityValue: c.rarityValue,
      ageKey: c.ageKey,
    });
    const sorted = [...allCurrentPreviews].sort((a, b) => compareFortniteCardRows(toRow(a), toRow(b)));
    if (!inventorySearch.trim()) return sorted;
    const q = inventorySearch.toLowerCase().trim();
    return sorted.filter(c => c.name.toLowerCase().includes(q));
  }, [allCurrentPreviews, inventorySearch]);

  const vbucks = (raw?.fortnite_balance || raw?.fortnite_vbucks) ?? 0;
  const skinCount = raw?.fortnite_skin_count ?? 0;
  const level = raw?.fortnite_level ?? 0;

  const cleanedTitle = useMemo(
    () =>
      getLztDetailDisplayTitle(item?.title, {
        game: "fortnite",
        skinCount: raw?.fortnite_skin_count ?? raw?.fortnite_outfit_count ?? 0,
        level: raw?.fortnite_level ?? 0,
        vbucks: (raw?.fortnite_balance || raw?.fortnite_vbucks) ?? 0,
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

  // Lock price on first load — ensures displayed price = cart price even if LZT price changes
  useEffect(() => {
    if (item && lockedPriceBrl === null) {
      setLockedPriceBrl(getPrice(item, "fortnite"));
    }
  }, [item, getPrice, lockedPriceBrl]);

  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const handleBuyNow = async () => {
    if (!item || checkingAvailability || lockedPriceBrl === null) return;
    setCheckingAvailability(true);
    const available = await checkLztAvailability(String(item.item_id), "fortnite", { queryClient });
    setCheckingAvailability(false);
    if (!available) return;

    const added = addItem({
      productId: `lzt-fn-${item.item_id}`,
      productName: cleanedTitle,
      productImage: null,
      planId: "lzt-fn-account",
      planName: "Conta Fortnite",
      price: lockedPriceBrl,
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
    <div className="min-h-dvh bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-32 sm:pb-20">
        <Link
          to="/contas?game=fortnite"
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-all hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Contas Fortnite
        </Link>

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
              <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
              <ChevronRight className="h-3 w-3" />
              <Link to="/contas" className="hover:text-foreground transition-colors">Contas</Link>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: FN_PURPLE }} className="font-medium">Fortnite #{item.item_id}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* ── LEFT COLUMN: Gallery + Stats ── */}
              <div className="lg:col-span-3 space-y-4 order-1">
                {galleryPreviews.length > 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-card overflow-hidden aspect-square sm:aspect-video relative group">
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
                          decoding="async"
                          fetchPriority="high"
                          onError={(e) => setImgOpacityOnError(e, "0.2")}
                        />
                      </motion.div>
                    </AnimatePresence>

                    {galleryPreviews.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedIndex(p => (p - 1 + galleryPreviews.length) % galleryPreviews.length)}
                          className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 z-[2] flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        >
                          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button
                          onClick={() => setSelectedIndex(p => (p + 1) % galleryPreviews.length)}
                          className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 z-[2] flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        >
                          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </>
                    )}

                    <div className="absolute top-3 left-3 z-[2] rounded-lg bg-background/95 border border-border px-3 py-1.5">
                      <p className="text-xs font-semibold text-foreground">{galleryPreviews[selectedIndex].name}</p>
                      {galleryPreviews[selectedIndex].rarity && (
                        <p className="text-[10px]" style={{ color: getRarityColor(galleryPreviews[selectedIndex].rarity) }}>
                          {galleryPreviews[selectedIndex].rarity}
                        </p>
                      )}
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[2] rounded-lg bg-background/95 border border-border px-3 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{selectedIndex + 1} / {galleryPreviews.length}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/60 bg-card flex items-center justify-center aspect-video">
                    <p className="text-sm text-muted-foreground">Sem itens para exibir</p>
                  </div>
                )}

                {/* Stats Card — compact, directly under gallery */}
                <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                  <div className="px-5 py-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">Informações da Conta</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {skinCount > 0 && <StatCell label="Skins" value={skinCount} color={FN_PURPLE} />}
                      {vbucks > 0 && <StatCell label="V-Bucks" value={vbucks.toLocaleString()} color={FN_BLUE} />}
                      {level > 0 && <StatCell label="Nível" value={level} color={FN_PURPLE} />}
                      {pickaxePreviews.length > 0 && <StatCell label="Picaretas" value={pickaxePreviews.length} color={FN_PURPLE} />}
                      {dancePreviews.length > 0 && <StatCell label="Danças" value={dancePreviews.length} color={FN_PURPLE} />}
                      {gliderPreviews.length > 0 && <StatCell label="Planadores" value={gliderPreviews.length} color={FN_PURPLE} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN: Purchase Card ── */}
              <div className="lg:col-span-2 order-2">
                <div className="lg:sticky lg:top-20 space-y-4">
                  <div className="rounded-2xl border bg-card p-5 sm:p-6 space-y-5" style={{ borderColor: `${FN_PURPLE}30`, boxShadow: `0 0 40px ${FN_PURPLE}08` }}>
                    <h1 className="text-base sm:text-lg font-bold text-foreground leading-snug">{cleanedTitle}</h1>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-positive/10 border border-positive/30 px-3 py-1 text-[11px] font-semibold text-positive">
                        <CheckCircle2 className="h-3 w-3" />
                        FULL ACESSO
                      </span>
                      {vbucks > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ color: FN_BLUE, borderColor: `${FN_BLUE}40`, background: `${FN_BLUE}15` }}>
                          <Gift className="h-3 w-3" />
                          {vbucks} V-Bucks
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        Conta verificável
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2.5"><span className="font-bold" style={{ color: FN_PURPLE }}>✓</span> Entrega automática</p>
                      <p className="flex items-center gap-2.5"><span className="font-bold" style={{ color: FN_PURPLE }}>✓</span> Liberação instantânea</p>
                      <p className="flex items-center gap-2.5"><span className="font-bold" style={{ color: FN_PURPLE }}>✓</span> Email e senha inclusos</p>
                    </div>

                    <div className="border-t border-border/30" />

                    <div className="text-center py-1">
                      <p className="text-[11px] text-muted-foreground mb-1.5">Por apenas</p>
                      <p className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: FN_PURPLE }}>
                        {lockedPriceBrl !== null ? formatPriceBrl(lockedPriceBrl) : getDisplayPrice(item, "fortnite")}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleBuyNow}
                      disabled={checkingAvailability}
                      aria-busy={checkingAvailability}
                      className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-positive py-4 text-sm font-bold uppercase tracking-[0.2em] text-positive-foreground transition-all active:scale-[0.98] disabled:opacity-60"
                    >
                      {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      {checkingAvailability ? "VERIFICANDO..." : "COMPRAR AGORA"}
                    </button>

                    {/* Quick stats */}
                    <div className="grid grid-cols-3 rounded-xl overflow-hidden bg-secondary/20">
                      <StatHighlight label="Skins" value={skinCount} color={FN_PURPLE} />
                      <StatHighlight label="V-Bucks" value={vbucks > 0 ? vbucks.toLocaleString() : "—"} color={FN_BLUE} />
                      <StatHighlight label="Nível" value={level > 0 ? level : "—"} color={FN_PURPLE} />
                    </div>

                    {/* Trust signals */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-2.5 px-2">
                        <Zap className="h-3.5 w-3.5" style={{ color: FN_PURPLE }} />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Entrega<br />Instantânea</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-2.5 px-2">
                        <Shield className="h-3.5 w-3.5" style={{ color: FN_PURPLE }} />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Pagamento<br />Seguro</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-2.5 px-2">
                        <Shield className="h-3.5 w-3.5" style={{ color: FN_PURPLE }} />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Suporte<br />24/7</span>
                      </div>
                    </div>

                    {item.item_id && (
                      <p className="text-[10px] text-muted-foreground/40 text-center break-all">Código: {item.item_id}</p>
                    )}
                  </div>

                  {/* Full Acesso card */}
                  <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <svg className="h-5 w-5 flex-shrink-0" fill={FN_PURPLE} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m15.767 14.171.097-5.05H12.4V5.197h3.99L16.872 0H7.128v24l5.271-.985V14.17z"/></svg>
                      <h3 className="text-sm sm:text-base font-bold text-foreground">Conta FULL ACESSO</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                      Acesso total: email original, alteração de senha e dados, sem enrolação.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2.5"><span className="text-lg leading-none" style={{ color: FN_PURPLE }}>•</span> Email e senha inclusos</li>
                      <li className="flex items-center gap-2.5"><span className="text-lg leading-none" style={{ color: FN_PURPLE }}>•</span> Senha alterável</li>
                      <li className="flex items-center gap-2.5"><span className="text-lg leading-none" style={{ color: FN_PURPLE }}>•</span> Conta verificável</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Inventory Tabs ─── */}
            <div className="mt-8">
              {/* Tab bar */}
              <div className="flex flex-col gap-3 mb-5">
                <div className="flex items-center gap-1 border-b border-border">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setSelectedIndex(0); setInventorySearch(""); }}
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

                {/* Search */}
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Buscar item..."
                    className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
                    style={{ borderColor: inventorySearch ? FN_PURPLE : undefined }}
                  />
                  {inventorySearch && (
                    <button
                      onClick={() => setInventorySearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {inventorySearch && (
                  <p className="text-xs text-muted-foreground">
                    {currentPreviews.length} de {allCurrentPreviews.length} itens encontrados
                  </p>
                )}
              </div>

              {/* Item grid */}
              {currentPreviews.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {currentPreviews.map((cosmetic, i) => (
                    <motion.div
                      key={`${cosmetic.id}-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.12, delay: Math.min(i * 0.006, 0.12) }}
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
                          decoding="async"
                          fetchPriority="low"
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
              ) : inventorySearch ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum resultado para "{inventorySearch}"</p>
                  <button onClick={() => setInventorySearch("")} className="text-xs mt-2 underline" style={{ color: FN_PURPLE }}>Limpar busca</button>
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
                        <img
                          src={getProxiedImageUrl(cur.image)}
                          alt={cur.name}
                          className="relative z-[1] h-full w-full object-contain drop-shadow-2xl"
                          decoding="async"
                          fetchPriority="high"
                        />
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
            {(() => {
              const desc = cleanLztDescription(item.description);
              if (!desc) return null;
              return (
                <div className="mt-6 rounded-lg border border-border bg-card p-5">
                  <h3 className="text-sm font-bold text-foreground mb-2">Descrição</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{desc}</p>
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>

      {/* Mobile bottom bar: portal em document.body evita fixed “preso” a ancestral com transform (Framer) em páginas longas; estilo alinhado à Conta Valorant. */}
      {item &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 w-full min-w-0 sm:hidden [transform:translateZ(0)]"
            style={{ WebkitTransform: "translateZ(0)" }}
          >
            <div className="pointer-events-auto border-t border-border/60 bg-background/95 px-3 py-3 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.35)] backdrop-blur-md safe-area-bottom sm:px-4">
              <div className="mx-auto flex w-full max-w-lg min-w-0 items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 shrink-0 flex-col">
                  <span className="truncate text-base font-bold leading-tight tabular-nums text-positive sm:text-lg">
                    {lockedPriceBrl !== null ? formatPriceBrl(lockedPriceBrl) : getDisplayPrice(item, "fortnite")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={checkingAvailability || lightboxIndex !== null}
                  aria-busy={checkingAvailability}
                  aria-label={checkingAvailability ? "Verificando disponibilidade" : "Comprar agora"}
                  className="flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-positive px-2 py-3 text-xs font-bold uppercase tracking-wider text-positive-foreground transition-all active:scale-[0.98] disabled:opacity-60 touch-manipulation sm:px-3 sm:text-sm"
                >
                  {checkingAvailability ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ShoppingCart className="h-4 w-4 shrink-0" />}
                  <span className="min-w-0 truncate">{checkingAvailability ? "Verificando…" : "Comprar"}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
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
