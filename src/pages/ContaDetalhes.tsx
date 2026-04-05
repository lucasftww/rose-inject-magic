import { useParams, useNavigate } from "react-router-dom";
import { throwApiError } from "@/lib/apiErrors";
import { translateRegion } from "@/lib/regionTranslation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import { ArrowLeft, Shield, Loader2, ChevronRight, ChevronLeft, CheckCircle2, ShoppingCart, Swords, Users, Star, X, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect, useRef, forwardRef } from "react";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { trackViewContent, trackInitiateCheckout } from "@/lib/metaPixel";
import { checkLztAvailability } from "@/lib/lztAvailability";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";

import { rankMap, rarityMap, fetchAllValorantSkins, rankUnranked, RARITY_PRIORITY, type SkinEntry } from "@/lib/valorantData";
import { getLztDetailDisplayTitle } from "@/lib/lztDisplayTitles";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import { getJsonDataArray } from "@/lib/jsonResponse";
import { errorMessage } from "@/lib/errorMessage";
import { isRecord } from "@/types/ticketChat";

const fetchAccountDetail = async (itemId: string) => {
  const res = await fetch(
    `${supabaseUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=valorant`,
    { headers: { "Content-Type": "application/json", apikey: supabaseAnonKey } }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 410) {
      throw new Error(body?.error === "Account already sold" 
        ? "Esta conta já foi vendida." 
        : "Esta conta não está mais disponível.");
    }
    throwApiError(res.status);
  }
  return res.json();
};

// RARITY_PRIORITY imported from @/lib/valorantData

// Permissive UUID pattern (Valorant UUIDs don't strictly follow RFC 4122)
const getProxiedImageUrl = (url: string) => {
  if (!url) return "";
  if (url.includes("lzt.market") || url.includes("img.lzt.market") || url.includes("mineskin.eu")) {
    return `${supabaseUrl}/functions/v1/lzt-market?action=image-proxy&url=${encodeURIComponent(url)}`;
  }
  return url;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const collectUuidStrings = (raw: unknown): string[] => {
  const out: string[] = [];

  const walk = (value: unknown) => {
    if (!value) return;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (UUID_REGEX.test(normalized)) out.push(normalized);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    if (isRecord(value)) {
      for (const item of Object.values(value)) {
        walk(item);
      }
    }
  };

  walk(raw);
  return Array.from(new Set(out));
};

type SkinLike = {
  displayIcon?: string | null;
  levels?: Array<{ displayIcon?: string | null }>;
  chromas?: Array<{ fullRender?: string | null; displayIcon?: string | null; swatch?: string | null }>;
};

// Resolve the best image from a skin object
const resolveSkinImage = (s: unknown): string | null => {
  if (!isRecord(s)) return null;
  const skin = s as SkinLike;

  if (skin.displayIcon) return skin.displayIcon;

  if (Array.isArray(skin.levels)) {
    for (const lvl of skin.levels) {
      if (lvl?.displayIcon) return lvl.displayIcon;
    }
  }

  if (Array.isArray(skin.chromas)) {
    for (const c of skin.chromas) {
      if (c?.fullRender) return c.fullRender;
      if (c?.displayIcon) return c.displayIcon;
      if (c?.swatch) return c.swatch;
    }
  }

  return null;
};

const LINEAGE_ORDER_HINTS: string[][] = [
["radiant entertainment system", "sistema de entretenimento radiante"],
["evori dreamwings", "asas oniricas"],
["kuronami"],
["prelude to chaos", "caos prelude"],
["imperium"],
["onimaru"],
["rgx 11z pro", "rgx"],
["araxys"],
["xenohunter", "xenocacador", "xenocaçador"],
["champions 2024", "champions"],
["sentinels of light", "sentinelas da luz"],
["chronovoid", "cronovoid"],
["reaver", "saqueador"],
["prime", "sublime"],
["gaia", "vinganca de gaia", "vingança de gaia"],
["sovereign", "soberania"],
["oni"],
["origin", "origem"],
["overdrive"],
["neo frontier"],
["singularity"],
["vct"],
["guardrail"],
["sandswept"],
["transition"],
["recon", "reconhecimento"]];


const normalizeSkinName = (name: string) =>
name.
toLowerCase().
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
trim();

type SkinRankMeta = {
  displayScore: number;
  isPremiumHint: boolean;
  lineageRank: number;
  weaponRank: number;
  effectiveRarity: number;
};

const getSkinRankMeta = (name: string, _rarityPriority: number): SkinRankMeta => {
  const normalized = normalizeSkinName(name);

  const lineageIndex = LINEAGE_ORDER_HINTS.findIndex((hints) =>
  hints.some((hint) => normalized.includes(hint))
  );
  const lineageRank = lineageIndex === -1 ? 0 : LINEAGE_ORDER_HINTS.length - lineageIndex;

  // Pedido do usuário: ordenar APENAS por linhagem
  const weaponRank = 0;
  const effectiveRarity = 0;
  const isPremiumHint = lineageRank > 0;
  const displayScore = lineageRank * 1000;

  return { displayScore, isPremiumHint, lineageRank, weaponRank, effectiveRarity };
};

type ValorantSkinItem = {
  name: string;
  image: string;
  rarity: (typeof rarityMap)[string] | null;
  rarityPriority: number;
  effectiveRarity: number;
  lineageRank: number;
  weaponRank: number;
  displayScore: number;
  isPremiumHint: boolean;
};

type ValorantSkinLike = {
  contentTierUuid?: string | null;
  displayName?: string;
  uuid?: string | null;
  levels?: Array<{ uuid?: string | null }>;
  chromas?: Array<{ uuid?: string | null }>;
};

const buildSkinLookup = (skins: unknown[]): Map<string, ValorantSkinItem> => {
  const lookup = new Map<string, ValorantSkinItem>();

  for (const s of skins || []) {
    if (!isRecord(s)) continue;
    const image = resolveSkinImage(s);
    if (!image) continue;

    const skin = s as Partial<ValorantSkinLike>;
    const displayName = typeof skin.displayName === "string" ? skin.displayName : "";
    if (!displayName) continue;

    const rawTier = (skin.contentTierUuid || "").toLowerCase();
    const rarityPriority = RARITY_PRIORITY[rawTier] || 0;
    const { displayScore, isPremiumHint, lineageRank, weaponRank, effectiveRarity } = getSkinRankMeta(displayName, rarityPriority);

    const entry: ValorantSkinItem = {
      name: displayName,
      image,
      rarity: rawTier ? rarityMap[rawTier] || null : null,
      rarityPriority,
      effectiveRarity,
      lineageRank,
      weaponRank,
      displayScore,
      isPremiumHint
    };

    if (skin.uuid) lookup.set(String(skin.uuid).toLowerCase(), entry);

    if (Array.isArray(skin.levels)) {
      for (const level of skin.levels) {
        if (level?.uuid) lookup.set(String(level.uuid).toLowerCase(), entry);
      }
    }

    if (Array.isArray(skin.chromas)) {
      for (const chroma of skin.chromas) {
        if (chroma?.uuid) lookup.set(String(chroma.uuid).toLowerCase(), entry);
      }
    }
  }

  return lookup;
};

/** Valorant API catálogo muda raramente — cache 1h reduz payload repetido em cada detalhe. */
const VALORANT_API_CACHE_MS = 1000 * 60 * 60;
let weaponSkinsCatalogCache: { data: unknown[]; expiry: number } | null = null;
let skinLevelsCatalogCache: { data: unknown[]; expiry: number } | null = null;
let skinChromasCatalogCache: { data: unknown[]; expiry: number } | null = null;

async function getWeaponSkinsCatalog(): Promise<unknown[]> {
  const now = Date.now();
  if (weaponSkinsCatalogCache && weaponSkinsCatalogCache.expiry > now) {
    return weaponSkinsCatalogCache.data;
  }
  const skinsRes = await fetch("https://valorant-api.com/v1/weapons/skins?language=pt-BR");
  if (!skinsRes.ok) return [];
  const skinsData = await skinsRes.json();
  const data = Array.isArray(skinsData.data) ? skinsData.data : [];
  weaponSkinsCatalogCache = { data, expiry: now + VALORANT_API_CACHE_MS };
  return data;
}

async function getSkinLevelsCatalog(): Promise<Record<string, any>[]> {
  const now = Date.now();
  if (skinLevelsCatalogCache && skinLevelsCatalogCache.expiry > now) {
    return skinLevelsCatalogCache.data;
  }
  const res = await fetch("https://valorant-api.com/v1/weapons/skinlevels?language=pt-BR");
  if (!res.ok) return [];
  const json = await res.json();
  const data = Array.isArray(json.data) ? json.data : [];
  skinLevelsCatalogCache = { data, expiry: now + VALORANT_API_CACHE_MS };
  return data;
}

async function getSkinChromasCatalog(): Promise<Record<string, any>[]> {
  const now = Date.now();
  if (skinChromasCatalogCache && skinChromasCatalogCache.expiry > now) {
    return skinChromasCatalogCache.data;
  }
  const res = await fetch("https://valorant-api.com/v1/weapons/skinchromas?language=pt-BR");
  if (!res.ok) return [];
  const json = await res.json();
  const data = Array.isArray(json.data) ? json.data : [];
  skinChromasCatalogCache = { data, expiry: now + VALORANT_API_CACHE_MS };
  return data;
}

// Fetch skin details from valorant-api.com
const fetchValorantSkins = async (uuids: string[]) => {
  const normalizedUuids = Array.from(new Set((uuids || []).map((u) => String(u).toLowerCase()).filter((u) => UUID_REGEX.test(u))));
  if (normalizedUuids.length === 0) return [];

  const skinsCatalog = await getWeaponSkinsCatalog();
  if (skinsCatalog.length === 0) return [];

  const skinLookup = buildSkinLookup(skinsCatalog);

  const matched: ValorantSkinItem[] = [];
  const missing: string[] = [];
  const firstSeenOrder = new Map<string, number>();
  const uuidOrder = new Map(normalizedUuids.map((uuid, index) => [uuid, index]));

  for (const [index, uuid] of normalizedUuids.entries()) {
    const entry = skinLookup.get(uuid);
    if (entry) {
      matched.push(entry);
      if (!firstSeenOrder.has(entry.name)) {
        firstSeenOrder.set(entry.name, index);
      }
    } else {
      missing.push(uuid);
    }
  }

  // Fallback for edge cases where UUID exists only in flat endpoints
  if (missing.length > 0) {
    try {
      const [levelsData, chromasData] = await Promise.all([
        getSkinLevelsCatalog(),
        getSkinChromasCatalog(),
      ]);

      const fallbackByUuid = new Map<string, ValorantSkinItem>();

      if (levelsData.length > 0) {
        for (const lvl of levelsData) {
          const id = String(lvl?.uuid || "").toLowerCase();
          if (!id || !UUID_REGEX.test(id)) continue;
          const image = lvl.displayIcon || null;
          if (!image) continue;
          const fallbackName = lvl.displayName;
          const { displayScore, isPremiumHint, lineageRank, weaponRank, effectiveRarity } = getSkinRankMeta(fallbackName, 0);
          fallbackByUuid.set(id, {
            name: fallbackName,
            image,
            rarity: null,
            rarityPriority: 0,
            effectiveRarity,
            lineageRank,
            weaponRank,
            displayScore,
            isPremiumHint
          });
        }
      }

      if (chromasData.length > 0) {
        for (const c of chromasData) {
          const id = String(c?.uuid || "").toLowerCase();
          if (!id || !UUID_REGEX.test(id)) continue;
          const image = c.fullRender || c.displayIcon || c.swatch || null;
          if (!image) continue;
          if (!fallbackByUuid.has(id)) {
            const fallbackName = c.displayName;
            const { displayScore, isPremiumHint, lineageRank, weaponRank, effectiveRarity } = getSkinRankMeta(fallbackName, 0);
            fallbackByUuid.set(id, {
              name: fallbackName,
              image,
              rarity: null,
              rarityPriority: 0,
              effectiveRarity,
              lineageRank,
              weaponRank,
              displayScore,
              isPremiumHint
            });
          }
        }
      }

      for (const uuid of missing) {
        const fallback = fallbackByUuid.get(uuid);
        if (fallback) {
          matched.push(fallback);
          if (!firstSeenOrder.has(fallback.name)) {
            firstSeenOrder.set(fallback.name, uuidOrder.get(uuid) ?? Number.MAX_SAFE_INTEGER);
          }
        }
      }
    } catch {


      // ignore fallback failures
    }}
  // Deduplicate by skin name (same skin via base uuid + level + chroma)
  const deduped = new Map<string, ValorantSkinItem>();
  for (const skin of matched) {
    const key = skin.name;
    const existing = deduped.get(key);
    if (!existing || skin.displayScore > existing.displayScore) {
      deduped.set(key, skin);
    }
  }

  const final = Array.from(deduped.values());

  // Ordem exatamente como postada no LZT (primeiro UUID visto no inventário)
  final.sort((a, b) => {
    const orderA = firstSeenOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const orderB = firstSeenOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return final;
};

type SimpleGalleryItem = {
  name: string;
  image: string;
  /** Só skins Valorant; agentes/buddies não têm */
  rarity?: ValorantSkinItem["rarity"] | null;
};

const fetchValorantAgents = async (uuids: string[]): Promise<SimpleGalleryItem[]> => {
  const res = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=pt-BR");
  if (!res.ok) return [];
  const data: unknown = await res.json();
  const uuidSet = new Set(uuids.map((u) => u.toLowerCase()));

  const list = getJsonDataArray(data);

  return list
    .filter((a): a is Record<string, unknown> => isRecord(a))
    .filter((a) => {
      const maybeUuid = a.uuid;
      return typeof maybeUuid === "string" && uuidSet.has(maybeUuid.toLowerCase());
    })
    .map((a) => ({
      name: typeof a.displayName === "string" ? a.displayName : "Agente",
      image: typeof a.displayIcon === "string" ? a.displayIcon : "",
    }))
    .filter((a): a is SimpleGalleryItem => typeof a.image === "string" && a.image.length > 0);
};

const fetchValorantBuddies = async (uuids: string[]): Promise<SimpleGalleryItem[]> => {
  const res = await fetch("https://valorant-api.com/v1/buddies?language=pt-BR");
  if (!res.ok) return [];
  const data: unknown = await res.json();
  const uuidSet = new Set(uuids.map((u) => u.toLowerCase()));

  const list = getJsonDataArray(data);

  const typedMatched: SimpleGalleryItem[] = [];
  for (const buddy of list) {
    if (!isRecord(buddy)) continue;
    const b = buddy;
    if (typeof b.uuid === "string" && uuidSet.has(b.uuid.toLowerCase())) {
      typedMatched.push({ name: String(b.displayName || "Buddy"), image: String(b.displayIcon || "") });
    }
    // Also check levels
    if (Array.isArray(b.levels)) {
      for (const level of b.levels) {
        if (level && typeof level.uuid === "string" && uuidSet.has(level.uuid.toLowerCase())) {
          typedMatched.push({ name: String(b.displayName || "Buddy"), image: String(level.displayIcon || b.displayIcon || "") });
        }
      }
    }
  }
  return typedMatched.filter((x): x is SimpleGalleryItem => typeof x.image === "string" && x.image.length > 0);
};

const ContaDetalhes = () => {
  const { id } = useParams<{id: string;}>();
  const navigate = useNavigate();
  const { getPrice, getDisplayPrice } = useLztMarkup();
  const [selectedSkin, setSelectedSkin] = useState(0);
  const [activeTab, setActiveTab] = useState<"skins" | "agents" | "buddies">("skins");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const viewTracked = useRef(false);

  // Reset selectedSkin when account changes
  useEffect(() => {
    setSelectedSkin(0);
    setLightboxIndex(null);
    setActiveTab("skins");
    viewTracked.current = false;
  }, [id]);
  const { addItem } = useCart();
  const queryClient = useQueryClient();

  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: lztAccountDetailQueryKey("valorant", id ?? ""),
    queryFn: () => fetchAccountDetail(id!),
    enabled: !!id,
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });

  const item = data?.item;
  const rank = item?.riot_valorant_rank ? rankMap[item.riot_valorant_rank] : null;
  const inventory = item?.valorantInventory;
  const skinCount = item?.riot_valorant_skin_count ?? 0;

  const cleanedTitle = useMemo(
    () =>
      getLztDetailDisplayTitle(item?.title, {
        game: "valorant",
        rankName: rank?.name || "Unranked",
        skinCount,
      }),
    [item?.title, rank?.name, skinCount],
  );

  const handleBuyNow = async () => {
    if (!item || checkingAvailability) return;
    setCheckingAvailability(true);
    const available = await checkLztAvailability(String(item.item_id), "valorant", { queryClient });
    setCheckingAvailability(false);
    if (!available) return;
    const priceBRL = getPrice(item, "valorant");

    trackInitiateCheckout({
      contentName: cleanedTitle,
      contentIds: [`lzt-${item.item_id}`],
      value: priceBRL,
    });

    const added = addItem({
      productId: `lzt-${item.item_id}`,
      productName: cleanedTitle,
      productImage: rank?.img || null,
      planId: "lzt-account",
      planName: "Conta Valorant",
      price: priceBRL,
      type: "lzt-account",
      lztItemId: String(item.item_id),
      lztPrice: item.price,
      lztCurrency: item.price_currency || "rub",
      lztGame: "valorant",
      skinsCount: skinCount,
    });
    if (added) navigate("/checkout");
  };

  // ViewContent tracking (cleanedTitle deve existir antes deste effect)
  useEffect(() => {
    if (item && !viewTracked.current) {
      viewTracked.current = true;
      const priceBRL = getPrice(item, "valorant");
      trackViewContent({
        contentName: cleanedTitle,
        contentIds: [`lzt-${item.item_id}`],
        value: priceBRL,
      });
    }
  }, [item, getPrice, cleanedTitle]);

  // Gallery from screenshots
  const gallery = useMemo(() => {
    if (!item) return [];
    const list: {name: string;image: string;}[] = [];
    if (item.ss && Array.isArray(item.ss)) {
      for (const ss of item.ss) {
        if (typeof ss === "string") list.push({ name: "Screenshot", image: ss });else
        if (ss?.original || ss?.small) list.push({ name: "Screenshot", image: ss.original || ss.small });
      }
    }
    return list;
  }, [item]);

  // Fetch inventory UUIDs with robust normalization (array/object/nested)
  const skinUuids = collectUuidStrings(inventory?.WeaponSkins);
  const agentUuids = collectUuidStrings(inventory?.Agent);
  const buddyUuids = collectUuidStrings(inventory?.Buddy);

  const { data: skinItems = [], isLoading: skinsLoading, isError: skinsError } = useQuery({
    queryKey: ["valorant-skins", "rarity-v13", skinUuids],
    queryFn: () => fetchValorantSkins(skinUuids),
    enabled: skinUuids.length > 0,
    staleTime: 1000 * 60 * 30,
    retry: 2
  });

  const { data: agentItems = [], isLoading: agentsLoading, isError: agentsError } = useQuery({
    queryKey: ["valorant-agents", agentUuids],
    queryFn: () => fetchValorantAgents(agentUuids),
    enabled: activeTab === "agents" && agentUuids.length > 0,
    staleTime: 1000 * 60 * 30,
    retry: 2
  });

  const { data: buddyItems = [], isLoading: buddiesLoading, isError: buddiesError } = useQuery({
    queryKey: ["valorant-buddies", buddyUuids],
    queryFn: () => fetchValorantBuddies(buddyUuids),
    enabled: activeTab === "buddies" && buddyUuids.length > 0,
    staleTime: 1000 * 60 * 30,
    retry: 2
  });

  const activeLoading = activeTab === "skins" ? skinsLoading : activeTab === "agents" ? agentsLoading : buddiesLoading;
  const activeError = activeTab === "skins" ? skinsError : activeTab === "agents" ? agentsError : buddiesError;

  // Use skin items as main gallery if no screenshots
  const mainGallery = gallery.length > 0 ? gallery : skinItems.slice(0, 5);

  const galleryLength = skinItems.length > 0 ? skinItems.length : mainGallery.length;

  // Clamp selectedSkin to valid range when data changes
  const clampedSkin = galleryLength > 0 ? Math.min(selectedSkin, galleryLength - 1) : 0;
  useEffect(() => {
    if (selectedSkin !== clampedSkin) setSelectedSkin(clampedSkin);
  }, [clampedSkin, selectedSkin]);

  const handlePrev = () => setSelectedSkin((p) => p > 0 ? p - 1 : galleryLength - 1);
  const handleNext = () => setSelectedSkin((p) => p < galleryLength - 1 ? p + 1 : 0);

  const tabs = [
  { key: "skins" as const, label: "Skins", icon: <Swords className="h-4 w-4" />, count: skinItems.length > 0 ? skinItems.length : skinUuids.length },
  { key: "agents" as const, label: "Agentes", icon: <Users className="h-4 w-4" />, count: agentItems.length > 0 ? agentItems.length : agentUuids.length },
  { key: "buddies" as const, label: "Buddies", icon: <Star className="h-4 w-4" />, count: buddyItems.length > 0 ? buddyItems.length : buddyUuids.length }];


  const activeItems = activeTab === "skins" ? skinItems : activeTab === "agents" ? agentItems : buddyItems;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-5 sm:px-6 pt-4 pb-32 sm:pb-20">
        <button
          onClick={() => navigate("/contas")}
          className="mb-5 sm:mb-5 flex items-center gap-2 rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-muted-foreground transition-all hover:border-success/40 hover:text-success">
          
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        {isLoading &&
        <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-success" />
            <p className="mt-3 text-sm text-muted-foreground">Carregando detalhes...</p>
          </div>
        }

        {error &&
        <div className="flex flex-col items-center justify-center py-32">
            <Shield className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold text-foreground">Conta indisponível</p>
            <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
            <button
              onClick={() => navigate("/contas")}
              className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-card/50 px-5 py-2.5 text-sm text-muted-foreground transition-all hover:border-success/40 hover:text-success">
              <ArrowLeft className="h-4 w-4" />
              Ver outras contas
            </button>
          </div>
        }

        {item &&
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {/* Breadcrumb */}
            <div className="mb-5 sm:mb-6 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground overflow-x-auto scrollbar-hide">
              <button onClick={() => navigate("/")} className="hover:text-success transition-colors shrink-0">Início</button>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <button onClick={() => navigate("/contas")} className="hover:text-success transition-colors shrink-0">Valorant</button>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="text-foreground font-medium truncate">{rank?.name || "Unranked"}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
              {/* LEFT: Gallery only */}
              <div className="lg:col-span-3 space-y-4 sm:space-y-4">
                {/* Single skin carousel */}
                {skinItems.length > 0 && !skinsLoading ?
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden aspect-[4/3] sm:aspect-[16/10] relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--secondary))] via-[hsl(var(--background))] to-[hsl(var(--secondary))]" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--success)/0.06),transparent_70%)]" />
                    <AnimatePresence mode="wait">
                      <motion.div
                    key={selectedSkin}
                    className="relative z-[1] flex items-center justify-center h-full w-full p-6 sm:p-8 cursor-pointer"
                    onClick={() => {setActiveTab("skins");setLightboxIndex(selectedSkin);}}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}>
                    
                        <img
                      src={getProxiedImageUrl(skinItems[selectedSkin]?.image)}
                      alt={skinItems[selectedSkin]?.name}
                      className="max-h-full max-w-full object-contain" />
                    
                      </motion.div>
                    </AnimatePresence>
                    {skinItems.length > 1 &&
                <>
                        <button onClick={handlePrev} className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 z-[2] flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:text-success">
                          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button onClick={handleNext} className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 z-[2] flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:text-success">
                          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 rotate-180" />
                        </button>
                      </>
                }
                    {/* Counter only */}
                    <div className="absolute bottom-3 right-3 z-[2] rounded-lg bg-background/60 backdrop-blur-sm px-2.5 py-1">
                      <p className="text-[11px] text-muted-foreground tabular-nums">{selectedSkin + 1}/{skinItems.length}</p>
                    </div>
                  </div> :
              mainGallery.length > 0 ?
              <div className="relative group rounded-lg border border-border bg-card overflow-hidden aspect-[4/3] sm:aspect-[16/10]">
                    <AnimatePresence mode="wait">
                      <motion.img
                    key={selectedSkin}
                    src={getProxiedImageUrl(mainGallery[selectedSkin]?.image)}
                    alt={mainGallery[selectedSkin]?.name}
                    className="h-full w-full object-contain p-6"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }} />
                  
                    </AnimatePresence>
                    {mainGallery.length > 1 &&
                <>
                        <button onClick={handlePrev} className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-success hover:border-success/40">
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button onClick={handleNext} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-success hover:border-success/40">
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                }
                  </div> :

              <div className="rounded-lg border border-border bg-card flex items-center justify-center aspect-[4/3] sm:aspect-[16/10]">
                    <div className="flex flex-col items-center gap-4">
                      <img src={rank?.img || rankUnranked} alt={rank?.name || "Unranked"} className="h-28 w-28 object-contain drop-shadow-xl" />
                      <p className="text-2xl font-bold text-foreground">{rank?.name || "Unranked"}</p>
                    </div>
                  </div>
              }

              {/* Rank + Stats */}
                <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-5 space-y-4 sm:space-y-4">
                  <div className="flex items-center justify-center gap-6 sm:justify-between">
                    {/* Último rank (esquerda) */}
                    {item.riot_valorant_previous_rank && rankMap[item.riot_valorant_previous_rank] ?
                  <div className="flex flex-col items-center gap-1.5">
                        <img src={rankMap[item.riot_valorant_previous_rank].img} alt="" className="h-14 w-14 sm:h-16 sm:w-16 object-contain opacity-50" />
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Último rank</p>
                          <p className="text-xs sm:text-sm font-bold text-muted-foreground">{rankMap[item.riot_valorant_previous_rank].name}</p>
                        </div>
                      </div> :

                  <div />
                  }

                    {/* Seta no meio */}
                    <div className="flex items-center text-success">
                      <ChevronRight className="h-6 w-6" />
                    </div>

                    {/* Rank atual (direita) */}
                    <div className="flex flex-col items-center gap-1.5">
                      <img src={rank?.img || rankUnranked} alt={rank?.name || "Unranked"} className="h-14 w-14 sm:h-16 sm:w-16 object-contain" />
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Rank atual</p>
                        <p className="text-xs sm:text-sm font-bold text-foreground">{rank?.name || "Unranked"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 sm:pt-4">
                    <h3 className="text-sm font-bold text-foreground mb-3 sm:mb-3">Informações da Conta</h3>
                    <div className="grid grid-cols-2 gap-2 sm:gap-2">
                      {item.valorantRegionPhrase && <StatCell label="Região" value={translateRegion(item.valorantRegionPhrase)} />}
                      {item.riot_valorant_wallet_vp != null && <StatCell label="VP na conta" value={item.riot_valorant_wallet_vp} />}
                      {item.riot_valorant_wallet_rp != null && item.riot_valorant_wallet_rp > 0 && <StatCell label="RP na conta" value={item.riot_valorant_wallet_rp} />}
                      {item.riot_valorant_inventory_value != null && <StatCell label="Valor inventário" value={`$${item.riot_valorant_inventory_value}`} />}
                      {item.riot_valorant_level != null && <StatCell label="Nível" value={item.riot_valorant_level} />}
                      {item.riot_valorant_knife_count != null && item.riot_valorant_knife_count > 0 && <StatCell label="Knifes" value={item.riot_valorant_knife_count} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Purchase + Full Acesso */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-4">
                <div className="lg:sticky lg:top-20 space-y-4">
                {/* Title + Purchase */}
                <div className="rounded-xl border border-success/20 bg-card p-5 sm:p-5 space-y-4 shadow-[0_0_40px_hsl(var(--success)/0.05)]">
                  <h1 className="text-lg sm:text-lg font-bold text-foreground leading-snug">{cleanedTitle}</h1>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 border border-success/30 px-3 py-1 text-[11px] font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      FULL ACESSO
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      Conta verificável
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2.5"><span className="text-success font-bold">✓</span> Entrega automática</p>
                    <p className="flex items-center gap-2.5"><span className="text-success font-bold">✓</span> Liberação instantânea</p>
                    <p className="flex items-center gap-2.5"><span className="text-success font-bold">✓</span> Garantia de acesso</p>
                  </div>

                  <div className="rounded-xl bg-secondary/30 p-4 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Por apenas</p>
                      <p className="text-2xl sm:text-3xl font-bold text-success">
                        {getDisplayPrice(item, "valorant")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={checkingAvailability}
                    aria-busy={checkingAvailability}
                    className="btn-shine group relative flex w-full items-center justify-center gap-2.5 rounded-xl bg-success py-4 text-sm font-bold uppercase tracking-[0.2em] text-success-foreground transition-all hover:shadow-[0_0_40px_hsl(var(--success)/0.4)] active:scale-[0.98] disabled:opacity-60"
                    style={{ fontFamily: "'Valorant', sans-serif" }}
                  >
                    {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 group-hover:animate-pulse" />}
                    {checkingAvailability ? "VERIFICANDO..." : "COMPRAR AGORA"}
                  </button>

                  {/* Trust signals */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-3 px-2">
                      <Zap className="h-4 w-4 text-success" />
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Entrega<br/>Instantânea</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-3 px-2">
                      <Shield className="h-4 w-4 text-success" />
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Pagamento<br/>Seguro</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-3 px-2">
                      <Star className="h-4 w-4 text-success" />
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Suporte<br/>24/7</span>
                    </div>
                  </div>

                  {item.item_id && (
                    <p className="text-[10px] text-muted-foreground/40 text-center break-all">Código: {item.item_id}</p>
                  )}

                  <div className="grid grid-cols-4 rounded-xl overflow-hidden bg-secondary/20">
                    <HighlightStat label="Skins" value={item.riot_valorant_skin_count ?? 0} />
                    <HighlightStat label="Agentes" value={item.riot_valorant_agent_count ?? 0} />
                    <HighlightStat label="Nível" value={item.riot_valorant_level ?? 0} />
                    <HighlightStat label="Knifes" value={item.riot_valorant_knife_count ?? 0} />
                  </div>
                </div>

                {/* Full Acesso */}
                <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7 text-success" />
                    <h3 className="text-base sm:text-lg font-bold text-foreground">Conta FULL ACESSO</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Acesso total: email original, alteração de senha e dados, sem enrolação.
                  </p>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-3"><span className="text-success text-lg">•</span> Email e senha inclusos</li>
                    <li className="flex items-center gap-3"><span className="text-success text-lg">•</span> Senha alterável</li>
                    <li className="flex items-center gap-3"><span className="text-success text-lg">•</span> Conta verificável</li>
                  </ul>
                </div>
                </div>
              </div>
            </div>

            {/* Inventory Tabs - Full width below */}
            {(skinUuids.length > 0 || agentUuids.length > 0 || buddyUuids.length > 0) &&
          <div className="mt-4 sm:mt-5">
                {/* Tab buttons */}
                <div className="flex w-full gap-2 mb-5 sm:mb-5">
                  {tabs.map((tab) =>
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key ?
                "bg-success/10 text-success" :
                "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"}`
                }>
                
                      {tab.icon}
                      <span>{tab.label}</span>
                      {tab.count > 0 &&
                <span className={`rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-bold ${
                activeTab === tab.key ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`
                }>
                          {tab.count}
                        </span>
                }
                    </button>
              )}
                </div>

                {/* Items grid */}
                {activeItems.length > 0 ?
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
                    {activeItems.map((invItem, i) =>
              <motion.div
                key={`${activeTab}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.015 }}
                className="group rounded-xl bg-card overflow-hidden hover:ring-1 hover:ring-success/30 transition-all relative cursor-pointer"
                onClick={() => setLightboxIndex(i)}>
                
                        {invItem.rarity &&
                <div className="absolute top-1.5 right-1.5 z-10">
                            
                          </div>
                }
                        <div className="relative flex aspect-square items-center justify-center p-3 sm:p-4 bg-secondary/30 rounded-xl group-hover:bg-secondary/50 transition-colors">
                          <img
                    src={getProxiedImageUrl(invItem.image)}
                    alt={invItem.name}
                    className="h-full w-full object-contain drop-shadow-md transition-transform group-hover:scale-110"
                    loading="lazy" />
                  
                        </div>
                        <div className="px-2 py-1.5 sm:p-2 flex items-center gap-1 sm:gap-1.5">
                          <p className="text-[10px] sm:text-[11px] font-medium text-foreground/80 truncate">{invItem.name}</p>
                        </div>
                      </motion.div>
              )}
                  </div> :
            activeLoading ?
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-xl" />
              ))}
            </div> :
            activeError ?
            <div className="flex items-center justify-center py-12 rounded-lg border border-border bg-card">
                    <p className="text-sm text-muted-foreground">Erro ao carregar itens. Tente recarregar a página.</p>
                  </div> :

            <div className="flex items-center justify-center py-12 rounded-lg border border-border bg-card">
                    <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
                  </div>
            }

                {/* Lightbox Modal */}
                <AnimatePresence>
                  {lightboxIndex !== null && activeItems[lightboxIndex] && (() => {
                const currentItem = activeItems[lightboxIndex];
                const total = activeItems.length;
                const goPrev = () => setLightboxIndex((prev) => prev !== null ? (prev - 1 + total) % total : null);
                const goNext = () => setLightboxIndex((prev) => prev !== null ? (prev + 1) % total : null);
                return (
                  <motion.div
                    key="lightbox"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setLightboxIndex(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setLightboxIndex(null);
                      if (e.key === "ArrowLeft") goPrev();
                      if (e.key === "ArrowRight") goNext();
                    }}
                    tabIndex={0}
                    ref={(el) => el?.focus()}>
                    
                        <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="relative bg-card border border-border rounded-xl max-w-lg w-[90vw] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}>
                      
                          {/* Close */}
                          <button onClick={() => setLightboxIndex(null)} className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-5 w-5" />
                          </button>

                          {/* Image */}
                          <div className="aspect-[4/3] bg-secondary/20 flex items-center justify-center p-8 border-b border-border">
                            <img src={getProxiedImageUrl(currentItem.image)} alt={currentItem.name} className="max-h-full max-w-full object-contain" />
                          </div>

                          {/* Info */}
                          <div className="p-5 flex flex-col items-center gap-3">
                            <h3 className="text-base font-bold text-foreground text-center">{currentItem.name}</h3>
                            {currentItem.rarity &&
                        <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Edição:</span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium" style={{ color: currentItem.rarity.color }}>
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentItem.rarity.color }} />
                                  {currentItem.rarity.name} Edition
                                </span>
                              </div>
                        }

                            {/* Navigation */}
                            <div className="flex items-center gap-4 mt-1">
                              <button onClick={goPrev} className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors">
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <span className="text-sm text-muted-foreground tabular-nums">{lightboxIndex + 1}/{total}</span>
                              <button onClick={goNext} className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors">
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>

                            <p className="text-[11px] text-muted-foreground mt-1">Clique fora da imagem ou ESC para fechar</p>
                          </div>
                        </motion.div>
                      </motion.div>);

              })()}
                </AnimatePresence>

              </div>
          }

            {/* Description */}
            {item.description &&
          <div className="mt-4 sm:mt-6 rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="text-xs sm:text-sm font-bold text-foreground mb-2">Descrição</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{item.description}</p>
              </div>
          }
          </motion.div>
        }
      </div>

      {/* Sticky mobile bottom bar */}
      {item &&
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
          <div className="border-t border-border bg-card/95 backdrop-blur-xl px-5 py-3.5 safe-area-bottom">
            <div className="flex items-center gap-4">
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground leading-none mb-0.5">Total</span>
                <span className="text-xl font-bold text-success leading-tight">
                  {getDisplayPrice(item, "valorant")}
                </span>
              </div>
              <button
              type="button"
              onClick={handleBuyNow}
              disabled={checkingAvailability}
              aria-busy={checkingAvailability}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success py-3.5 text-sm font-bold uppercase tracking-wider text-success-foreground transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ fontFamily: "'Valorant', sans-serif" }}>
              
                {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                {checkingAvailability ? "Verificando..." : "Comprar Agora"}
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

};

const StatCell = forwardRef<HTMLDivElement, {label: string;value: string | number;}>(({ label, value }, ref) =>
<div ref={ref} className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-bold text-foreground">{value}</span>
  </div>);
StatCell.displayName = "StatCell";


const HighlightStat = forwardRef<HTMLDivElement, {label: string;value: string | number;}>(({ label, value }, ref) =>
<div ref={ref} className="flex flex-col items-center py-3.5 px-1.5">
    <span className="text-[10px] text-muted-foreground mb-1">{label}</span>
    <span className="text-base font-bold text-success">{value}</span>
  </div>
);
HighlightStat.displayName = "HighlightStat";

export default ContaDetalhes;