import { useParams, useNavigate, Link } from "react-router-dom";
import { throwApiError } from "@/lib/apiErrors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import type { DDragonChampionJson, DDragonVersionList, LztMarketLolDetailResponse } from "@/lib/edgeFunctionTypes";
import Header from "@/components/Header";
import {
  ArrowLeft, Shield, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, ShoppingCart, Swords, Star, X, Zap, Trophy, Globe, TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useRef } from "react";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { trackViewContent, trackInitiateCheckout } from "@/lib/metaPixel";
import { checkLztAvailability } from "@/lib/lztAvailability";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { getLztDetailDisplayTitle } from "@/lib/lztDisplayTitles";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import { parseLolSkinIdsFromJsonString, parseLolChampionIdsFromJsonString } from "@/lib/lolInventoryJson";
import { errorMessage } from "@/lib/errorMessage";
import { getProxiedImageUrl } from "@/lib/lztImageProxy";

import { rankMap } from "@/lib/valorantData";

import lolRankFerroImg from "@/assets/lol-rank-ferro.png";
import lolRankBronzeImg from "@/assets/lol-rank-bronze.webp";
import lolRankPrataImg from "@/assets/lol-rank-prata.png";
import lolRankOuroImg from "@/assets/lol-rank-ouro.png";
import lolRankPlatinaImg from "@/assets/lol-rank-platina.png";
import lolRankEsmeraldaImg from "@/assets/lol-rank-esmeralda.png";
import lolRankDiamanteImg from "@/assets/lol-rank-diamante.webp";
import lolRankMestreImg from "@/assets/lol-rank-mestre.png";

// ─── LoL rank config (preenchido após imports) ───
const lolRankConfig: Record<string, { color: string; img: string | null }> = {
  iron:        { color: "#7e6a5e", img: lolRankFerroImg },
  bronze:      { color: "#a0603c", img: lolRankBronzeImg },
  silver:      { color: "#7f9eb4", img: lolRankPrataImg },
  gold:        { color: "#c89b3c", img: lolRankOuroImg },
  platinum:    { color: "#4a9e7f", img: lolRankPlatinaImg },
  emerald:     { color: "#2dce89", img: lolRankEsmeraldaImg },
  diamond:     { color: "#576bde", img: lolRankDiamanteImg },
  master:      { color: "#9d48e0", img: lolRankMestreImg },
  grandmaster: { color: "#cf3030", img: lolRankMestreImg },
  challenger:  { color: "#e0c050", img: lolRankMestreImg },
};

const lolRankToKey = (rank: string): string => {
  if (!rank || rank === "Unranked") return "";
  const r = rank.toUpperCase();
  if (r.includes("CHALLENGER")) return "challenger";
  if (r.includes("GRANDMASTER")) return "grandmaster";
  if (r.includes("MASTER")) return "master";
  if (r.includes("DIAMOND")) return "diamond";
  if (r.includes("EMERALD")) return "emerald";
  if (r.includes("PLATINUM")) return "platinum";
  if (r.includes("GOLD")) return "gold";
  if (r.includes("SILVER")) return "silver";
  if (r.includes("BRONZE")) return "bronze";
  if (r.includes("IRON")) return "iron";
  return "";
};

// ─── DDragon helpers ───
const fetchChampKeyMap = async (): Promise<Map<number, string>> => {
  try {
    const versions = await safeJsonFetch<DDragonVersionList>("https://ddragon.leagueoflegends.com/api/versions.json");
    const version = versions[0];
    if (!version) return new Map();
    const data = await safeJsonFetch<DDragonChampionJson>(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
    );
    const map = new Map<number, string>();
    for (const [internalName, champ] of Object.entries(data.data)) {
      const keyStr = champ.key;
      if (!keyStr) continue;
      const parsed = parseInt(keyStr, 10);
      if (Number.isFinite(parsed)) map.set(parsed, internalName);
    }
    return map;
  } catch (err) {
    console.warn("Failed to fetch LoL champ map:", err);
    return new Map();
  }
};

const fetchAccountDetail = async (itemId: string) => {
  try {
    return await safeJsonFetch<LztMarketLolDetailResponse>(
      `${supabaseUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=lol`,
      { headers: { apikey: supabaseAnonKey } }
    );
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 410) {
        throw new Error("Esta conta já foi vendida ou não está mais disponível.");
      }
      throwApiError(err.status || 500);
    }
    throw err;
  }
};

// ─── Types ───
interface SkinPreview {
  champName: string;
  skinNum: number;
  image: string;
  splashImage: string;
}

interface ChampPreview {
  champName: string;
  image: string;
}

function lolGalleryHeroBgUrl(entry: SkinPreview | ChampPreview): string {
  if ("splashImage" in entry && typeof entry.splashImage === "string") return entry.splashImage;
  return entry.image;
}

const LolDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPrice, getDisplayPrice, formatPriceBrl } = useLztMarkup();
  const [activeTab, setActiveTab] = useState<"skins" | "champions">("skins");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
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
  }, [id]);

  // Fetch account detail
  const { data, isLoading, error } = useQuery({
    queryKey: lztAccountDetailQueryKey("lol", id ?? ""),
    queryFn: () => fetchAccountDetail(id!),
    enabled: !!id,
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });

  // Fetch champ key map from DDragon
  const { data: champKeyMap = new Map<number, string>() } = useQuery({
    queryKey: ["lol-champ-key-map"],
    queryFn: fetchChampKeyMap,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const item = data?.item;
  const lolInventory = item?.lolInventory;

  const lolSkinKey = JSON.stringify(lolInventory?.Skin ?? null);
  const lolChampionKey = JSON.stringify(lolInventory?.Champion ?? null);

  // ─── Skins: ID = champKey * 1000 + skinNum ───
  const skinPreviews = useMemo((): SkinPreview[] => {
    const skinIds = parseLolSkinIdsFromJsonString(lolSkinKey);

    const results: SkinPreview[] = [];
    for (const skinId of skinIds) {
      if (isNaN(skinId) || skinId <= 0) continue;
      const champKey = Math.floor(skinId / 1000);
      const skinNum = skinId % 1000;
      if (skinNum === 0) continue; // pula skin base
      const champName = champKeyMap.get(champKey);
      if (champName) {
        results.push({
          champName,
          skinNum,
          image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champName}_${skinNum}.jpg`,
          splashImage: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champName}_${skinNum}.jpg`,
        });
      }
    }
    return results;
  }, [lolSkinKey, champKeyMap]);

  // ─── Champions: IDs numéricos diretos ───
  const champPreviews = useMemo((): ChampPreview[] => {
    const ids = parseLolChampionIdsFromJsonString(lolChampionKey);
    const results: ChampPreview[] = [];
    for (const champId of ids) {
      const champName = champKeyMap.get(Number(champId));
      if (champName) {
        results.push({
          champName,
          image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champName}_0.jpg`,
        });
      }
    }
    return results;
  }, [lolChampionKey, champKeyMap]);

  const rankText = item?.riot_lol_rank || "Unranked";
  const rankKey = lolRankToKey(rankText);
  const rankData = rankKey ? lolRankConfig[rankKey] : null;
  const rankColor = rankData?.color ?? "hsl(var(--muted-foreground))";
  const level = item?.riot_lol_level ?? 0;
  const champCount = item?.riot_lol_champion_count ?? 0;
  const skinCount = item?.riot_lol_skin_count ?? 0;
  const winRate = item?.riot_lol_rank_win_rate;
  const blueEssence = item?.riot_lol_wallet_blue;
  const orangeEssence = item?.riot_lol_wallet_orange;
  const region = item?.riot_lol_region;

  const cleanedTitle = useMemo(
    () =>
      getLztDetailDisplayTitle(item?.title, {
        game: "lol",
        rankText,
        level,
        skinCount,
      }),
    [item?.title, rankText, level, skinCount],
  );

  // Se não há skins mas há campeões, muda aba padrão
  useEffect(() => {
    if (skinPreviews.length === 0 && champPreviews.length > 0) {
      setActiveTab("champions");
    }
  }, [skinPreviews.length, champPreviews.length]);

  const activeItems = activeTab === "skins" ? skinPreviews : champPreviews;

  // Gallery: skins com arte personalizada primeiro; fallback → campeões
  const galleryItems: (SkinPreview | ChampPreview)[] =
    skinPreviews.length > 0
      ? skinPreviews
      : champPreviews.map(c => ({
          ...c,
          skinNum: 0,
          splashImage: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c.champName}_0.jpg`,
        }));

  // Lock price on first load — ensures displayed price = cart price even if LZT price changes
  useEffect(() => {
    if (item && lockedPriceBrl === null) {
      setLockedPriceBrl(getPrice(item, "lol"));
    }
  }, [item, getPrice, lockedPriceBrl]);

  // ViewContent tracking
  const viewTracked = useRef(false);
  useEffect(() => {
    viewTracked.current = false;
  }, [id]);
  useEffect(() => {
    if (item && lockedPriceBrl !== null && !viewTracked.current) {
      viewTracked.current = true;
      trackViewContent({
        contentName: cleanedTitle,
        contentIds: [`lzt-lol-${item.item_id}`],
        value: lockedPriceBrl,
      });
    }
  }, [item, lockedPriceBrl, cleanedTitle]);

  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const handleBuyNow = async () => {
    if (!item || checkingAvailability || lockedPriceBrl === null) return;
    setCheckingAvailability(true);
    const available = await checkLztAvailability(String(item.item_id), "lol", { queryClient });
    setCheckingAvailability(false);
    if (!available) return;

    trackInitiateCheckout({
      contentName: cleanedTitle,
      contentIds: [`lzt-lol-${item.item_id}`],
      value: lockedPriceBrl,
    });

    const added = addItem({
      productId: `lzt-lol-${item.item_id}`,
      productName: cleanedTitle,
      productImage: null,
      planId: "lzt-lol-account",
      planName: "Conta League of Legends",
      price: lockedPriceBrl,
      type: "lzt-account",
      lztItemId: String(item.item_id),
      lztPrice: item.price,
      lztCurrency: item.price_currency || "rub",
      lztGame: "lol",
    });
    if (added) navigate("/checkout");
  };

  const LOL_BLUE = "hsl(198,100%,45%)";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-28 sm:pb-20">
        <button
          onClick={() => navigate("/contas?game=lol")}
          className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-[hsl(198,100%,45%)/40%] hover:text-[hsl(198,100%,45%)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Contas LoL
        </button>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: LOL_BLUE }} />
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
              <button onClick={() => navigate("/contas?game=lol")} className="hover:text-foreground transition-colors">Contas</button>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: LOL_BLUE }} className="font-medium">LoL — {rankText}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Gallery — always first */}
              <div className="lg:col-span-3 order-1">
                {galleryItems.length > 0 ? (
                  <div className="rounded-lg border border-border bg-card overflow-hidden aspect-[3/4] sm:aspect-[4/3] relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220,30%,8%)] to-[hsl(220,30%,14%)]" />
                    <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${LOL_BLUE}15, transparent 70%)` }} />

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedIndex}
                        className="relative z-[1] flex items-center justify-center h-full w-full cursor-pointer overflow-hidden"
                        onClick={() => setLightboxIndex(selectedIndex)}
                        initial={{ opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div
                          className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm scale-105"
                          style={{
                            backgroundImage: `url(${getProxiedImageUrl(lolGalleryHeroBgUrl(galleryItems[selectedIndex]))})`,
                          }}
                        />
                        {/* Loading art (portrait) na frente */}
                        <img
                          src={getProxiedImageUrl(galleryItems[selectedIndex].image)}
                          alt={galleryItems[selectedIndex].champName}
                          className="relative z-[1] h-full w-auto object-contain drop-shadow-2xl"
                        />
                      </motion.div>
                    </AnimatePresence>

                    {galleryItems.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedIndex(p => (p - 1 + galleryItems.length) % galleryItems.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-white hover:border-[hsl(198,100%,45%)]"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setSelectedIndex(p => (p + 1) % galleryItems.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-white hover:border-[hsl(198,100%,45%)]"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}

                    {/* Name badge */}
                    <div className="absolute top-3 left-3 z-[2] rounded-lg bg-background/95 border border-border px-3 py-1.5">
                      <p className="text-xs font-semibold text-foreground">{galleryItems[selectedIndex].champName}</p>
                    </div>

                    {/* Counter */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[2] rounded-lg bg-background/95 border border-border px-3 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{selectedIndex + 1} / {galleryItems.length}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card flex items-center justify-center aspect-[4/3]">
                    <div className="flex flex-col items-center gap-3">
                      <Shield className="h-20 w-20 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground">Sem skins personalizadas</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Purchase card — 2nd on mobile, sidebar on desktop */}
              <div className="lg:col-span-2 space-y-4 order-2 lg:order-3">
                <div className="rounded-lg border border-border bg-card p-5 space-y-3.5" style={{ borderColor: `${rankColor}30` }}>
                  <h1 className="text-lg font-bold text-foreground leading-snug">
                    {cleanedTitle}
                  </h1>

                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ color: LOL_BLUE, borderColor: `${LOL_BLUE}40`, background: `${LOL_BLUE}15` }}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      FULL ACESSO
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      Conta verificável
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2"><span className="font-bold" style={{ color: LOL_BLUE }}>✓</span> Entrega automática</p>
                    <p className="flex items-center gap-2"><span className="font-bold" style={{ color: LOL_BLUE }}>✓</span> Liberação instantânea</p>
                  </div>

                  <div className="rounded-lg bg-card border border-border p-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Por</p>
                      <p className="text-2xl font-bold" style={{ color: LOL_BLUE }}>
                        {lockedPriceBrl !== null ? formatPriceBrl(lockedPriceBrl) : getDisplayPrice(item, "lol")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={checkingAvailability}
                    aria-busy={checkingAvailability}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-positive py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-positive-foreground transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {checkingAvailability ? "VERIFICANDO..." : "COMPRAR AGORA"}
                  </button>

                  {item.item_id && (
                    <p className="text-[10px] text-muted-foreground/50 text-center break-all">Código: {item.item_id}</p>
                  )}

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg overflow-hidden">
                    <StatHighlight label="Campeões" value={champCount} color={LOL_BLUE} />
                    <StatHighlight label="Skins" value={skinCount} color={LOL_BLUE} />
                    <StatHighlight label="Nível" value={level} color={LOL_BLUE} />
                  </div>
                </div>

                {/* Full Acesso info */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="h-8 w-8" style={{ color: LOL_BLUE }} />
                    <h3 className="text-xl font-bold text-foreground">Conta FULL ACESSO</h3>
                  </div>
                  <p className="text-base text-muted-foreground mb-5">
                    Acesso total: email original, alteração de senha e dados, sem enrolação.
                  </p>
                  <ul className="space-y-3.5 text-base text-muted-foreground">
                    <li className="flex items-center gap-2.5"><span className="text-lg" style={{ color: LOL_BLUE }}>•</span> Email e senha inclusos</li>
                    <li className="flex items-center gap-2.5"><span className="text-lg" style={{ color: LOL_BLUE }}>•</span> Senha alterável</li>
                    <li className="flex items-center gap-2.5"><span className="text-lg" style={{ color: LOL_BLUE }}>•</span> Conta verificável</li>
                  </ul>
                </div>
              </div>

              {/* Stats — 3rd on mobile, under gallery on desktop */}
              <div className="lg:col-span-3 order-3 lg:order-2">
                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {rankData?.img ? (
                        <img src={rankData.img} alt={rankText} className="h-14 w-14 object-contain flex-shrink-0 drop-shadow-lg" />
                      ) : (
                        <div className="h-10 w-10 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-card" style={{ background: rankColor, boxShadow: `0 0 12px ${rankColor}80` }} />
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Elo / Rank</p>
                        <p className="text-base font-bold text-foreground">{rankText}</p>
                      </div>
                    </div>
                    {winRate != null && (
                      <div className="flex flex-col items-end">
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className="text-lg font-bold" style={{ color: winRate >= 50 ? LOL_BLUE : "hsl(var(--muted-foreground))" }}>{winRate}%</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">Informações da Conta</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {level > 0 && <StatCell label="Nível" value={level} color={LOL_BLUE} />}
                      {champCount > 0 && <StatCell label="Campeões" value={champCount} color={LOL_BLUE} />}
                      {skinCount > 0 && <StatCell label="Skins" value={skinCount} color={LOL_BLUE} />}
                      {region && <StatCell label="Região" value={region.toUpperCase()} color={LOL_BLUE} />}
                      {blueEssence != null && blueEssence > 0 && <StatCell label="Blue Essence" value={blueEssence.toLocaleString()} color="#4a9fe0" />}
                      {orangeEssence != null && orangeEssence > 0 && <StatCell label="Orange Essence" value={orangeEssence.toLocaleString()} color="#e09a4a" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Inventory Tabs ─── */}
            {(skinPreviews.length > 0 || champPreviews.length > 0) && (
              <div className="mt-6">
                <div className="flex gap-2 mb-5">
                  {([
                    { key: "skins" as const, label: "Skins", count: skinPreviews.length, icon: <Star className="h-4 w-4" /> },
                    { key: "champions" as const, label: "Campeões", count: champPreviews.length, icon: <Swords className="h-4 w-4" /> },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => { setActiveTab(tab.key); setSelectedIndex(0); setLightboxIndex(null); }}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                        activeTab === tab.key
                          ? "border-[hsl(198,100%,45%)] bg-[hsl(198,100%,45%,0.1)] text-[hsl(198,100%,45%)]"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          activeTab === tab.key
                            ? "bg-[hsl(198,100%,45%,0.2)] text-[hsl(198,100%,45%)]"
                            : "bg-secondary text-muted-foreground"
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {activeItems.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {activeItems.map((it, i) => (
                      <motion.div
                        key={`${activeTab}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.015 }}
                        className="group rounded-lg border border-border bg-card overflow-hidden hover:border-[hsl(198,100%,45%)/40%] transition-all cursor-pointer"
                        onClick={() => setLightboxIndex(i)}
                      >
                        {/* Portrait image */}
                        <div className="aspect-[3/4] bg-secondary/20 overflow-hidden">
                          <img
                            src={getProxiedImageUrl(it.image)}
                            alt={it.champName}
                            className="h-full w-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2 border-t border-border">
                          <p className="text-[11px] font-medium text-foreground truncate">{it.champName}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 rounded-lg border border-border bg-card">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                    <p className="text-sm text-muted-foreground">Carregando itens...</p>
                  </div>
                )}

                    {/* Lightbox */}
                <AnimatePresence>
                  {lightboxIndex !== null && activeItems[lightboxIndex] && (() => {
                    const cur = activeItems[lightboxIndex];
                    const total = activeItems.length;
                    const splashImg = 'splashImage' in cur ? String(cur.splashImage) : String(cur.image);
                    const goPrev = () => setLightboxIndex(p => p !== null ? (p - 1 + total) % total : null);
                    const goNext = () => setLightboxIndex(p => p !== null ? (p + 1) % total : null);
                    return (
                      <motion.div
                        key="lol-lightbox"
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
                        ref={(el) => el?.focus()}
                      >
                        <motion.div
                          initial={{ scale: 0.92, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.92, opacity: 0 }}
                          className="relative bg-card border border-border rounded-xl w-[90vw] max-w-md overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button onClick={() => setLightboxIndex(null)} className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-5 w-5" />
                          </button>

                            {/* Portrait art */}
                          <div className="relative aspect-[3/4] bg-secondary/20 overflow-hidden">
                            {/* Splash blurred bg */}
                            <div
                              className="absolute inset-0 bg-cover bg-center opacity-30 blur-md scale-110"
                              style={{ backgroundImage: `url(${getProxiedImageUrl(splashImg as string)})` }}
                            />
                            <img src={getProxiedImageUrl(cur.image)} alt={cur.champName} className="relative z-[1] h-full w-full object-cover object-top" />
                          </div>

                          <div className="p-5 flex flex-col items-center gap-3">
                            <h3 className="text-base font-bold text-foreground text-center">{cur.champName}</h3>

                            <div className="flex items-center gap-4 mt-1">
                              <button onClick={goPrev} className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors">
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <span className="text-sm text-muted-foreground tabular-nums">{lightboxIndex + 1}/{total}</span>
                              <button onClick={goNext} className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors">
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
              </div>
            )}

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
          <div className="border-t border-border bg-card px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-lg font-bold leading-tight text-positive">
                  {lockedPriceBrl !== null ? formatPriceBrl(lockedPriceBrl) : getDisplayPrice(item, "lol")}
                </span>
              </div>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={checkingAvailability}
                aria-busy={checkingAvailability}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-positive py-3.5 text-sm font-bold uppercase tracking-wider text-positive-foreground transition-all active:scale-[0.98] disabled:opacity-60"
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
  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-bold" style={{ color: color || "hsl(var(--foreground))" }}>{value}</span>
  </div>
);

const StatHighlight = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <div className="flex flex-col items-center py-3 px-1.5">
    <span className="text-[10px] text-muted-foreground mb-0.5">{label}</span>
    <span className="text-base font-bold" style={{ color: color || "hsl(var(--foreground))" }}>{value}</span>
  </div>
);

export default LolDetalhes;
