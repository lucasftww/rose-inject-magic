import { useParams, useNavigate } from "react-router-dom";
import { throwApiError } from "@/lib/apiErrors";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { ArrowLeft, Shield, Loader2, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon, CheckCircle2, Swords, Users, Star, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect, useRef, forwardRef } from "react";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { trackViewContent, trackInitiateCheckout } from "@/lib/metaPixel";

import rankFerro from "@/assets/rank-ferro.png";
import rankBronze from "@/assets/rank-bronze.png";
import rankPrata from "@/assets/rank-prata.png";
import rankOuro from "@/assets/rank-ouro.png";
import rankPlatina from "@/assets/rank-platina.png";
import rankDiamante from "@/assets/rank-diamante.png";
import rankAscendente from "@/assets/rank-ascendente.png";
import rankImortal from "@/assets/rank-imortal.png";
import rankRadiante from "@/assets/rank-radiante.png";
import rankUnranked from "@/assets/rank-unranked.png";

import raritySelect from "@/assets/rarity-select.png";
import rarityDeluxe from "@/assets/rarity-deluxe.png";
import rarityPremium from "@/assets/rarity-premium.png";
import rarityUltra from "@/assets/rarity-ultra.png";
import rarityExclusive from "@/assets/rarity-exclusive.png";

const rarityMap: Record<string, { name: string; img: string; color: string }> = {
  "0cebb8be-46d7-c12a-d306-e9907bfc5a25": { name: "Select", img: raritySelect, color: "hsl(210, 55%, 60%)" },
  "12683d76-48d7-84a3-4e09-6985794f0445": { name: "Deluxe", img: rarityDeluxe, color: "hsl(170, 55%, 45%)" },
  "60bca009-4182-7998-dee7-b8a2558dc369": { name: "Premium", img: rarityPremium, color: "hsl(330, 50%, 55%)" },
  "e046854e-406c-37f4-6571-7a8baeeb93ab": { name: "Ultra", img: rarityUltra, color: "hsl(45, 70%, 55%)" },
  "411e4a55-4e59-7757-41f0-86a53f101bb5": { name: "Exclusive", img: rarityExclusive, color: "hsl(25, 65%, 55%)" },
};

const rankMap: Record<number, { name: string; img: string }> = {
  0: { name: "Unranked", img: rankUnranked },
  1: { name: "Unranked", img: rankUnranked },
  2: { name: "Unranked", img: rankUnranked },
  3: { name: "Ferro 1", img: rankFerro },
  4: { name: "Ferro 2", img: rankFerro },
  5: { name: "Ferro 3", img: rankFerro },
  6: { name: "Bronze 1", img: rankBronze },
  7: { name: "Bronze 2", img: rankBronze },
  8: { name: "Bronze 3", img: rankBronze },
  9: { name: "Prata 1", img: rankPrata },
  10: { name: "Prata 2", img: rankPrata },
  11: { name: "Prata 3", img: rankPrata },
  12: { name: "Ouro 1", img: rankOuro },
  13: { name: "Ouro 2", img: rankOuro },
  14: { name: "Ouro 3", img: rankOuro },
  15: { name: "Platina 1", img: rankPlatina },
  16: { name: "Platina 2", img: rankPlatina },
  17: { name: "Platina 3", img: rankPlatina },
  18: { name: "Diamante 1", img: rankDiamante },
  19: { name: "Diamante 2", img: rankDiamante },
  20: { name: "Diamante 3", img: rankDiamante },
  21: { name: "Ascendente 1", img: rankAscendente },
  22: { name: "Ascendente 2", img: rankAscendente },
  23: { name: "Ascendente 3", img: rankAscendente },
  24: { name: "Imortal 1", img: rankImortal },
  25: { name: "Imortal 2", img: rankImortal },
  26: { name: "Imortal 3", img: rankImortal },
  27: { name: "Radiante", img: rankRadiante },
};

const fetchAccountDetail = async (itemId: string) => {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(
    `${projectUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=valorant`,
    { headers: { "Content-Type": "application/json", apikey: anonKey } }
  );
  if (!res.ok) throwApiError(res.status);
  return res.json();
};

// Rarity priority for sorting (keys must be lowercase for comparison)
const RARITY_PRIORITY: Record<string, number> = {
  "411e4a55-4e59-7757-41f0-86a53f101bb5": 5, // Exclusive
  "e046854e-406c-37f4-6571-7a8baeeb93ab": 4, // Ultra
  "60bca009-4182-7998-dee7-b8a2558dc369": 3, // Premium
  "12683d76-48d7-84a3-4e09-6985794f0445": 2, // Deluxe
  "0cebb8be-46d7-c12a-d306-e9907bfc5a25": 1, // Select / Battle Pass
};

// Permissive UUID pattern (Valorant UUIDs don't strictly follow RFC 4122)
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

    if (typeof value === "object") {
      for (const item of Object.values(value as Record<string, unknown>)) {
        walk(item);
      }
    }
  };

  walk(raw);
  return Array.from(new Set(out));
};

// Resolve the best image from a skin object
const resolveSkinImage = (s: any): string | null => {
  if (s.displayIcon) return s.displayIcon;

  if (s.levels) {
    for (const lvl of s.levels) {
      if (lvl.displayIcon) return lvl.displayIcon;
    }
  }

  if (s.chromas) {
    for (const c of s.chromas) {
      if (c.fullRender) return c.fullRender;
      if (c.displayIcon) return c.displayIcon;
      if (c.swatch) return c.swatch;
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
  ["recon", "reconhecimento"],
];

const normalizeSkinName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

type SkinRankMeta = {
  displayScore: number;
  isPremiumHint: boolean;
  lineageRank: number;
  weaponRank: number;
  effectiveRarity: number;
};

const getSkinRankMeta = (name: string, _rarityPriority: number): SkinRankMeta => {
  const normalized = normalizeSkinName(name);

  const lineageRank =
    LINEAGE_TIERS.find((tier) => tier.hints.some((hint) => normalized.includes(hint)))?.rank || 0;

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

const buildSkinLookup = (skins: any[]): Map<string, ValorantSkinItem> => {
  const lookup = new Map<string, ValorantSkinItem>();

  for (const s of skins || []) {
    const image = resolveSkinImage(s);
    if (!image) continue;

    const rawTier = (s.contentTierUuid || "").toLowerCase();
    const rarityPriority = RARITY_PRIORITY[rawTier] || 0;
    const { displayScore, isPremiumHint, lineageRank, weaponRank, effectiveRarity } = getSkinRankMeta(s.displayName, rarityPriority);

    const entry: ValorantSkinItem = {
      name: s.displayName,
      image,
      rarity: rawTier ? rarityMap[rawTier] || null : null,
      rarityPriority,
      effectiveRarity,
      lineageRank,
      weaponRank,
      displayScore,
      isPremiumHint,
    };

    if (s.uuid) lookup.set(String(s.uuid).toLowerCase(), entry);

    for (const level of s.levels || []) {
      if (level?.uuid) lookup.set(String(level.uuid).toLowerCase(), entry);
    }

    for (const chroma of s.chromas || []) {
      if (chroma?.uuid) lookup.set(String(chroma.uuid).toLowerCase(), entry);
    }
  }

  return lookup;
};

// Fetch skin details from valorant-api.com
const fetchValorantSkins = async (uuids: string[]) => {
  const normalizedUuids = Array.from(new Set((uuids || []).map((u) => String(u).toLowerCase()).filter((u) => UUID_REGEX.test(u))));
  if (normalizedUuids.length === 0) return [];

  const skinsRes = await fetch("https://valorant-api.com/v1/weapons/skins?language=pt-BR");
  if (!skinsRes.ok) return [];

  const skinsData = await skinsRes.json();
  const skinLookup = buildSkinLookup(skinsData.data || []);

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
      const [levelsRes, chromasRes] = await Promise.all([
        fetch("https://valorant-api.com/v1/weapons/skinlevels?language=pt-BR"),
        fetch("https://valorant-api.com/v1/weapons/skinchromas?language=pt-BR"),
      ]);

      const fallbackByUuid = new Map<string, ValorantSkinItem>();

      if (levelsRes.ok) {
        const levelsData = await levelsRes.json();
        for (const lvl of levelsData.data || []) {
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
            isPremiumHint,
          });
        }
      }

      if (chromasRes.ok) {
        const chromasData = await chromasRes.json();
        for (const c of chromasData.data || []) {
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
              isPremiumHint,
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
    }
  }

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

  // Ordem LZT: linhagem no topo e, dentro da mesma linhagem, ordem original postada no anúncio
  final.sort((a, b) => {
    if (a.lineageRank !== b.lineageRank) return b.lineageRank - a.lineageRank;
    const orderA = firstSeenOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const orderB = firstSeenOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return final;
};

const fetchValorantAgents = async (uuids: string[]) => {
  const res = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=pt-BR");
  if (!res.ok) return [];
  const data = await res.json();
  const uuidSet = new Set(uuids.map(u => u.toLowerCase()));
  return (data.data || []).filter((a: any) => uuidSet.has(a.uuid?.toLowerCase())).map((a: any) => ({
    name: a.displayName,
    image: a.displayIcon,
  })).filter((a: any) => a.image);
};

const fetchValorantBuddies = async (uuids: string[]) => {
  const res = await fetch("https://valorant-api.com/v1/buddies?language=pt-BR");
  if (!res.ok) return [];
  const data = await res.json();
  // Buddy UUIDs from inventory might be level UUIDs, so check both
  const uuidSet = new Set(uuids.map(u => u.toLowerCase()));
  const matched: any[] = [];
  for (const buddy of (data.data || [])) {
    if (uuidSet.has(buddy.uuid?.toLowerCase())) {
      matched.push({ name: buddy.displayName, image: buddy.displayIcon });
    }
    // Also check levels
    for (const level of (buddy.levels || [])) {
      if (uuidSet.has(level.uuid?.toLowerCase())) {
        matched.push({ name: buddy.displayName, image: level.displayIcon || buddy.displayIcon });
      }
    }
  }
  return matched.filter((b: any) => b.image);
};

const ContaDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPrice, getDisplayPrice } = useLztMarkup();
  const [selectedSkin, setSelectedSkin] = useState(0);
  const [activeTab, setActiveTab] = useState<"skins" | "agents" | "buddies">("skins");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Reset selectedSkin when account changes
  useEffect(() => {
    setSelectedSkin(0);
    setLightboxIndex(null);
    setActiveTab("skins");
  }, [id]);
  const { addItem } = useCart();
  const viewTracked = useRef(false);

  const handleBuyNow = () => {
    if (!item) return;
    const rankName = rank?.name || "Unranked";
    const skinCount = item.riot_valorant_skin_count ?? 0;
    const title = `Conta ${rankName} com ${skinCount} Skins`;
    const priceBRL = getPrice(item, "valorant");

    trackInitiateCheckout({
      contentName: title,
      contentCategory: "Valorant",
      contentIds: [`lzt-${item.item_id}`],
      value: priceBRL,
    });

    const added = addItem({
      productId: `lzt-${item.item_id}`,
      productName: title,
      productImage: rank?.img || null,
      planId: "lzt-account",
      planName: "Conta Valorant",
      price: priceBRL,
      type: "lzt-account",
      lztItemId: String(item.item_id),
      lztPrice: item.price,
      lztCurrency: item.price_currency || "rub",
      lztGame: "valorant",
    });
    if (added) navigate("/checkout");
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["lzt-account-detail", id],
    queryFn: () => fetchAccountDetail(id!),
    enabled: !!id,
  });

  const item = data?.item;
  const rank = item?.riot_valorant_rank ? rankMap[item.riot_valorant_rank] : null;
  const inventory = item?.valorantInventory;

  // ViewContent tracking
  useEffect(() => {
    if (item && !viewTracked.current) {
      viewTracked.current = true;
      const priceBRL = getPrice(item, "valorant");
      trackViewContent({
        contentName: `Conta Valorant #${item.item_id}`,
        contentCategory: "Valorant",
        contentIds: [`lzt-${item.item_id}`],
        value: priceBRL,
      });
    }
  }, [item]);

  // Gallery from screenshots
  const gallery = useMemo(() => {
    if (!item) return [];
    const list: { name: string; image: string }[] = [];
    if (item.ss && Array.isArray(item.ss)) {
      for (const ss of item.ss) {
        if (typeof ss === "string") list.push({ name: "Screenshot", image: ss });
        else if (ss?.original || ss?.small) list.push({ name: "Screenshot", image: ss.original || ss.small });
      }
    }
    return list;
  }, [item]);

  // Fetch inventory UUIDs with robust normalization (array/object/nested)
  const skinUuids = collectUuidStrings(inventory?.WeaponSkins);
  const agentUuids = collectUuidStrings(inventory?.Agent);
  const buddyUuids = collectUuidStrings(inventory?.Buddy);

  const { data: skinItems = [], isLoading: skinsLoading, isError: skinsError } = useQuery({
    queryKey: ["valorant-skins", "rarity-v11", skinUuids],
    queryFn: () => fetchValorantSkins(skinUuids),
    enabled: skinUuids.length > 0,
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });

  const { data: agentItems = [], isLoading: agentsLoading, isError: agentsError } = useQuery({
    queryKey: ["valorant-agents", agentUuids],
    queryFn: () => fetchValorantAgents(agentUuids),
    enabled: agentUuids.length > 0,
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });

  const { data: buddyItems = [], isLoading: buddiesLoading, isError: buddiesError } = useQuery({
    queryKey: ["valorant-buddies", buddyUuids],
    queryFn: () => fetchValorantBuddies(buddyUuids),
    enabled: buddyUuids.length > 0,
    staleTime: 1000 * 60 * 30,
    retry: 2,
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
  
  const handlePrev = () => setSelectedSkin((p) => (p > 0 ? p - 1 : galleryLength - 1));
  const handleNext = () => setSelectedSkin((p) => (p < galleryLength - 1 ? p + 1 : 0));

  const skinCount = item?.riot_valorant_skin_count ?? 0;
  const dynamicTitle = rank
    ? `Conta ${rank.name} com ${skinCount} Skins`
    : `Conta Unranked com ${skinCount} Skins`;

  const tabs = [
    { key: "skins" as const, label: "Skins", icon: <Swords className="h-4 w-4" />, count: skinItems.length },
    { key: "agents" as const, label: "Agentes", icon: <Users className="h-4 w-4" />, count: agentItems.length },
    { key: "buddies" as const, label: "Buddies", icon: <Star className="h-4 w-4" />, count: buddyItems.length },
  ];

  const activeItems = activeTab === "skins" ? skinItems : activeTab === "agents" ? agentItems : buddyItems;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-20">
        <button
          onClick={() => navigate("/contas")}
          className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-success/40 hover:text-success"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-success" />
            <p className="mt-3 text-sm text-muted-foreground">Carregando detalhes...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-lg font-semibold text-destructive">Erro ao carregar conta</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        )}

        {item && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {/* Breadcrumb */}
            <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <button onClick={() => navigate("/")} className="hover:text-success transition-colors">Início</button>
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => navigate("/contas")} className="hover:text-success transition-colors">Valorant</button>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{rank?.name || "Unranked"}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* LEFT: Gallery only */}
              <div className="lg:col-span-3 space-y-4">
                {/* Single skin carousel */}
                {skinItems.length > 0 && !skinsLoading ? (
                  <div className="rounded-lg border border-border bg-card overflow-hidden aspect-[16/10] relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--secondary))] via-[hsl(var(--background))] to-[hsl(var(--secondary))]" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--success)/0.08),transparent_70%)]" />
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedSkin}
                        className="relative z-[1] flex items-center justify-center h-full w-full p-8 cursor-pointer"
                        onClick={() => { setActiveTab("skins"); setLightboxIndex(selectedSkin); }}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <img
                          src={skinItems[selectedSkin]?.image}
                          alt={skinItems[selectedSkin]?.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </motion.div>
                    </AnimatePresence>
                    {skinItems.length > 1 && (
                      <>
                        <button onClick={handlePrev} className="absolute left-3 top-1/2 -translate-y-1/2 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-success hover:border-success/40">
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button onClick={handleNext} className="absolute right-3 top-1/2 -translate-y-1/2 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-success hover:border-success/40">
                          <ChevronRightIcon className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[2] rounded-lg bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{selectedSkin + 1} / {skinItems.length}</p>
                    </div>
                    {skinItems[selectedSkin]?.name && (
                      <div className="absolute top-3 left-3 z-[2] rounded-lg bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5">
                        <p className="text-xs font-medium text-foreground">{skinItems[selectedSkin].name}</p>
                      </div>
                    )}
                  </div>
                ) : mainGallery.length > 0 ? (
                  <div className="relative group rounded-lg border border-border bg-card overflow-hidden aspect-[16/10]">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={selectedSkin}
                        src={mainGallery[selectedSkin]?.image}
                        alt={mainGallery[selectedSkin]?.name}
                        className="h-full w-full object-contain p-6"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      />
                    </AnimatePresence>
                    {mainGallery.length > 1 && (
                      <>
                        <button onClick={handlePrev} className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-success hover:border-success/40">
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button onClick={handleNext} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-success hover:border-success/40">
                          <ChevronRightIcon className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card flex items-center justify-center aspect-[16/10]">
                    <div className="flex flex-col items-center gap-4">
                      <img src={rank?.img || rankUnranked} alt={rank?.name || "Unranked"} className="h-28 w-28 object-contain drop-shadow-xl" />
                      <p className="text-2xl font-bold text-foreground">{rank?.name || "Unranked"}</p>
                    </div>
                  </div>
                )}

                {/* Rank + Stats */}
                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    {/* Último rank (esquerda) */}
                    {item.riot_valorant_previous_rank && rankMap[item.riot_valorant_previous_rank] ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <img src={rankMap[item.riot_valorant_previous_rank].img} alt="" className="h-16 w-16 object-contain opacity-50" />
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Último rank</p>
                          <p className="text-sm font-bold text-muted-foreground">{rankMap[item.riot_valorant_previous_rank].name}</p>
                        </div>
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Seta no meio */}
                    <div className="flex items-center text-success">
                      <ChevronRightIcon className="h-6 w-6" />
                    </div>

                    {/* Rank atual (direita) */}
                    <div className="flex flex-col items-center gap-1.5">
                      <img src={rank?.img || rankUnranked} alt={rank?.name || "Unranked"} className="h-16 w-16 object-contain" />
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Rank atual</p>
                        <p className="text-sm font-bold text-foreground">{rank?.name || "Unranked"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">Informações da Conta</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {item.valorantRegionPhrase && <StatCell label="Região" value={item.valorantRegionPhrase} />}
                      {item.riot_valorant_wallet_vp != null && <StatCell label="VP na conta" value={item.riot_valorant_wallet_vp} />}
                      {item.riot_valorant_wallet_rp != null && item.riot_valorant_wallet_rp > 0 && <StatCell label="RP na conta" value={item.riot_valorant_wallet_rp} />}
                      {item.riot_valorant_inventory_value != null && <StatCell label="Valor inventário" value={`$${item.riot_valorant_inventory_value}`} />}
                      {item.riot_valorant_level != null && <StatCell label="Nível" value={item.riot_valorant_level} />}
                      {item.riot_valorant_knife_count != null && item.riot_valorant_knife_count > 0 && <StatCell label="Knifes" value={item.riot_valorant_knife_count} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Purchase + Rank + Stats + Full Acesso */}
              <div className="lg:col-span-2 space-y-4">
                {/* Title + Purchase */}
                <div className="rounded-lg border border-border bg-card p-5 space-y-3.5">
                  <h1 className="text-lg font-bold text-foreground leading-snug">{dynamicTitle}</h1>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/30 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      FULL ACESSO
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      Conta verificável
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2"><span className="text-success font-bold">✓</span> Entrega automática</p>
                    <p className="flex items-center gap-2"><span className="text-success font-bold">✓</span> Liberação instantânea</p>
                  </div>

                  <div className="rounded-lg bg-card border border-border p-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Por</p>
                      <p className="text-2xl font-bold text-success">
                        {getDisplayPrice(item, "valorant")}
                      </p>
                    </div>
                    {item.rub_price && item.price_currency !== "rub" && (
                      <p className="text-[10px] text-muted-foreground mb-1">≈ $ {(item.price / 5.5).toFixed(2)} USD</p>
                    )}
                  </div>

                  <button
                    onClick={handleBuyNow}
                    className="btn-shine group relative flex w-full items-center justify-center gap-2 border-2 px-5 py-3 text-xs font-bold uppercase tracking-[0.25em] transition-all border-foreground/30 text-foreground hover:border-success hover:text-success hover:shadow-[0_0_30px_hsl(130,99%,41%,0.2)]"
                    style={{ fontFamily: "'Valorant', sans-serif" }}
                  >
                    <Zap className="h-4 w-4" />
                    COMPRAR AGORA
                  </button>

                  {item.item_id && (
                    <p className="text-[10px] text-muted-foreground/50 text-center break-all">Código: {item.item_id}</p>
                  )}

                  <div className="grid grid-cols-4 divide-x divide-border border border-border rounded-lg overflow-hidden">
                    <HighlightStat label="Skins" value={item.riot_valorant_skin_count ?? 0} />
                    <HighlightStat label="Agentes" value={item.riot_valorant_agent_count ?? 0} />
                    <HighlightStat label="Nível" value={item.riot_valorant_level ?? 0} />
                    <HighlightStat label="Knifes" value={item.riot_valorant_knife_count ?? 0} />
                  </div>
                </div>


                {/* Full Acesso */}
                <div className="rounded-lg border border-border bg-card p-6 pb-14">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                    <h3 className="text-xl font-bold text-foreground">Conta FULL ACESSO</h3>
                  </div>
                  <p className="text-base text-muted-foreground mb-5">
                    Acesso total: email original, alteração de senha e dados, sem enrolação.
                  </p>
                  <ul className="space-y-3.5 text-base text-muted-foreground">
                    <li className="flex items-center gap-2.5"><span className="text-success text-lg">•</span> Email e senha inclusos</li>
                    <li className="flex items-center gap-2.5"><span className="text-success text-lg">•</span> Senha alterável</li>
                    <li className="flex items-center gap-2.5"><span className="text-success text-lg">•</span> Conta verificável</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Inventory Tabs - Full width below */}
            {(skinUuids.length > 0 || agentUuids.length > 0 || buddyUuids.length > 0) && (
              <div className="mt-5">
                {/* Tab buttons */}
                <div className="flex w-full gap-1.5 sm:gap-2 mb-5">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex flex-1 items-center justify-center gap-1 sm:gap-2 rounded-lg border px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                        activeTab === tab.key
                          ? "border-success bg-success/10 text-success"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.slice(0, 5)}{tab.label.length > 5 ? '' : ''}</span>
                      {tab.count > 0 && (
                        <span className={`rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-bold ${
                          activeTab === tab.key ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Items grid */}
                {activeItems.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {activeItems.map((invItem: any, i: number) => (
                      <motion.div
                        key={`${activeTab}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.015 }}
                        className="group rounded-lg border border-border bg-card overflow-hidden hover:border-success/40 transition-all relative cursor-pointer"
                        onClick={() => setLightboxIndex(i)}
                      >
                        {invItem.rarity && (
                          <div className="absolute top-1.5 right-1.5 z-10">
                            <img src={invItem.rarity.img} alt={invItem.rarity.name} className="h-5 w-5 object-contain drop-shadow-md" title={invItem.rarity.name} />
                          </div>
                        )}
                        <div className="aspect-square bg-secondary/20 flex items-center justify-center p-3">
                          <img
                            src={invItem.image}
                            alt={invItem.name}
                            className="h-full w-full object-contain group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2 border-t border-border flex items-center gap-1.5">
                          {invItem.rarity && (
                            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: invItem.rarity.color }} />
                          )}
                          <p className="text-[11px] font-medium text-foreground truncate">{invItem.name}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : activeLoading ? (
                  <div className="flex items-center justify-center py-12 rounded-lg border border-border bg-card">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                    <p className="text-sm text-muted-foreground">Carregando itens...</p>
                  </div>
                ) : activeError ? (
                  <div className="flex items-center justify-center py-12 rounded-lg border border-border bg-card">
                    <p className="text-sm text-muted-foreground">Erro ao carregar itens. Tente recarregar a página.</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 rounded-lg border border-border bg-card">
                    <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
                  </div>
                )}

                {/* Lightbox Modal */}
                <AnimatePresence>
                  {lightboxIndex !== null && activeItems[lightboxIndex] && (() => {
                    const currentItem = activeItems[lightboxIndex];
                    const total = activeItems.length;
                    const goPrev = () => setLightboxIndex(prev => prev !== null ? (prev - 1 + total) % total : null);
                    const goNext = () => setLightboxIndex(prev => prev !== null ? (prev + 1) % total : null);
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
                        ref={(el) => el?.focus()}
                      >
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          className="relative bg-card border border-border rounded-xl max-w-lg w-[90vw] overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Close */}
                          <button onClick={() => setLightboxIndex(null)} className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-5 w-5" />
                          </button>

                          {/* Image */}
                          <div className="aspect-[4/3] bg-secondary/20 flex items-center justify-center p-8 border-b border-border">
                            <img src={currentItem.image} alt={currentItem.name} className="max-h-full max-w-full object-contain" />
                          </div>

                          {/* Info */}
                          <div className="p-5 flex flex-col items-center gap-3">
                            <h3 className="text-base font-bold text-foreground text-center">{currentItem.name}</h3>
                            {currentItem.rarity && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Edição:</span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium" style={{ color: currentItem.rarity.color }}>
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentItem.rarity.color }} />
                                  {currentItem.rarity.name} Edition
                                </span>
                              </div>
                            )}

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
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

              </div>
            )}

            {/* Description */}
            {item.description && (
              <div className="mt-6 rounded-lg border border-border bg-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-2">Descrição</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{item.description}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

const StatCell = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-bold text-foreground">{value}</span>
  </div>
);

const HighlightStat = forwardRef<HTMLDivElement, { label: string; value: string | number }>(({ label, value }, ref) => (
  <div ref={ref} className="flex flex-col items-center py-3 px-1.5">
    <span className="text-[10px] text-muted-foreground mb-0.5">{label}</span>
    <span className="text-base font-bold text-success">{value}</span>
  </div>
));
HighlightStat.displayName = "HighlightStat";

export default ContaDetalhes;
