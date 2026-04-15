import { useParams, useNavigate, Link } from "react-router-dom";
import { throwApiError } from "@/lib/apiErrors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import type { DDragonVersionList } from "@/lib/edgeFunctionTypes";
import Header from "@/components/Header";
import {
  ArrowLeft, Shield, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, ShoppingCart, Swords, Star, X, Zap, Trophy, Globe, TrendingUp, Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { trackInitiateCheckout } from "@/lib/metaPixel";
import { checkLztAvailability } from "@/lib/lztAvailability";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { getLztDetailDisplayTitle } from "@/lib/lztDisplayTitles";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import { parseLolSkinIdsFromJsonString, parseLolChampionIdsFromJsonString } from "@/lib/lolInventoryJson";
import { errorMessage } from "@/lib/errorMessage";
import { getProxiedImageUrl } from "@/lib/lztImageProxy";
import type { LztMarketLolDetailResponse } from "@/lib/edgeFunctionTypes";

import { rankMap } from "@/lib/valorantData";

import lolRankFerroImg from "@/assets/lol-rank-ferro.webp";
import lolRankBronzeImg from "@/assets/lol-rank-bronze.webp";
import lolRankPrataImg from "@/assets/lol-rank-prata.webp";
import lolRankOuroImg from "@/assets/lol-rank-ouro.webp";
import lolRankPlatinaImg from "@/assets/lol-rank-platina.webp";
import lolRankEsmeraldaImg from "@/assets/lol-rank-esmeralda.webp";
import lolRankDiamanteImg from "@/assets/lol-rank-diamante.webp";
import lolRankMestreImg from "@/assets/lol-rank-mestre.webp";

// ─── LoL rank config ───
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
// Fetches champion key→internalName map AND skin names per champion
interface ChampData {
  keyMap: Map<number, string>;
  /** skinNames: Map<"ChampName_skinNum", skinDisplayName> */
  skinNames: Map<string, string>;
  /** Patch do DDragon (ex. 15.1.1) — URLs versionadas cacheiam melhor no CDN da Riot. */
  cdnVersion: string;
}

const emptyChampData = (): ChampData => ({
  keyMap: new Map(),
  skinNames: new Map(),
  cdnVersion: "",
});

/**
 * Arte loading/tiles/splash no DDragon.
 * Não usar `cdn/{patch}/img/champion/...`: em muitos ambientes (incl. browsers) a Riot/CloudFront
 * devolve **403**; o legado sem patch continua estável (alinhado a `Contas.tsx`).
 */
const DDRAGON_CHAMPION_IMG_BASE = "https://ddragon.leagueoflegends.com/cdn/img/champion";

const ddragonChampionAsset = (kind: "tiles" | "loading" | "splash", champName: string, skinNum: number) =>
  `${DDRAGON_CHAMPION_IMG_BASE}/${kind}/${champName}_${skinNum}.jpg`;

/** Fallback em cadeia quando um path falha (404/403). */
const fetchChampData = async (): Promise<ChampData> => {
  try {
    const versions = await safeJsonFetch<DDragonVersionList>("https://ddragon.leagueoflegends.com/api/versions.json");
    const version = versions[0];
    if (!version) return emptyChampData();

    // Use championFull.json to get skin names
    const data = await safeJsonFetch<{
      data: Record<string, {
        key: string;
        id?: string;
        name?: string;
        skins?: Array<{ num: number; name: string }>;
      }>;
    }>(`https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR/championFull.json`);

    const keyMap = new Map<number, string>();
    const skinNames = new Map<string, string>();

    for (const [internalName, champ] of Object.entries(data.data)) {
      const keyStr = champ.key;
      if (!keyStr) continue;
      const parsed = parseInt(keyStr, 10);
      if (Number.isFinite(parsed)) keyMap.set(parsed, internalName);

      // Map skin names: "ChampInternalName_skinNum" → display name
      if (champ.skins) {
        for (const skin of champ.skins) {
          if (skin.num === 0) continue; // skip default skin
          const displayName = skin.name === "default" ? (champ.name || internalName) : skin.name;
          skinNames.set(`${internalName}_${skin.num}`, displayName);
        }
      }
    }
    return { keyMap, skinNames, cdnVersion: version };
  } catch (err) {
    console.warn("Failed to fetch LoL champ data:", err);
    return emptyChampData();
  }
};

const fetchAccountDetail = async (itemId: string) => {
  try {
    return await safeJsonFetch<LztMarketLolDetailResponse>(
      `${supabaseUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=lol`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      }
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
  skinName: string; // actual skin display name
  skinNum: number;
  /** Arte de loading (hero / lightbox principal) — mais leve que splash. */
  image: string;
  /** Miniatura da grelha — `tiles` é bem menor que `loading`. */
  thumbImage: string;
  splashImage: string;
}

interface ChampPreview {
  champName: string;
  displayName: string;
  image: string;
  thumbImage: string;
}

/** Fallback em cadeia quando um path falha (404/403). */
function applyDdragonImgFallback(el: HTMLImageElement, urls: string[]) {
  const i = Number(el.dataset.ddragonFb ?? "0");
  const next = urls[i + 1];
  if (next) {
    el.dataset.ddragonFb = String(i + 1);
    el.src = getProxiedImageUrl(next);
    return;
  }
  el.style.opacity = "0.15";
}

function lolSkinThumbFallbacks(s: SkinPreview): string[] {
  return [s.thumbImage, s.image, s.splashImage];
}
function lolSkinMainFallbacks(s: SkinPreview): string[] {
  return [s.image, s.splashImage, s.thumbImage];
}
function lolChampThumbFallbacks(c: ChampPreview): string[] {
  return [c.thumbImage, c.image, ddragonChampionAsset("splash", c.champName, 0)];
}
function lolChampMainFallbacks(c: ChampPreview): string[] {
  return [c.image, ddragonChampionAsset("splash", c.champName, 0), c.thumbImage];
}

/** Fundo desfocado do hero: miniatura `tiles` — evita pedir splash (~1–2MB) só para blur. */
function lolGalleryHeroBlurUrl(entry: SkinPreview): string {
  return entry.thumbImage;
}

const LolDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPrice, getDisplayPrice, formatPriceBrl } = useLztMarkup();
  const [activeTab, setActiveTab] = useState<"skins" | "champions">("skins");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { addItem } = useCart();
  const queryClient = useQueryClient();

  const [lockedPriceBrl, setLockedPriceBrl] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(0);
    setLightboxIndex(null);
    setActiveTab("skins");
    setLockedPriceBrl(null);
    setSearchQuery("");
  }, [id]);

  const { data, isLoading, error } = useQuery({
    queryKey: lztAccountDetailQueryKey("lol", id ?? ""),
    queryFn: () => fetchAccountDetail(id!),
    enabled: !!id,
    staleTime: 1000 * 30,
    retry: false,
  });

  // Fetch champ data (key map + skin names) from DDragon
  const { data: champData = emptyChampData() } = useQuery({
    queryKey: ["lol-champ-full-data"],
    queryFn: fetchChampData,
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
      if (skinNum === 0) continue;
      const champName = champData.keyMap.get(champKey);
      if (champName) {
        const skinDisplayName = champData.skinNames.get(`${champName}_${skinNum}`) || `${champName} #${skinNum}`;
        results.push({
          champName,
          skinName: skinDisplayName,
          skinNum,
          image: ddragonChampionAsset("loading", champName, skinNum),
          thumbImage: ddragonChampionAsset("tiles", champName, skinNum),
          splashImage: ddragonChampionAsset("splash", champName, skinNum),
        });
      }
    }
    // Sort alphabetically by skin name
    results.sort((a, b) => a.skinName.localeCompare(b.skinName, "pt-BR"));
    return results;
  }, [lolSkinKey, champData]);

  // ─── Champions: IDs numéricos diretos ───
  const champPreviews = useMemo((): ChampPreview[] => {
    const ids = parseLolChampionIdsFromJsonString(lolChampionKey);
    const results: ChampPreview[] = [];
    for (const champId of ids) {
      const champName = champData.keyMap.get(Number(champId));
      if (champName) {
        // Try to get localized display name
        // DDragon championFull has name field but we stored internalName in keyMap
        // Use champName as display since it's the internal name (close enough)
        results.push({
          champName,
          displayName: champName,
          image: ddragonChampionAsset("loading", champName, 0),
          thumbImage: ddragonChampionAsset("tiles", champName, 0),
        });
      }
    }
    results.sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
    return results;
  }, [lolChampionKey, champData]);

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

  useEffect(() => {
    if (skinPreviews.length === 0 && champPreviews.length > 0) {
      setActiveTab("champions");
    }
  }, [skinPreviews.length, champPreviews.length]);

  // Filter items by search query
  const filteredSkins = useMemo(() => {
    if (!searchQuery.trim()) return skinPreviews;
    const q = searchQuery.toLowerCase().trim();
    return skinPreviews.filter(s =>
      s.skinName.toLowerCase().includes(q) || s.champName.toLowerCase().includes(q)
    );
  }, [skinPreviews, searchQuery]);

  const filteredChamps = useMemo(() => {
    if (!searchQuery.trim()) return champPreviews;
    const q = searchQuery.toLowerCase().trim();
    return champPreviews.filter(c => c.displayName.toLowerCase().includes(q));
  }, [champPreviews, searchQuery]);

  const activeItems: (SkinPreview | ChampPreview)[] = activeTab === "skins" ? filteredSkins : filteredChamps;
  const totalItems: (SkinPreview | ChampPreview)[] = activeTab === "skins" ? skinPreviews : champPreviews;

  // Gallery: skins com arte personalizada primeiro; fallback → campeões
  const galleryItems: SkinPreview[] =
    skinPreviews.length > 0
      ? skinPreviews
      : champPreviews.map((c) => {
          return {
            champName: c.champName,
            skinName: c.displayName,
            skinNum: 0,
            image: c.image,
            thumbImage: c.thumbImage,
            splashImage: ddragonChampionAsset("splash", c.champName, 0),
          };
        });

  useEffect(() => {
    if (item && lockedPriceBrl === null) {
      setLockedPriceBrl(getPrice(item, "lol"));
    }
  }, [item, getPrice, lockedPriceBrl]);

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
      contentCategory: "lol",
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

  const getDisplayName = (it: SkinPreview | ChampPreview): string => {
    if ("skinName" in it) return it.skinName;
    return (it as ChampPreview).displayName || it.champName;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-32 sm:pb-20">
        <Link
          to="/contas?game=lol"
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-all hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Contas LoL
        </Link>

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
              {/* ── LEFT COLUMN: Gallery + Rank/Stats ── */}
              <div className="lg:col-span-3 space-y-4 order-1">
                {galleryItems.length > 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-card overflow-hidden aspect-[3/4] sm:aspect-[4/3] relative group">
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
                            backgroundImage: `url(${getProxiedImageUrl(lolGalleryHeroBlurUrl(galleryItems[selectedIndex]))})`,
                          }}
                        />
                        <img
                          key={`lol-hero-${selectedIndex}-${galleryItems[selectedIndex].champName}-${galleryItems[selectedIndex].skinNum}`}
                          src={getProxiedImageUrl(galleryItems[selectedIndex].image)}
                          alt={getDisplayName(galleryItems[selectedIndex])}
                          className="relative z-[1] h-full w-auto object-contain drop-shadow-2xl"
                          decoding="async"
                          fetchPriority="high"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const el = e.currentTarget;
                            const cur = galleryItems[selectedIndex];
                            applyDdragonImgFallback(el, lolSkinMainFallbacks(cur));
                          }}
                        />
                      </motion.div>
                    </AnimatePresence>

                    {galleryItems.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedIndex(p => (p - 1 + galleryItems.length) % galleryItems.length)}
                          className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 z-[2] flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:text-white hover:border-[hsl(198,100%,45%)]"
                        >
                          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button
                          onClick={() => setSelectedIndex(p => (p + 1) % galleryItems.length)}
                          className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 z-[2] flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:text-white hover:border-[hsl(198,100%,45%)]"
                        >
                          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </>
                    )}

                    <div className="absolute top-3 left-3 z-[2] rounded-lg bg-background/95 border border-border px-3 py-1.5">
                      <p className="text-xs font-semibold text-foreground">{getDisplayName(galleryItems[selectedIndex])}</p>
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[2] rounded-lg bg-background/95 border border-border px-3 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{selectedIndex + 1} / {galleryItems.length}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/60 bg-card flex items-center justify-center aspect-[4/3]">
                    <div className="flex flex-col items-center gap-3">
                      <Shield className="h-20 w-20 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground">Sem skins personalizadas</p>
                    </div>
                  </div>
                )}

                {/* Rank + Stats Card */}
                <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-5 sm:py-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      {rankData?.img ? (
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full blur-xl scale-150" style={{ background: `${rankColor}15` }} />
                          <img src={rankData.img} alt={rankText} className="relative h-14 w-14 sm:h-[4.5rem] sm:w-[4.5rem] object-contain drop-shadow-lg" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-card" style={{ background: rankColor, boxShadow: `0 0 12px ${rankColor}80` }} />
                      )}
                      <div>
                        <p className="text-[9px] uppercase tracking-widest font-medium mb-0.5" style={{ color: `${rankColor}cc` }}>Elo / Rank</p>
                        <p className="text-base sm:text-lg font-bold text-foreground leading-tight">{rankText}</p>
                      </div>
                    </div>
                    {winRate != null && (
                      <div className="flex flex-col items-end">
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className="text-lg font-bold" style={{ color: winRate >= 50 ? LOL_BLUE : "hsl(var(--muted-foreground))" }}>{winRate}%</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border/20 px-4 sm:px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

              {/* ── RIGHT COLUMN: Purchase Card ── */}
              <div className="lg:col-span-2 order-2">
                <div className="lg:sticky lg:top-20 space-y-4">
                  <div className="rounded-2xl border bg-card p-5 sm:p-6 space-y-5" style={{ borderColor: `${rankColor}30`, boxShadow: `0 0 40px ${rankColor}08` }}>
                    <h1 className="text-base sm:text-lg font-bold text-foreground leading-snug">{cleanedTitle}</h1>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-positive/10 border border-positive/30 px-3 py-1 text-[11px] font-semibold text-positive">
                        <CheckCircle2 className="h-3 w-3" />
                        FULL ACESSO
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        Conta verificável
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2.5"><span className="font-bold" style={{ color: LOL_BLUE }}>✓</span> Entrega automática</p>
                      <p className="flex items-center gap-2.5"><span className="font-bold" style={{ color: LOL_BLUE }}>✓</span> Liberação instantânea</p>
                      <p className="flex items-center gap-2.5"><span className="font-bold" style={{ color: LOL_BLUE }}>✓</span> Garantia de acesso</p>
                    </div>

                    <div className="border-t border-border/30" />

                    <div className="text-center py-1">
                      <p className="text-[11px] text-muted-foreground mb-1.5">Por apenas</p>
                      <p className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: LOL_BLUE }}>
                        {lockedPriceBrl !== null ? formatPriceBrl(lockedPriceBrl) : getDisplayPrice(item, "lol")}
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

                    <div className="grid grid-cols-3 rounded-xl overflow-hidden bg-secondary/20">
                      <StatHighlight label="Campeões" value={champCount} color={LOL_BLUE} />
                      <StatHighlight label="Skins" value={skinCount} color={LOL_BLUE} />
                      <StatHighlight label="Nível" value={level} color={LOL_BLUE} />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-2.5 px-2">
                        <Zap className="h-3.5 w-3.5" style={{ color: LOL_BLUE }} />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Entrega<br />Instantânea</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-2.5 px-2">
                        <Shield className="h-3.5 w-3.5" style={{ color: LOL_BLUE }} />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Pagamento<br />Seguro</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-2.5 px-2">
                        <Star className="h-3.5 w-3.5" style={{ color: LOL_BLUE }} />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Suporte<br />24/7</span>
                      </div>
                    </div>

                    {item.item_id && (
                      <p className="text-[10px] text-muted-foreground/40 text-center break-all">Código: {item.item_id}</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: LOL_BLUE }} />
                      <h3 className="text-sm sm:text-base font-bold text-foreground">Conta FULL ACESSO</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                      Acesso total: email original, alteração de senha e dados, sem enrolação.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2.5"><span className="text-lg leading-none" style={{ color: LOL_BLUE }}>•</span> Email e senha inclusos</li>
                      <li className="flex items-center gap-2.5"><span className="text-lg leading-none" style={{ color: LOL_BLUE }}>•</span> Senha alterável</li>
                      <li className="flex items-center gap-2.5"><span className="text-lg leading-none" style={{ color: LOL_BLUE }}>•</span> Conta verificável</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Inventory Tabs ─── */}
            {(skinPreviews.length > 0 || champPreviews.length > 0) && (
              <div className="mt-6">
                {/* Tabs + Search */}
              <div className="flex flex-col gap-3 mb-5">
                  <div className="flex items-center gap-1 border-b border-border">
                    {([
                      { key: "skins" as const, label: "Skins", count: skinPreviews.length },
                      { key: "champions" as const, label: "Campeões", count: champPreviews.length },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setSearchQuery(""); }}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
                          activeTab === tab.key
                            ? "border-[hsl(198,100%,45%)] text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{
                              background: activeTab === tab.key ? `${LOL_BLUE}25` : "hsl(var(--secondary))",
                              color: activeTab === tab.key ? LOL_BLUE : "hsl(var(--muted-foreground))",
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
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={activeTab === "skins" ? "Buscar skin..." : "Buscar campeão..."}
                      className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
                      style={{ borderColor: searchQuery ? LOL_BLUE : undefined }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Results count when filtering */}
                {searchQuery && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {activeItems.length} de {totalItems.length} {activeTab === "skins" ? "skins" : "campeões"} encontrados
                  </p>
                )}

                {activeItems.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {activeItems.map((it, i) => (
                      <motion.div
                        key={`${activeTab}-${"skinNum" in it ? `${it.champName}_${it.skinNum}` : it.champName}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.012, 0.15) }}
                        className="group rounded-lg border border-border bg-card overflow-hidden hover:border-[hsl(198,100%,45%)/40%] transition-all cursor-pointer"
                        onClick={() => {
                          // Find original index in unfiltered list for lightbox
                          const origIndex = totalItems.indexOf(it);
                          setLightboxIndex(origIndex >= 0 ? origIndex : i);
                        }}
                      >
                        <div className="aspect-[3/4] bg-secondary/20 overflow-hidden">
                          <img
                            src={getProxiedImageUrl(it.thumbImage)}
                            alt={getDisplayName(it)}
                            className="h-full w-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const el = e.currentTarget;
                              const urls =
                                "skinName" in it && "splashImage" in it
                                  ? lolSkinThumbFallbacks(it)
                                  : lolChampThumbFallbacks(it);
                              applyDdragonImgFallback(el, urls);
                            }}
                          />
                        </div>
                        <div className="p-2 border-t border-border">
                          <p className="text-[11px] font-medium text-foreground truncate">{getDisplayName(it)}</p>
                          {"champName" in it && "skinName" in it && (
                            <p className="text-[9px] text-muted-foreground truncate">{it.champName}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-border bg-card">
                    <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum resultado para "{searchQuery}"</p>
                    <button onClick={() => setSearchQuery("")} className="text-xs mt-2 underline" style={{ color: LOL_BLUE }}>Limpar busca</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 rounded-lg border border-border bg-card">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                    <p className="text-sm text-muted-foreground">Carregando itens...</p>
                  </div>
                )}

                {/* Lightbox */}
                <AnimatePresence>
                  {lightboxIndex !== null && totalItems[lightboxIndex] && (() => {
                    const cur = totalItems[lightboxIndex];
                    const total = totalItems.length;
                    const goPrev = () => setLightboxIndex(p => p !== null ? (p - 1 + total) % total : null);
                    const goNext = () => setLightboxIndex(p => p !== null ? (p + 1) % total : null);
                    /** Só `loading` no lightbox — splash é ~1–2MB por frame; qualidade continua boa. */
                    const lightboxSrc = cur.image;
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

                          <div className="relative aspect-[3/4] bg-gradient-to-b from-secondary/40 to-secondary/10 overflow-hidden">
                            <img
                              key={`lol-lb-${lightboxIndex}`}
                              src={getProxiedImageUrl(lightboxSrc)}
                              alt={getDisplayName(cur)}
                              className="relative z-[1] h-full w-full object-cover object-top"
                              decoding="async"
                              fetchPriority="high"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const el = e.currentTarget;
                                const urls =
                                  "skinName" in cur && "splashImage" in cur
                                    ? lolSkinMainFallbacks(cur)
                                    : lolChampMainFallbacks(cur);
                                applyDdragonImgFallback(el, urls);
                              }}
                            />
                          </div>

                          <div className="p-5 flex flex-col items-center gap-3">
                            <h3 className="text-base font-bold text-foreground text-center">{getDisplayName(cur)}</h3>
                            {"champName" in cur && "skinName" in cur && (
                              <p className="text-xs text-muted-foreground">{cur.champName}</p>
                            )}

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
              const stripped = raw.replace(/\[URL=[^\]]*\][^[]*\[\/URL\]/gi, "").replace(/\[\/?\w+\]/g, "").replace(/https?:\/\/\S+/g, "").trim();
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

      {/* Mobile bottom bar: portal no body + translateZ(0) — mesmo padrão Fortnite/Valorant (fixed estável em páginas longas com Framer). */}
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
                    {lockedPriceBrl !== null ? formatPriceBrl(lockedPriceBrl) : getDisplayPrice(item, "lol")}
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

export default LolDetalhes;
