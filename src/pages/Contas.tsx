import { useState, useCallback, useEffect, useRef, useMemo, memo, forwardRef, type CSSProperties } from "react";
import { useLztMarkup, getLztItemBrlPrice, type GameCategory } from "@/hooks/useLztMarkup";
import Header from "@/components/Header";
import { ChevronLeft, ChevronRight, ChevronDown, Search, SlidersHorizontal, DollarSign, Crosshair, Loader2, RefreshCw, Globe, TrendingUp, Star, Shield, Trophy, AlertTriangle, X, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { throwApiError } from "@/lib/apiErrors";
import { translateRegion } from "@/lib/regionTranslation";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import type {
  DDragonChampionJson,
  DDragonVersionList,
  FortniteCosmeticItem,
  FortniteCosmeticsResponse,
} from "@/lib/edgeFunctionTypes";

import lolRankFerroImg from "@/assets/lol-rank-ferro.webp";
import lolRankBronzeImg from "@/assets/lol-rank-bronze.webp";
import lolRankPrataImg from "@/assets/lol-rank-prata.webp";
import lolRankOuroImg from "@/assets/lol-rank-ouro.webp";
import lolRankPlatinaImg from "@/assets/lol-rank-platina.webp";
import lolRankEsmeraldaImg from "@/assets/lol-rank-esmeralda.webp";
import lolRankDiamanteImg from "@/assets/lol-rank-diamante.webp";
import lolRankMestreImg from "@/assets/lol-rank-mestre.webp";

import {
  rankFerro, rankBronze, rankPrata, rankOuro, rankPlatina,
  rankDiamante, rankAscendente, rankImortal, rankRadianteNew as rankRadiante,
  rankUnranked, rankMap, fetchAllValorantSkins,
  type SkinEntry,
} from "@/lib/valorantData";
import { getListingCardTitle } from "@/lib/lztDisplayTitles";
import {
  compareFortniteCardRows,
  metaFromFortniteApiItem,
  type FortniteCosmeticDbRow,
} from "@/lib/fortniteCosmeticSort";
import {
  hideImgOnError,
  setBorderAndBoxShadow,
  clearBorderAndBoxShadow,
  setLinkAccentHover,
  clearLinkAccentHover,
} from "@/lib/domEventHelpers";
import { errorName } from "@/lib/errorMessage";
import { isRecord } from "@/types/ticketChat";
import { prefetchAccountDetail, LZT_ACCOUNT_DETAIL_GONE_EVENT } from "@/lib/lztPrefetch";

import weaponAres from "@/assets/weapon-ares.png";
import weaponBandit from "@/assets/weapon-bandit.png";
import weaponBucky from "@/assets/weapon-bucky.png";
import weaponBulldog from "@/assets/weapon-bulldog.png";
import weaponClassic from "@/assets/weapon-classic.png";
import weaponGhost from "@/assets/weapon-ghost.png";
import weaponGuardian from "@/assets/weapon-guardian.png";
import weaponJudge from "@/assets/weapon-judge.png";
import weaponMarshal from "@/assets/weapon-marshal.png";
import weaponOdin from "@/assets/weapon-odin.png";
import weaponOperator from "@/assets/weapon-operator.png";
import weaponOutlaw from "@/assets/weapon-outlaw.png";
import weaponPhantom from "@/assets/weapon-phantom.png";
import weaponSheriff from "@/assets/weapon-sheriff.png";
import weaponShorty from "@/assets/weapon-shorty.png";
import weaponSpectre from "@/assets/weapon-spectre.png";
import weaponStinger from "@/assets/weapon-stinger.png";
import weaponVandal from "@/assets/weapon-vandal.png";

type GameTab = "valorant" | "lol" | "fortnite" | "minecraft";

const getProxiedImageUrl = (url: string) => {
  if (!url) return "";
  // Only proxy lzt.market images (require auth). Public CDNs load directly for speed.
  if (url.includes("lzt.market") || url.includes("img.lzt.market")) {
    return `${supabaseUrl}/functions/v1/lzt-market?action=image-proxy&url=${encodeURIComponent(url)}`;
  }
  return url;
};

/** Data Dragon champion keys from champion.json are already valid (e.g. LeeSin); do not sentence-case them. */
const ddragonChampionId = (internalNameFromMap: string) => internalNameFromMap;

/** Drop obvious Valorant listings that leak into LoL API responses. */
function isLikelyWrongGameInLolList(item: LztItem): boolean {
  const t = item.title || "";
  const smellsValorant =
    /\b(knives?|vandal|phantom|spectre|bulldog|operator|valorant)\b/i.test(t) &&
    !/\b(league|lol|champion|ranked|skins?)\b/i.test(t);
  if (!smellsValorant) return false;
  const hasLol =
    (item.riot_lol_skin_count ?? 0) >= 15 ||
    (item.riot_lol_champion_count ?? 0) >= 30 ||
    !!(item.lolInventory?.Skin && (Array.isArray(item.lolInventory.Skin) ? item.lolInventory.Skin.length : Object.keys(item.lolInventory.Skin).length) > 0);
  return !hasLol;
}

const MC_GREEN = "hsl(120,60%,45%)";

// ─── Region options ───
const valorantRegions = [
  { id: "all", label: "Todas as regiões" },
  { id: "br", label: "Brasil" },
  { id: "eu", label: "Europa" },
  { id: "na", label: "América do Norte" },
  { id: "ap", label: "Ásia-Pacífico" },
  { id: "kr", label: "Coréia" },
  { id: "latam", label: "LATAM" },
];

// Map region filter IDs to riot_country codes (3-letter) returned by LZT API
const REGION_COUNTRY_MAP: Record<string, string[]> = {
  br: ["Bra"],
  eu: ["Ger", "Fra", "Gbr", "Ita", "Esp", "Pol", "Tur", "Swe", "Nor", "Fin", "Dnk", "Nld", "Bel", "Aut", "Che", "Prt", "Cze", "Rou", "Bgr", "Hrv", "Svk", "Hun", "Grc", "Ukr", "Rus", "Srb", "Ltu", "Lva", "Est"],
  na: ["Usa", "Can"],
  ap: ["Jpn", "Kor", "Aus", "Sgp", "Twn", "Hkg", "Tha", "Phl", "Idn", "Mys", "Vnm", "Ind", "Nzl"],
  kr: ["Kor"],
  latam: ["Mex", "Arg", "Chl", "Col", "Per", "Ven", "Ecu", "Ury", "Pry", "Bol", "Cri", "Pan", "Dom"],
};

const lolRegions = [
  { id: "all", label: "Todas as regiões" },
  { id: "BR1", label: "Brasil" },
  { id: "EUW1", label: "Europa Oeste" },
  { id: "EUN1", label: "Europa Norte/Leste" },
  { id: "NA1", label: "América do Norte" },
  { id: "LA2", label: "LAS" },
  { id: "LA1", label: "LAN" },
  { id: "OC1", label: "Oceania" },
  { id: "TR1", label: "Turquia" },
  { id: "RU", label: "Rússia" },
  { id: "JP1", label: "Japão" },
  { id: "KR", label: "Coréia" },
];

// rankMap imported from @/lib/valorantData

const valorantRankFilters = [
  { id: "todos", name: "Todos", img: rankUnranked, rmin: 0, rmax: 0 },
  { id: "ferro", name: "Ferro", img: rankFerro, rmin: 3, rmax: 5 },
  { id: "bronze", name: "Bronze", img: rankBronze, rmin: 6, rmax: 8 },
  { id: "prata", name: "Prata", img: rankPrata, rmin: 9, rmax: 11 },
  { id: "ouro", name: "Ouro", img: rankOuro, rmin: 12, rmax: 14 },
  { id: "platina", name: "Platina", img: rankPlatina, rmin: 15, rmax: 17 },
  { id: "diamante", name: "Diamante", img: rankDiamante, rmin: 18, rmax: 20 },
  { id: "ascendente", name: "Ascendente", img: rankAscendente, rmin: 21, rmax: 23 },
  { id: "imortal", name: "Imortal", img: rankImortal, rmin: 24, rmax: 26 },
  { id: "radiante", name: "Radiante", img: rankRadiante, rmin: 27, rmax: 27 },
];

// LoL rank ordering (text rank from API) — used by lolRankFilters below

const lolRankFilters = [
  { id: "todos", name: "Todos", color: "hsl(var(--muted-foreground))", img: null as string | null },
  { id: "iron", name: "Ferro", color: "#7e6a5e", img: lolRankFerroImg },
  { id: "bronze", name: "Bronze", color: "#a0603c", img: lolRankBronzeImg },
  { id: "silver", name: "Prata", color: "#7f9eb4", img: lolRankPrataImg },
  { id: "gold", name: "Ouro", color: "#c89b3c", img: lolRankOuroImg },
  { id: "platinum", name: "Platina", color: "#4a9e7f", img: lolRankPlatinaImg },
  { id: "emerald", name: "Esmeralda", color: "#2dce89", img: lolRankEsmeraldaImg },
  { id: "diamond", name: "Diamante", color: "#576bde", img: lolRankDiamanteImg },
  { id: "master", name: "Mestre+", color: "#9d48e0", img: lolRankMestreImg },
];

const lolRankToFilterId = (rank: string): string => {
  if (!rank || rank === "Unranked") return "todos";
  const r = rank.toUpperCase();
  if (r.includes("IRON")) return "iron";
  if (r.includes("BRONZE")) return "bronze";
  if (r.includes("SILVER")) return "silver";
  if (r.includes("GOLD")) return "gold";
  if (r.includes("PLATINUM")) return "platinum";
  if (r.includes("EMERALD")) return "emerald";
  if (r.includes("DIAMOND")) return "diamond";
  if (r.includes("MASTER") || r.includes("GRANDMASTER") || r.includes("CHALLENGER")) return "master";
  return "todos";
};

// Maps lolRankFilters id -> array of lol_rank[] values for API
const lolRankApiValues: Record<string, string[]> = {
  iron: ["IRON IV","IRON III","IRON II","IRON I"],
  bronze: ["BRONZE IV","BRONZE III","BRONZE II","BRONZE I"],
  silver: ["SILVER IV","SILVER III","SILVER II","SILVER I"],
  gold: ["GOLD IV","GOLD III","GOLD II","GOLD I"],
  platinum: ["PLATINUM IV","PLATINUM III","PLATINUM II","PLATINUM I"],
  emerald: ["EMERALD IV","EMERALD III","EMERALD II","EMERALD I"],
  diamond: ["DIAMOND IV","DIAMOND III","DIAMOND II","DIAMOND I"],
  master: ["MASTER I","GRANDMASTER I","CHALLENGER I"],
};

const weapons = [
  { id: "todos", name: "Todas", img: null as string | null },
  { id: "ares", name: "Ares", img: weaponAres },
  { id: "bandit", name: "Bandit", img: weaponBandit },
  { id: "bucky", name: "Bucky", img: weaponBucky },
  { id: "bulldog", name: "Bulldog", img: weaponBulldog },
  { id: "classic", name: "Classic", img: weaponClassic },
  { id: "ghost", name: "Ghost", img: weaponGhost },
  { id: "guardian", name: "Guardian", img: weaponGuardian },
  { id: "judge", name: "Judge", img: weaponJudge },
  { id: "marshal", name: "Marshal", img: weaponMarshal },
  { id: "odin", name: "Odin", img: weaponOdin },
  { id: "operator", name: "Operator", img: weaponOperator },
  { id: "outlaw", name: "Outlaw", img: weaponOutlaw },
  { id: "phantom", name: "Phantom", img: weaponPhantom },
  { id: "sheriff", name: "Sheriff", img: weaponSheriff },
  { id: "shorty", name: "Shorty", img: weaponShorty },
  { id: "spectre", name: "Spectre", img: weaponSpectre },
  { id: "stinger", name: "Stinger", img: weaponStinger },
  { id: "vandal", name: "Vandal", img: weaponVandal },
];

const VALORANT_RANK_IDS = new Set(valorantRankFilters.map((r) => r.id));
const LOL_RANK_IDS = new Set(lolRankFilters.map((r) => r.id));
const VAL_WEAPON_IDS = new Set(weapons.map((w) => w.id));
const VAL_REGION_IDS = new Set(valorantRegions.map((r) => r.id));
const LOL_REGION_IDS = new Set(lolRegions.map((r) => r.id));

/** Query keys escritos pelo sync de filtros / switchTab (preserva utm_*, etc.). */
const CONTAS_MANAGED_QUERY_KEYS: string[] = [
  "rank", "weapon", "knife", "region", "champMin", "skinsMin", "vbMin",
  "levelMin", "battlePass", "java", "bedrock", "hypixelMin", "capesMin",
  "noBan", "lvlMin", "lvlMax", "invMin", "invMax", "q", "sort", "pmin", "pmax", "game",
];

const sortOptions = [
  {
    label: "Mais Recentes",
    shortLabel: "Recentes",
    value: "pdate_to_down",
    title: "Ordem da API: contas publicadas mais recentemente primeiro",
  },
  {
    label: "Menor Preço",
    shortLabel: "Menor R$",
    value: "price_to_up",
    title: "Ordenar pelo preço final em R$ (menor primeiro)",
  },
  {
    label: "Maior Preço",
    shortLabel: "Maior R$",
    value: "price_to_down",
    title: "Ordenar pelo preço final em R$ (maior primeiro)",
  },
] as const;

const LIST_SORT_VALUES = new Set<string>(sortOptions.map((o) => o.value));

function normalizeListSortParam(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  return LIST_SORT_VALUES.has(v) ? v : "pdate_to_down";
}

/** Parâmetro `order_by` enviado à LZT (alinhado ao sort da UI). */
function listOrderByForLztApi(uiSort: string): string {
  return normalizeListSortParam(uiSort);
}

const FN_PURPLE = "hsl(265,80%,65%)";
const FN_BLUE = "hsl(210,100%,56%)";

interface LztItem {
  item_id: number;
  title: string;
  title_en?: string;
  description?: string;
  price: number;
  rub_price?: number;
  price_currency?: string;
  // Valorant
  riot_valorant_rank?: number;
  riot_valorant_skin_count?: number;
  riot_valorant_agent_count?: number;
  riot_valorant_level?: number;
  riot_valorant_knife?: number;
  riot_valorant_region?: string;
  riot_valorant_inventory_value?: number;
  riot_valorant_wallet_vp?: number;
  riot_valorant_rank_type?: string;
  // LoL
  riot_lol_rank?: string;
  riot_lol_level?: number;
  riot_lol_skin_count?: number;
  riot_lol_champion_count?: number;
  riot_lol_region?: string;
  riot_lol_wallet_blue?: number;
  riot_lol_wallet_orange?: number;
  riot_lol_rank_win_rate?: number;
  // Minecraft
  minecraft_nickname?: string;
  minecraft_java?: number;
  minecraft_bedrock?: number;
  minecraft_hypixel_rank?: string;
  minecraft_hypixel_level?: number;
  minecraft_capes_count?: number;
  minecraft_hypixel_ban?: number;
  minecraft_dungeons?: number;
  minecraft_legends?: number;
  // Common
  riot_username?: string;
  riot_country?: string;
  email_type?: string;
  valorantRankTitle?: string;
  valorantRankImgPath?: string;
  valorantRegionPhrase?: string;
  item_origin?: string;
  published_date?: number;
  view_count?: number;
  // Fortnite
  fortnite_balance?: number;
  fortnite_vbucks?: number;
  fortnite_level?: number;
  fortnite_skin_count?: number;
  fortnite_outfit_count?: number;
  fortniteSkins?: Array<{ id: string; title?: string }>;
  fortnitePickaxe?: Array<{ id: string; title?: string }>;
  fortnitePastSeasons?: Array<{ purchasedVIP?: boolean; seasonNumber?: number }>;
  lolInventory?: {
    Champion?: number[];
    Skin?: number[] | Record<string, number>;
  } | null;
  valorantInventory?: {
    WeaponSkins?: string[];
    Agent?: string[];
    Buddy?: string[];
    Champion?: string[];
    Skin?: string[];
  };
  imagePreviewLinks?: {
    direct?: { weapons?: string; agents?: string; buddies?: string; main?: string };
  };
  // Server-calculated BRL price (with correct markup)
  price_brl?: number;
}

type LztMarketListResponse = {
  items?: LztItem[];
  hasNextPage?: boolean;
  page?: number;
  perPage?: number;
  totalItems?: number;
};

// ─── Data fetchers ───

// RARITY_PRIORITY, SkinEntry, fetchAllValorantSkins imported from @/lib/valorantData

// Fortnite-API: fetch all BR cosmetics (smallIcon)
const fetchFortniteSkins = async (): Promise<Map<string, FortniteCosmeticDbRow>> => {
  try {
    const data = await safeJsonFetch<FortniteCosmeticsResponse>("https://fortnite-api.com/v2/cosmetics/br?language=pt-BR");
    const map = new Map<string, FortniteCosmeticDbRow>();
    const raw = data.data;
    const list: FortniteCosmeticItem[] = Array.isArray(raw) ? raw : raw?.items ?? [];
    for (const item of list) {
      const image = item.images?.smallIcon || item.images?.icon;
      if (image && item.id) {
        const meta = metaFromFortniteApiItem(item);
        map.set(item.id.toLowerCase(), {
          name: item.name || item.id,
          image,
          rarityValue: meta.rarityValue,
          ageKey: meta.ageKey,
        });
      }
    }
    return map;
  } catch (err) {
    console.warn("Failed to fetch Fortnite skins:", err);
    return new Map();
  }
};

// Data Dragon: champion numeric key -> internal name (e.g., 103 -> "Ahri")
// Used to resolve LoL skin IDs: skinId = champKey * 1000 + skinNum
// Loading art URL: https://ddragon.leagueoflegends.com/cdn/img/champion/loading/{Name}_{skinNum}.jpg
const fetchLolChampKeyMap = async (): Promise<Map<number, string>> => {
  try {
    const versions = await safeJsonFetch<DDragonVersionList>("https://ddragon.leagueoflegends.com/api/versions.json");
    const version = versions[0];
    if (!version) return new Map();

    const data = await safeJsonFetch<DDragonChampionJson>(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
    );
    const map = new Map<number, string>();
    const champions = data.data ?? {};
    for (const [internalName, champ] of Object.entries(champions)) {
      // champ.key is the numeric ID as a string (e.g., "103")
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

// Smooth-loading image: defers src until card is near viewport via Intersection Observer,
// then fades in on load. Avoids DNS/connection overhead for off-screen images.
const smoothImgObserver =
  typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver(
        (entries, observer) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const el = entry.target as HTMLImageElement;
              const deferred = el.dataset.src;
              if (deferred) {
                el.src = deferred;
                el.removeAttribute("data-src");
              }
              observer.unobserve(el);
            }
          }
        },
        { rootMargin: "400px 0px" },
      )
    : null;

const SmoothImg = memo(forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(({ src, alt, className, ...props }, _ref) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset loaded/failed state when src changes to avoid stale opacity
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const el = imgRef.current;
    if (!el || !smoothImgObserver) {
      // No IO: set src directly
      if (el && src) el.src = src;
      return;
    }
    smoothImgObserver.observe(el);
    return () => { smoothImgObserver!.unobserve(el); };
  }, [src]);

  if (failed) return null;

  // If no IO support, fall back to native lazy loading with src set immediately
  const useNative = !smoothImgObserver;

  return (
    <img
      ref={imgRef}
      src={useNative ? src : undefined}
      data-src={useNative ? undefined : src}
      alt={alt || ""}
      className={`${className || ""} transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}));
SmoothImg.displayName = "SmoothImg";

// Helper: LZT preview image with fallback to placeholder on error
const LztPreviewImage = ({ url }: { url: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Crosshair className="h-12 w-12 text-muted-foreground/20" />
      </div>
    );
  }
  return (
    <div className="relative z-[1] flex items-center justify-center w-full h-full p-3">
      <SmoothImg
        src={getProxiedImageUrl(url)}
        alt="Skins preview"
        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

const ValorantCard = memo(({ item, skinsMap, priceLabel, queryClient }: { item: LztItem; skinsMap: Map<string, SkinEntry>; priceLabel: string; queryClient: QueryClient }) => {
  const rank = item.riot_valorant_rank ? rankMap[item.riot_valorant_rank] : null;
  const skinCount = item.riot_valorant_skin_count ?? 0;
  const hasKnife = (item.riot_valorant_knife ?? 0) > 0;

  const cleanedTitle = getListingCardTitle(item, "valorant");

  const inventoryUuids = useMemo(() => {
    const toUuids = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw;
      if (isRecord(raw)) return Object.values(raw).filter((v): v is string => typeof v === "string");
      return [];
    };
    return toUuids(item.valorantInventory?.WeaponSkins);
  }, [item.valorantInventory]);

  const hasInventoryData = inventoryUuids.length > 0;
  const skinsMapReady = skinsMap.size > 0;

  const skinPreviews = useMemo(() => {
    if (!skinsMapReady) return [];
    const results: SkinEntry[] = [];
    for (const uuid of inventoryUuids) {
      if (typeof uuid !== "string") continue;
      const entry = skinsMap.get(uuid.toLowerCase());
      if (entry) results.push(entry);
    }
    results.sort((a, b) => b.rarity - a.rarity);
    const premium = results.filter(s => s.rarity >= 2);
    const pool = (premium.length >= 4 ? premium : results.filter(s => s.rarity > 0).length >= 4 ? results.filter(s => s.rarity > 0) : results).slice(0, 12);
    // Rotate starting skin based on item_id to avoid visual repetition across cards
    if (pool.length > 1) {
      const hash = item.item_id ? [...String(item.item_id)].reduce((acc, c) => acc + c.charCodeAt(0), 0) : 0;
      const offset = hash % pool.length;
      if (offset > 0) {
        const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
        return rotated;
      }
    }
    return pool;
  }, [inventoryUuids, skinsMap, skinsMapReady, item.item_id]);

  const [skinIdx, setSkinIdx] = useState(0);
  const currentIdx = skinPreviews.length > 0 ? skinIdx % skinPreviews.length : 0;

  const prevSkin = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSkinIdx(i => (i - 1 + skinPreviews.length) % skinPreviews.length);
  }, [skinPreviews.length]);

  const nextSkin = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSkinIdx(i => (i + 1) % skinPreviews.length);
  }, [skinPreviews.length]);

  // Touch swipe for skin carousel
  const touchRef = useRef<{ startX: number; startY: number; swiped: boolean } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (skinPreviews.length <= 1) return;
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiped: false };
  }, [skinPreviews.length]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const ref = touchRef.current;
    if (!ref || ref.swiped) return;
    const dx = e.touches[0].clientX - ref.startX;
    const dy = e.touches[0].clientY - ref.startY;
    // Only swipe horizontally if |dx| > |dy| to avoid blocking scroll
    if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      ref.swiped = true;
      if (dx < 0) {
        setSkinIdx(i => (i + 1) % skinPreviews.length);
      } else {
        setSkinIdx(i => (i - 1 + skinPreviews.length) % skinPreviews.length);
      }
    }
  }, [skinPreviews.length]);

  const onTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  return (
    <Link
      to={`/conta/${item.item_id}`}
      onPointerEnter={() => prefetchAccountDetail(queryClient, "valorant", item.item_id)}
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-200 hover:border-success/50 sm:hover:shadow-[0_4px_24px_hsl(var(--success)/0.12)] flex flex-col h-full no-underline text-inherit"
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--success)/0.06),transparent_70%)]" />
        {skinPreviews.length > 0 ? (
          <>
            <div className="relative z-[1] w-full h-full flex items-center justify-center">
              <SmoothImg
                key={currentIdx}
                src={getProxiedImageUrl(skinPreviews[currentIdx].image)}
                alt={skinPreviews[currentIdx].name}
                className="w-full h-full object-contain p-2"
              />
            </div>
            {skinPreviews.length > 1 && (
              <>
                <button
                  onClick={prevSkin}
                  className="absolute left-0.5 top-1/2 -translate-y-1/2 z-[2] flex h-5 w-5 items-center justify-center rounded-full bg-background/70 text-foreground/70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150 hover:bg-background/90"
                  aria-label="Skin anterior"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  onClick={nextSkin}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 z-[2] flex h-5 w-5 items-center justify-center rounded-full bg-background/70 text-foreground/70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150 hover:bg-background/90"
                  aria-label="Próxima skin"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
                {/* Dots indicator */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[2] flex items-center gap-0.5">
                  {skinPreviews.slice(0, 5).map((_, i) => (
                    <span key={i} className={`block h-[3px] rounded-full transition-all duration-200 ${i === currentIdx % Math.min(skinPreviews.length, 5) ? "w-2.5 bg-success" : "w-1 bg-foreground/30"}`} />
                  ))}
                  {skinPreviews.length > 5 && (
                    <span className="text-[7px] text-foreground/40 ml-0.5">+{skinPreviews.length - 5}</span>
                  )}
                </div>
              </>
            )}
          </>
        ) : hasInventoryData && !skinsMapReady ? (
          <div className="relative z-[1] flex items-center justify-center w-full h-full">
            <div className="w-3/4 h-3/4 rounded bg-secondary/50 animate-pulse" />
          </div>
        ) : item.imagePreviewLinks?.direct?.weapons ? (
          <LztPreviewImage url={item.imagePreviewLinks.direct.weapons} />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><Crosshair className="h-6 w-6 sm:h-10 sm:w-10 text-muted-foreground/20" /></div>
        )}
      </div>
      {/* Info bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/40 border-b border-border/20">
        <span className="flex items-center gap-1 text-[9px] sm:text-[11px] font-semibold text-foreground">
          <img src={rank?.img || rankUnranked} alt={rank?.name || "Unranked"} className="h-3 w-3 sm:h-3.5 sm:w-3.5 object-contain" />
          {rank?.name || "Unranked"}
          {hasKnife && <span className="ml-0.5">🔪</span>}
        </span>
        <span className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground">{skinCount} skins</span>
      </div>
      <div className="p-2.5 sm:p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex items-center gap-1.5 rounded-md bg-positive/10 border border-positive/20 px-2 py-1">
          <svg className="h-3 w-3 text-positive flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <span className="text-[9px] sm:text-[11px] font-semibold text-positive">Full Acesso · Entrega Automática</span>
        </div>
        {item.valorantRegionPhrase && (
          <div className="flex items-center gap-1">
            <Globe className="h-2.5 w-2.5 text-muted-foreground/60 flex-shrink-0" />
            <span className="text-[9px] sm:text-[11px] text-muted-foreground/80">{translateRegion(item.valorantRegionPhrase)}</span>
          </div>
        )}
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <h3 className="text-[11px] sm:text-xs font-semibold text-foreground line-clamp-2 text-balance leading-snug tracking-tight mb-1">{cleanedTitle}</h3>
          <p className="text-sm sm:text-base font-bold text-positive tracking-tight">{priceLabel}</p>
          <span className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg bg-foreground py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-background">
            Explorar detalhes <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </Link>
  );
});
ValorantCard.displayName = "ValorantCard";

// ─── LoL Card ───
const LolCard = memo(({ item, champKeyMap, priceLabel, queryClient }: { item: LztItem; champKeyMap: Map<number, string>; priceLabel: string; queryClient: QueryClient }) => {
  const rankText = item.riot_lol_rank || "Unranked";
  const rankFilterId = lolRankToFilterId(rankText);
  const rankFilterData = lolRankFilters.find(r => r.id === rankFilterId);
  const rankColor = rankFilterData?.color || "hsl(var(--muted-foreground))";
  const champCount = item.riot_lol_champion_count ?? 0;
  const skinCount = item.riot_lol_skin_count ?? 0;
  const level = item.riot_lol_level ?? 0;
  const winRate = item.riot_lol_rank_win_rate;

  const cleanedTitle = getListingCardTitle(item, "lol");

  // Resolve LoL skin IDs via lolInventory (não valorantInventory!)
  // skinId = champKey * 1000 + skinNum
  const lolInventory = item.lolInventory;
  const hasLolInventoryData = !!(lolInventory?.Skin || lolInventory?.Champion);
  const champKeyMapReady = champKeyMap.size > 0;

  const skinPreviews = useMemo(() => {
    if (!champKeyMapReady) return [];
    const rawSkin = lolInventory?.Skin;
    let skinIds: number[] = [];
    if (Array.isArray(rawSkin)) {
      skinIds = rawSkin.map(Number);
    } else if (rawSkin && typeof rawSkin === "object") {
      skinIds = Object.values(rawSkin).map(Number);
    }
    const champIds = Array.isArray(lolInventory?.Champion) ? lolInventory!.Champion! : [];
    const results: { name: string; image: string }[] = [];

    for (const skinId of skinIds) {
      const id = Number(skinId);
      if (isNaN(id)) continue;
      const champKey = Math.floor(id / 1000);
      const skinNum = id % 1000;
      const rawChampName = champKeyMap.get(champKey);
      if (rawChampName && skinNum > 0) {
        const champName = ddragonChampionId(rawChampName);
        results.push({
          name: champName,
          image: `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champName}_${skinNum}.jpg`,
        });
      }
      if (results.length >= 6) break;
    }

    if (results.length === 0) {
      for (const champId of champIds) {
        const rawChampName = champKeyMap.get(Number(champId));
        if (rawChampName) {
          const champName = ddragonChampionId(rawChampName);
          results.push({
            name: champName,
            image: `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champName}_0.jpg`,
          });
        }
        if (results.length >= 6) break;
      }
    }

    return results;
  }, [lolInventory, champKeyMap, champKeyMapReady]);

  return (
    <Link
      to={`/lol/${item.item_id}`}
      onPointerEnter={() => prefetchAccountDetail(queryClient, "lol", item.item_id)}
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-200 hover:border-[hsl(198,100%,45%)/50%] sm:hover:shadow-[0_4px_24px_hsl(198,100%,45%,0.12)] flex flex-col h-full no-underline text-inherit"
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(198,100%,45%,0.08),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[hsl(var(--card))] to-transparent z-[2]" />
        {skinPreviews.length === 1 ? (
          <div className="relative z-[1] w-full h-full">
            <SmoothImg src={getProxiedImageUrl(skinPreviews[0].image)} alt={skinPreviews[0].name} className="h-full w-full object-cover object-top" />
          </div>
        ) : skinPreviews.length === 2 ? (
          <div className="relative z-[1] grid grid-cols-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <SmoothImg src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-cover object-top" />
                {i > 0 && <div className="absolute inset-y-0 left-0 w-px bg-black/20" />}
              </div>
            ))}
          </div>
        ) : skinPreviews.length <= 4 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <SmoothImg src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-cover object-top" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <SmoothImg src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-cover object-top" />
              </div>
            ))}
          </div>
        ) : hasLolInventoryData && !champKeyMapReady ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0 w-full h-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col h-full w-full items-center justify-center gap-1">
            <Shield className="h-8 w-8 text-muted-foreground/20" />
            <span className="text-[10px] text-muted-foreground/40">{champCount} campeões</span>
          </div>
        )}
      </div>
      {/* Info bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/40 border-b border-border/20">
        <div className="flex items-center gap-1">
          {rankFilterData?.img ? (
            <span className="flex items-center gap-1 text-[9px] sm:text-[11px] font-semibold text-foreground">
              <img src={rankFilterData.img} alt={rankText} className="h-3 w-3 sm:h-3.5 sm:w-3.5 object-contain" />
              {rankText.split(" ")[0]}
            </span>
          ) : (
            <span className="text-[9px] sm:text-[11px] font-semibold text-foreground">{rankText}</span>
          )}
          {level > 0 && <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white" style={{ background: "hsl(198,100%,45%)" }}>Nv.{level}</span>}
        </div>
        <span className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground">{skinCount} skins</span>
      </div>
      <div className="p-2.5 sm:p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Trophy className="h-2.5 w-2.5 text-primary" />
            {champCount} champs
          </span>
          {winRate != null && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5 text-primary" />
              {typeof winRate === "number"
                ? `${winRate}% WR`
                : String(winRate).includes("%")
                  ? String(winRate)
                  : `${winRate}% WR`}
            </span>
          )}
          {item.riot_lol_region && (
            <span className="flex items-center gap-1">
              <Globe className="h-2.5 w-2.5 text-muted-foreground/60" />
              {item.riot_lol_region.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1 bg-positive/10 border border-positive/20">
          <svg className="h-3 w-3 flex-shrink-0 text-positive" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <span className="text-[9px] sm:text-[11px] font-semibold text-positive">Full Acesso · Entrega Automática</span>
        </div>
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <h3 className="text-[11px] sm:text-xs font-semibold text-foreground line-clamp-2 text-balance leading-snug tracking-tight mb-1">{cleanedTitle}</h3>
          <p className="text-sm sm:text-base font-bold text-positive tracking-tight">{priceLabel}</p>
          <span className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg bg-foreground py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-background">
            Explorar detalhes <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </Link>
  );
});
LolCard.displayName = "LolCard";

// ─── Fortnite Card ───
const FortniteCard = memo(({ item, skinsDb, priceLabel, queryClient }: { item: LztItem; skinsDb: Map<string, FortniteCosmeticDbRow>; priceLabel: string; queryClient: QueryClient }) => {
  const vbucks = (item.fortnite_balance || item.fortnite_vbucks) ?? 0;
  const skinCount = item.fortnite_skin_count ?? 0;
  const level = item.fortnite_level ?? 0;

  const cleanedTitle = getListingCardTitle(item, "fortnite");

  // fortniteSkins: ordem LZT → reordenamos por raridade + temporada (OG) antes de mostrar 6 no card
  const skinPreviews = useMemo(() => {
    const fallbackRow = (id: string, title?: string): FortniteCosmeticDbRow => ({
      name: title || id,
      image: `https://fortnite-api.com/images/cosmetics/br/${String(id).toLowerCase()}/smallicon.png`,
      rarityValue: "",
      ageKey: 999999,
    });

    const fortniteSkins: Array<{ id: string; title?: string }> = Array.isArray(item.fortniteSkins) ? item.fortniteSkins : [];
    const rows: FortniteCosmeticDbRow[] = [];
    for (const s of fortniteSkins) {
      const found = skinsDb.get(String(s.id).toLowerCase());
      rows.push(found ?? fallbackRow(s.id, s.title));
    }

    if (rows.length === 0) {
      const pickaxes: Array<{ id: string; title?: string }> = Array.isArray(item.fortnitePickaxe) ? item.fortnitePickaxe : [];
      for (const p of pickaxes) {
        if (p.id === "defaultpickaxe") continue;
        const found = skinsDb.get(String(p.id).toLowerCase());
        rows.push(found ?? fallbackRow(p.id, p.title));
      }
    }

    rows.sort(compareFortniteCardRows);
    return rows.slice(0, 6);
  }, [item.fortniteSkins, item.fortnitePickaxe, skinsDb]);

  return (
    <Link
      to={`/fortnite/${item.item_id}`}
      onPointerEnter={() => prefetchAccountDetail(queryClient, "fortnite", item.item_id)}
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-200 hover:border-[hsl(265,80%,65%)/50%] sm:hover:shadow-[0_4px_24px_hsl(265,80%,65%,0.12)] flex flex-col h-full no-underline text-inherit"
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(265,80%,65%,0.08),transparent_70%)]" />
        {skinPreviews.length === 1 ? (
          <div className="relative z-[1] w-full h-full flex items-center justify-center bg-secondary/20">
            <SmoothImg src={getProxiedImageUrl(skinPreviews[0].image)} alt={skinPreviews[0].name} className="w-full h-full object-contain" />
          </div>
        ) : skinPreviews.length === 2 ? (
          <div className="relative z-[1] grid grid-cols-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <SmoothImg src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length === 3 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.slice(0, 2).map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <SmoothImg src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" />
              </div>
            ))}
            <div className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5 col-span-2">
              <SmoothImg src={getProxiedImageUrl(skinPreviews[2].image)} alt={skinPreviews[2].name} className="w-full h-full object-contain drop-shadow-sm" />
            </div>
          </div>
        ) : skinPreviews.length === 4 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <SmoothImg src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <SmoothImg src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" />
              </div>
            ))}
          </div>
        ) : skinsDb.size === 0 && skinCount > 0 ? (
          /* Skeleton while Fortnite API loads */
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-full h-full rounded bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : item.imagePreviewLinks?.direct?.weapons ? (
          <LztPreviewImage url={item.imagePreviewLinks.direct.weapons} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-8 w-8 text-muted-foreground/20" fill="currentColor" viewBox="0 0 24 24"><path d="m15.767 14.171.097-5.05H12.4V5.197h3.99L16.872 0H7.128v24l5.271-.985V14.17z"/></svg>
          </div>
        )}
      </div>
      {/* Info bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/40 border-b border-border/20">
        <div className="flex items-center gap-1">
          {level > 0 && <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white" style={{ background: FN_PURPLE }}>Nv.{level}</span>}
          {vbucks > 0 && <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white" style={{ background: FN_BLUE }}>{vbucks.toLocaleString()} VB</span>}
        </div>
        <span className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground">{skinCount} skins</span>
      </div>
      <div className="p-2.5 sm:p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: "hsl(142,71%,45%,0.1)", border: "1px solid hsl(142,71%,45%,0.2)" }}>
          <svg className="h-3 w-3 flex-shrink-0 text-positive" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <span className="text-[9px] sm:text-[11px] font-semibold text-positive">Full Acesso · Entrega Automática</span>
        </div>
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <h3 className="text-[11px] sm:text-xs font-semibold text-foreground line-clamp-2 text-balance leading-snug tracking-tight mb-1">{cleanedTitle}</h3>
          <p className="text-sm sm:text-base font-bold text-positive tracking-tight">{priceLabel}</p>
          <span className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg bg-foreground py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-background">
            Explorar detalhes <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </Link>
  );
});
FortniteCard.displayName = "FortniteCard";

// ─── Minecraft Card ───
const MinecraftCard = memo(({ item, priceLabel, queryClient }: { item: LztItem; priceLabel: string; queryClient: QueryClient }) => {
  const nickname = item.minecraft_nickname;
  const hasJava = (item.minecraft_java ?? 0) > 0;
  const hasBedrock = (item.minecraft_bedrock ?? 0) > 0;
  const hypixelRank = item.minecraft_hypixel_rank;
  const hypixelLevel = item.minecraft_hypixel_level ?? 0;
  const capes = item.minecraft_capes_count ?? 0;
  const banned = (item.minecraft_hypixel_ban ?? 0) > 0;

  const cleanedTitle = getListingCardTitle(item, "minecraft");

  // mineskin.eu avatar (body render)
  const skinUrl = nickname
    ? getProxiedImageUrl(`https://mineskin.eu/body/${encodeURIComponent(nickname)}/120.png`)
    : null;

  return (
    <Link
      to={`/minecraft/${item.item_id}`}
      onPointerEnter={() => prefetchAccountDetail(queryClient, "minecraft", item.item_id)}
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-200 flex flex-col h-full no-underline text-inherit"
      style={{ "--hover-shadow": `0 0 24px ${MC_GREEN}15` } as CSSProperties}
      onMouseEnter={(e) => setBorderAndBoxShadow(e, `${MC_GREEN}80`, `0 4px 24px ${MC_GREEN}15`)}
      onMouseLeave={clearBorderAndBoxShadow}
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${MC_GREEN}0a, transparent 70%)` }} />
        {skinUrl ? (
          <div className="relative z-[1] flex items-end justify-center h-full pt-2 pb-1">
            <img src={skinUrl} alt={nickname || "Skin"} className="h-full w-auto object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105" loading="lazy" onError={hideImgOnError} />
          </div>
        ) : (
          <div className="relative z-[1] flex items-center justify-center h-full">
            <svg className="h-12 w-12 opacity-20" viewBox="0 0 24 24" fill={MC_GREEN}><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M6,6V10H10V12H8V18H10V16H14V18H16V12H14V10H18V6H14V10H10V6H6Z" /></svg>
          </div>
        )}
      </div>
      {/* Info bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/40 border-b border-border/20">
        <div className="flex items-center gap-1 min-w-0">
          {hasJava && <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white" style={{ background: MC_GREEN }}>Java</span>}
          {hasBedrock && <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white" style={{ background: "hsl(25,40%,40%)" }}>Bedrock</span>}
          {hypixelRank && <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white" style={{ background: "hsl(40,80%,40%)" }}>{hypixelRank}</span>}
          {banned && <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white bg-destructive">Ban</span>}
        </div>
        <span className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground flex-shrink-0">
          {capes > 0 ? `${capes} cape${capes > 1 ? "s" : ""}` : nickname ? `@${nickname}` : "MC"}
        </span>
      </div>
      <div className="p-2.5 sm:p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex items-center gap-1">
          <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill={MC_GREEN}><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M6,6V10H10V12H8V18H10V16H14V18H16V12H14V10H18V6H14V10H10V6H6Z" /></svg>
          <span className="text-[10px] sm:text-xs font-medium text-foreground truncate">{nickname ? `@${nickname}` : "Minecraft"}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: "hsl(142,71%,45%,0.1)", border: "1px solid hsl(142,71%,45%,0.2)" }}>
          <svg className="h-3 w-3 flex-shrink-0 text-positive" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <span className="text-[9px] sm:text-[11px] font-semibold text-positive">Full Acesso · Entrega Automática</span>
        </div>
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <h3 className="text-[11px] sm:text-xs font-semibold text-foreground line-clamp-2 text-balance leading-snug tracking-tight mb-1">{cleanedTitle}</h3>
          <p className="text-sm sm:text-base font-bold text-positive tracking-tight">{priceLabel}</p>
          <span className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg bg-foreground py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-background">
            Explorar detalhes <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </Link>
  );
});
MinecraftCard.displayName = "MinecraftCard";

// ─── API ───
const waitWithAbort = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Request aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });

const fetchAccountsRaw = async (
  params: Record<string, string | string[]>,
  signal?: AbortSignal
): Promise<LztMarketListResponse> => {
  const queryParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(val => queryParams.append(k, val));
    else queryParams.set(k, v);
  }
  
  try {
    return await safeJsonFetch<LztMarketListResponse>(
      `${supabaseUrl}/functions/v1/lzt-market?${queryParams.toString()}`,
      {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal,
    }
    );
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        throw new Error("O serviço de mercado não foi encontrado. Verifique a configuração da Supabase.");
      }
      throwApiError(err.status || 500);
    }
    throw err;
  }
};

function gameTabFromSearchParams(sp: URLSearchParams): GameTab {
  const g = sp.get("game");
  if (g === "lol") return "lol";
  if (g === "fortnite") return "fortnite";
  if (g === "minecraft") return "minecraft";
  return "valorant";
}

const Contas = () => {
  const queryClient = useQueryClient();
  const { getDisplayPrice } = useLztMarkup();
  const [searchParams, setSearchParams] = useSearchParams();
  const [gameTab, setGameTab] = useState<GameTab>(() => gameTabFromSearchParams(searchParams));

  // Voltar/avançar no navegador ou link direto: manter aba alinhada a ?game=
  useEffect(() => {
    const tab = gameTabFromSearchParams(searchParams);
    setGameTab((prev) => (prev === tab ? prev : tab));
  }, [searchParams]);

  // Aba Steam removida: links antigos ?game=steam → Valorant (preserva outros query params)
  useEffect(() => {
    if (searchParams.get("game") === "steam") {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("game", "valorant");
          return next;
        },
        { replace: true },
      );
      setGameTab("valorant");
    }
  }, [searchParams, setSearchParams]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // ─── Helper: read query param with default ───
  const qp = (key: string, fallback: string = "") => searchParams.get(key) ?? fallback;
  const qpBool = (key: string) => searchParams.get(key) === "1";

  // ─── Valorant filters ───
  const [selectedRank, setSelectedRank] = useState(() => {
    const tab = gameTabFromSearchParams(searchParams);
    const r = searchParams.get("rank") ?? "todos";
    if (tab !== "valorant") return "todos";
    return VALORANT_RANK_IDS.has(r) ? r : "todos";
  });
  const [selectedWeapon, setSelectedWeapon] = useState(() => {
    const w = searchParams.get("weapon") ?? "todos";
    return VAL_WEAPON_IDS.has(w) ? w : "todos";
  });
  const [onlyKnife, setOnlyKnife] = useState(() => qpBool("knife"));
  const [valRegion, setValRegion] = useState(() => {
    const tab = gameTabFromSearchParams(searchParams);
    const r = searchParams.get("region") ?? "br";
    if (tab !== "valorant") return "br";
    return VAL_REGION_IDS.has(r) ? r : "br";
  });

  // ─── LoL filters ───
  const [lolRank, setLolRank] = useState(() => {
    const tab = gameTabFromSearchParams(searchParams);
    const r = searchParams.get("rank") ?? "todos";
    if (tab !== "lol") return "todos";
    return LOL_RANK_IDS.has(r) ? r : "todos";
  });
  const [lolChampMin, setLolChampMin] = useState(() => qp("champMin"));
  const [lolSkinsMin, setLolSkinsMin] = useState(() => qp("skinsMin"));
  const [lolRegion, setLolRegion] = useState(() => {
    const tab = gameTabFromSearchParams(searchParams);
    const r = searchParams.get("region") ?? "BR1";
    if (tab !== "lol") return "BR1";
    return LOL_REGION_IDS.has(r) ? r : "BR1";
  });

  // ─── Fortnite filters ───
  const [fnVbMin, setFnVbMin] = useState(() => qp("vbMin"));
  const [fnSkinsMin, setFnSkinsMin] = useState(() => qp("skinsMin"));
  const [fnLevelMin, setFnLevelMin] = useState(() => qp("levelMin"));
  const [fnHasBattlePass, setFnHasBattlePass] = useState(() => qpBool("battlePass"));

  // ─── Minecraft filters ───
  const [mcJava, setMcJava] = useState(() => qpBool("java"));
  const [mcBedrock, setMcBedrock] = useState(() => qpBool("bedrock"));
  const [mcHypixelLvlMin, setMcHypixelLvlMin] = useState(() => qp("hypixelMin"));
  const [mcCapesMin, setMcCapesMin] = useState(() => qp("capesMin"));
  const [mcNoBan, setMcNoBan] = useState(() => qpBool("noBan"));

  // ─── Shared filters ───
  const [priceMin, setPriceMin] = useState(() => qp("pmin"));
  const [priceMax, setPriceMax] = useState(() => qp("pmax"));
  const [sortBy, setSortBy] = useState<string>(() => normalizeListSortParam(qp("sort", "pdate_to_down")));

  // ?sort= na URL: voltar/avançar e links com valor inválido.
  // Só reagir a `searchParams` (não incluir `sortBy`): com `sortBy` nas deps, ao clicar num filtro o
  // URL ainda não tinha `sort=…` e `normalizeListSortParam(null)` virava `pdate_to_down`, repor o
  // estado e anulava o clique.
  useEffect(() => {
    const raw = searchParams.get("sort");
    if (raw == null || raw === "") {
      setSortBy(normalizeListSortParam(raw));
      return;
    }
    const normalized = normalizeListSortParam(raw);
    if (raw !== normalized) {
      setSortBy(normalized);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("sort", normalized);
          return next;
        },
        { replace: true },
      );
      return;
    }
    setSortBy((prev) => (prev === normalized ? prev : normalized));
  }, [searchParams, setSearchParams]);

  const lztListOrderBy = useMemo(() => listOrderByForLztApi(sortBy), [sortBy]);

  const [searchQuery, setSearchQuery] = useState(() => qp("q"));
  const [lvlMin, setLvlMin] = useState(() => qp("lvlMin"));
  const [lvlMax, setLvlMax] = useState(() => qp("lvlMax"));
  const [invMin, setInvMin] = useState(() => qp("invMin"));
  const [invMax, setInvMax] = useState(() => qp("invMax"));
  /** Inventário Valorant: debounce para não disparar 1 fetch LZT por tecla (abort/retry deixa tudo lento). */
  const [debouncedInvMin, setDebouncedInvMin] = useState(() => qp("invMin"));
  const [debouncedInvMax, setDebouncedInvMax] = useState(() => qp("invMax"));
  const prevGameTabForInvDebounceRef = useRef<GameTab | null>(null);
  useEffect(() => {
    if (gameTab !== "valorant") {
      setDebouncedInvMin(invMin);
      setDebouncedInvMax(invMax);
      prevGameTabForInvDebounceRef.current = gameTab;
      return;
    }
    const tabJustChanged = prevGameTabForInvDebounceRef.current !== gameTab;
    prevGameTabForInvDebounceRef.current = gameTab;
    if (tabJustChanged) {
      setDebouncedInvMin(invMin);
      setDebouncedInvMax(invMax);
      return;
    }
    const ms = 420;
    const id = window.setTimeout(() => {
      setDebouncedInvMin(invMin);
      setDebouncedInvMax(invMax);
    }, ms);
    return () => clearTimeout(id);
  }, [invMin, invMax, gameTab]);

  // Voltar/avançar ou editar URL: estado dos filtros vinha só do mount inicial — ficava dessincronizado.
  // `sort` continua com efeito dedicado (normalização); aqui não mexemos em sortBy.
  useEffect(() => {
    const tab = gameTabFromSearchParams(searchParams);
    const get = (k: string, d = "") => searchParams.get(k) ?? d;

    setSearchQuery((prev) => {
      const v = get("q").slice(0, 100);
      return prev === v ? prev : v;
    });
    setPriceMin((prev) => {
      const v = get("pmin").slice(0, 7);
      return prev === v ? prev : v;
    });
    setPriceMax((prev) => {
      const v = get("pmax").slice(0, 7);
      return prev === v ? prev : v;
    });
    setLvlMin((prev) => {
      const v = get("lvlMin").slice(0, 4);
      return prev === v ? prev : v;
    });
    setLvlMax((prev) => {
      const v = get("lvlMax").slice(0, 4);
      return prev === v ? prev : v;
    });
    const invMi = get("invMin").slice(0, 7);
    const invMa = get("invMax").slice(0, 7);
    setInvMin((prev) => (prev === invMi ? prev : invMi));
    setInvMax((prev) => (prev === invMa ? prev : invMa));
    setDebouncedInvMin((prev) => (prev === invMi ? prev : invMi));
    setDebouncedInvMax((prev) => (prev === invMa ? prev : invMa));

    const rankRaw = get("rank", "todos");
    if (tab === "valorant") {
      const vr = VALORANT_RANK_IDS.has(rankRaw) ? rankRaw : "todos";
      setSelectedRank((prev) => (prev === vr ? prev : vr));
      setLolRank((prev) => (prev === "todos" ? prev : "todos"));
    } else if (tab === "lol") {
      const lr = LOL_RANK_IDS.has(rankRaw) ? rankRaw : "todos";
      setLolRank((prev) => (prev === lr ? prev : lr));
      setSelectedRank((prev) => (prev === "todos" ? prev : "todos"));
    } else {
      setSelectedRank((prev) => (prev === "todos" ? prev : "todos"));
      setLolRank((prev) => (prev === "todos" ? prev : "todos"));
    }

    const weaponRaw = get("weapon", "todos");
    const vw = VAL_WEAPON_IDS.has(weaponRaw) ? weaponRaw : "todos";
    setSelectedWeapon((prev) => (prev === vw ? prev : vw));

    setOnlyKnife((prev) => {
      const v = searchParams.get("knife") === "1";
      return prev === v ? prev : v;
    });

    const regionRaw = get("region", tab === "lol" ? "BR1" : "br");
    if (tab === "valorant") {
      const vr = VAL_REGION_IDS.has(regionRaw) ? regionRaw : "br";
      setValRegion((prev) => (prev === vr ? prev : vr));
    } else if (tab === "lol") {
      const lr = LOL_REGION_IDS.has(regionRaw) ? regionRaw : "BR1";
      setLolRegion((prev) => (prev === lr ? prev : lr));
    }

    if (tab === "lol") {
      setLolChampMin((prev) => {
        const v = get("champMin");
        return prev === v ? prev : v;
      });
      setLolSkinsMin((prev) => {
        const v = get("skinsMin");
        return prev === v ? prev : v;
      });
    }

    if (tab === "fortnite") {
      setFnVbMin((prev) => {
        const v = get("vbMin");
        return prev === v ? prev : v;
      });
      setFnSkinsMin((prev) => {
        const v = get("skinsMin");
        return prev === v ? prev : v;
      });
      setFnLevelMin((prev) => {
        const v = get("levelMin");
        return prev === v ? prev : v;
      });
      setFnHasBattlePass((prev) => {
        const v = searchParams.get("battlePass") === "1";
        return prev === v ? prev : v;
      });
    }

    if (tab === "minecraft") {
      setMcJava((prev) => {
        const v = searchParams.get("java") === "1";
        return prev === v ? prev : v;
      });
      setMcBedrock((prev) => {
        const v = searchParams.get("bedrock") === "1";
        return prev === v ? prev : v;
      });
      setMcHypixelLvlMin((prev) => {
        const v = get("hypixelMin");
        return prev === v ? prev : v;
      });
      setMcCapesMin((prev) => {
        const v = get("capesMin");
        return prev === v ? prev : v;
      });
      setMcNoBan((prev) => {
        const v = searchParams.get("noBan") === "1";
        return prev === v ? prev : v;
      });
    }
  }, [searchParams]);

  // page state removed — displayPage handles client-side pagination
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Lock body scroll when mobile filters are open
  useEffect(() => {
    if (mobileFiltersOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileFiltersOpen]);

  // ─── Sync filters → URL query params ───
  const syncFiltersToUrlRef = useRef(false);
  useEffect(() => {
    // Skip first render (state was initialized from URL)
    if (!syncFiltersToUrlRef.current) {
      syncFiltersToUrlRef.current = true;
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      // Helper: set or delete
      const set = (k: string, v: string, def: string = "") => {
        if (v && v !== def) next.set(k, v);
        else next.delete(k);
      };
      const setBool = (k: string, v: boolean) => {
        if (v) next.set(k, "1");
        else next.delete(k);
      };

      // Game tab — always persist so other effects don't reset to valorant
      if (gameTab !== "valorant") next.set("game", gameTab);
      else next.delete("game");

      // Shared
      set("q", searchQuery);
      set("sort", sortBy, "pdate_to_down");
      set("pmin", priceMin);
      set("pmax", priceMax);

      // Game-specific — only write params relevant to the current tab
      // Clear all game-specific keys first
      ["rank", "weapon", "knife", "region", "champMin", "skinsMin", "vbMin",
       "levelMin", "battlePass", "java", "bedrock", "hypixelMin", "capesMin",
       "noBan", "lvlMin", "lvlMax", "invMin", "invMax"].forEach(k => next.delete(k));

      if (gameTab === "valorant") {
        set("rank", selectedRank, "todos");
        set("weapon", selectedWeapon, "todos");
        setBool("knife", onlyKnife);
        set("region", valRegion, "br");
        set("lvlMin", lvlMin); set("lvlMax", lvlMax);
        set("invMin", invMin); set("invMax", invMax);
      } else if (gameTab === "lol") {
        set("rank", lolRank, "todos");
        set("champMin", lolChampMin);
        set("skinsMin", lolSkinsMin);
        set("region", lolRegion, "BR1");
        set("lvlMin", lvlMin); set("lvlMax", lvlMax);
      } else if (gameTab === "fortnite") {
        set("vbMin", fnVbMin);
        set("skinsMin", fnSkinsMin);
        set("levelMin", fnLevelMin);
        setBool("battlePass", fnHasBattlePass);
      } else if (gameTab === "minecraft") {
        setBool("java", mcJava);
        setBool("bedrock", mcBedrock);
        set("hypixelMin", mcHypixelLvlMin);
        set("capesMin", mcCapesMin);
        setBool("noBan", mcNoBan);
      }

      return next;
    }, { replace: true });
  }, [
    gameTab, searchQuery, sortBy, priceMin, priceMax,
    selectedRank, selectedWeapon, onlyKnife, valRegion,
    lolRank, lolChampMin, lolSkinsMin, lolRegion,
    fnVbMin, fnSkinsMin, fnLevelMin, fnHasBattlePass,
    mcJava, mcBedrock, mcHypixelLvlMin, mcCapesMin, mcNoBan,
    lvlMin, lvlMax, invMin, invMax, setSearchParams,
  ]);

  // ─── Sidebar collapse ───
  const [rankOpen, setRankOpen] = useState(true);
  const [skinsOpen, setSkinsOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(gameTab === "fortnite" || gameTab === "minecraft");
  const [invOpen, setInvOpen] = useState(gameTab === "fortnite");
  const [lvlOpen, setLvlOpen] = useState(gameTab === "fortnite" || gameTab === "minecraft");

  // Open sidebar sections when switching tabs
  useEffect(() => {
    if (gameTab === "fortnite") {
      setPriceOpen(true);
      setInvOpen(true);
      setLvlOpen(true);
    }
    if (gameTab === "minecraft") {
      setPriceOpen(true);
      setLvlOpen(true);
    }
  }, [gameTab]);

  // ─── Streaming state ───
  const [streamedItems, setStreamedItems] = useState<LztItem[]>([]);
  const [streamingDone, setStreamingDone] = useState(false);
  const [streamError, setStreamError] = useState<Error | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Abort só do “carregar mais” — separado do `abortRef` da listagem principal. */
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const prevGameTabRef = useRef(gameTab);
  
  const isValorant = gameTab === "valorant";
  const isLol = gameTab === "lol";
  const isFortnite = gameTab === "fortnite";
  const isMinecraft = gameTab === "minecraft";
  
  // ─── Persistent Cache (Session Storage) ───
  // Use session storage so when users navigate away and back, it's instant.
  type CacheEntry = { items: LztItem[]; hasNextPage: boolean; currentPage: number; timestamp: number };

  const fetchCacheRef = useRef<Map<string, CacheEntry>>(null!);
  if (!fetchCacheRef.current) {
    // Lazy init — runs only once (avoids re-parsing JSON on every render)
    let map = new Map<string, CacheEntry>();
    try {
      const stored = sessionStorage.getItem("royal_lzt_cache");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const tuples = parsed.filter(
            (row): row is [string, CacheEntry] =>
              Array.isArray(row) &&
              row.length >= 2 &&
              typeof row[0] === "string" &&
              row[1] !== null &&
              typeof row[1] === "object",
          );
          map = new Map(tuples);
        }
      }
    } catch { /* silent */ }
    fetchCacheRef.current = map;
  }
  const MAX_CACHE_ENTRIES = 20;
  const persistSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushCacheToSession = useCallback(() => {
    try {
      // Strip heavy fields (screenshots/description) before serializing to reduce payload
      const slim = Array.from(fetchCacheRef.current.entries()).map(([k, v]) => [
        k,
        { ...v, items: v.items.map(({ description, ...rest }) => rest) },
      ]);
      sessionStorage.setItem("royal_lzt_cache", JSON.stringify(slim));
    } catch { /* silent — quota exceeded or unavailable */ }
  }, []);

  useEffect(
    () => () => {
      if (persistSessionTimerRef.current) {
        clearTimeout(persistSessionTimerRef.current);
        persistSessionTimerRef.current = null;
      }
      flushCacheToSession();
    },
    [flushCacheToSession],
  );

  const cacheSet = useCallback(
    (key: string, value: CacheEntry) => {
      const cache = fetchCacheRef.current;
      cache.set(key, value);
      if (cache.size > MAX_CACHE_ENTRIES) {
        let oldestKey = "";
        let oldestTs = Infinity;
        for (const [k, v] of cache) {
          if (v.timestamp < oldestTs) {
            oldestTs = v.timestamp;
            oldestKey = k;
          }
        }
        if (oldestKey) cache.delete(oldestKey);
      }
      if (persistSessionTimerRef.current) clearTimeout(persistSessionTimerRef.current);
      persistSessionTimerRef.current = setTimeout(() => {
        persistSessionTimerRef.current = null;
        flushCacheToSession();
      }, 1500);
    },
    [flushCacheToSession],
  );

  // Detail 410 (vendida / filtros): remove da grelha e do cache de sessão — evita novos GET ao hover e lista “fantasma”.
  useEffect(() => {
    const onDetailGone = (ev: Event) => {
      const ce = ev as CustomEvent<{ itemId?: string }>;
      const goneId = ce.detail?.itemId != null ? String(ce.detail.itemId) : "";
      if (!goneId) return;
      setStreamedItems((prev) => prev.filter((i) => String(i.item_id) !== goneId));
      const cache = fetchCacheRef.current;
      for (const [key, entry] of cache.entries()) {
        const filtered = entry.items.filter((i) => String(i.item_id) !== goneId);
        if (filtered.length !== entry.items.length) {
          cache.set(key, { ...entry, items: filtered });
        }
      }
      flushCacheToSession();
      queryClient.removeQueries({
        predicate: (q) => {
          const k = q.queryKey;
          return Array.isArray(k) && k[0] === "lzt-account-detail" && String(k[2]) === goneId;
        },
      });
    };
    window.addEventListener(LZT_ACCOUNT_DETAIL_GONE_EVENT, onDetailGone as EventListener);
    return () => window.removeEventListener(LZT_ACCOUNT_DETAIL_GONE_EVENT, onDetailGone as EventListener);
  }, [flushCacheToSession, queryClient]);

  const MAX_PAGES = 8;
  const [firstPageLoaded, setFirstPageLoaded] = useState(false);

  // ─── Asset maps (only load when needed) ───
  const { data: skinsMap = new Map() } = useQuery({
    queryKey: ["all-valorant-skins"],
    queryFn: fetchAllValorantSkins,
    staleTime: 1000 * 60 * 60,
    enabled: gameTab === "valorant",
  });

  const { data: champKeyMap = new Map<number, string>() } = useQuery({
    queryKey: ["lol-champ-key-map"],
    queryFn: fetchLolChampKeyMap,
    staleTime: 1000 * 60 * 60 * 6,
    enabled: gameTab === "lol",
  });

  const { data: fnSkinsDb = new Map<string, FortniteCosmeticDbRow>() } = useQuery({
    queryKey: ["fortnite-cosmetics"],
    queryFn: fetchFortniteSkins,
    staleTime: 1000 * 60 * 60 * 6,
    enabled: gameTab === "fortnite",
  });

  const buildParams = useCallback((pageNum: number = 1): Record<string, string | string[]> => {
    const params: Record<string, string | string[]> = {};
    params.page = String(pageNum);
    // Ordenação LZT: preço reordenado no edge com price_brl; custo-benefício → pdate (sort só no cliente).
    params.order_by = lztListOrderBy;
    if (searchQuery) params.title = searchQuery;

    // Send price filters to API so server filters before returning
    if (priceMin && Number(priceMin) > 0) params.pmin = priceMin;
    if (priceMax && Number(priceMax) > 0) params.pmax = priceMax;

    if (gameTab === "valorant") {
      params.game_type = "riot";
      if (debouncedInvMin) params.inv_min = debouncedInvMin;
      if (debouncedInvMax) params.inv_max = debouncedInvMax;
      if (onlyKnife) params.knife = "1";
      if (lvlMin) params.valorant_level_min = lvlMin;
      if (lvlMax) params.valorant_level_max = lvlMax;

      const rankFilter = valorantRankFilters.find((r) => r.id === selectedRank);
      if (rankFilter && rankFilter.id !== "todos") {
        params.rmin = String(rankFilter.rmin);
        params.rmax = String(rankFilter.rmax);
      }

      // Use country[] because it matches the LZT API results for Valorant reliably
      if (valRegion !== "all") {
        const countries = REGION_COUNTRY_MAP[valRegion];
        if (countries) params["country[]"] = countries;
      }

      if (selectedWeapon !== "todos") {
        // Weapon filter uses a separate param so it doesn't overwrite user's title search
        params.weapon_name = selectedWeapon;
        // Also append to title for API text search (weapon skins are in the title)
        if (searchQuery) {
          params.title = `${searchQuery} ${selectedWeapon}`;
        } else {
          params.title = selectedWeapon;
        }
      }
    } else if (gameTab === "lol") {
      // LoL-specific — use lol_region[] NOT country[] per LZT API docs
      params.game_type = "lol";
      if (lolSkinsMin && Number(lolSkinsMin) > 0) params.lol_smin = lolSkinsMin;
      if (lolChampMin && Number(lolChampMin) > 0) params.champion_min = lolChampMin;
      if (lvlMin) params.lol_level_min = lvlMin;
      if (lvlMax) params.lol_level_max = lvlMax;

      if (lolRank !== "todos" && lolRankApiValues[lolRank]) {
        params["lol_rank[]"] = lolRankApiValues[lolRank];
      }

      // LoL uses lol_region[] per official API, NOT country[]
      if (lolRegion !== "all") {
        params["lol_region[]"] = lolRegion;
      }
    } else if (gameTab === "minecraft") {
      params.game_type = "minecraft";
      if (mcJava) params.java = "yes";
      if (mcBedrock) params.bedrock = "yes";
      if (mcHypixelLvlMin) params.level_hypixel_min = mcHypixelLvlMin;
      if (mcCapesMin) params.capes_min = mcCapesMin;
      if (mcNoBan) params.hypixel_ban = "no";
    } else if (gameTab === "fortnite") {
      // Fortnite-specific (level_min & battlePass are filtered client-side, not sent to API)
      params.game_type = "fortnite";
      if (fnVbMin) params.vbmin = fnVbMin;
      // Enforce minimum 10 skins server-side; if user typed a lower value, use 10
      const userSmin = Number(fnSkinsMin) || 0;
      params.smin = String(Math.max(userSmin, 10));
    }

    return params;
  }, [searchQuery, onlyKnife, selectedRank, selectedWeapon, debouncedInvMin, debouncedInvMax, lvlMin, lvlMax, gameTab, lolRank, lolChampMin, lolSkinsMin, fnVbMin, fnSkinsMin, mcJava, mcBedrock, mcHypixelLvlMin, mcCapesMin, mcNoBan, lolRegion, valRegion, lztListOrderBy, priceMin, priceMax]);

  const paramsKey = JSON.stringify(buildParams(1)) + gameTab;
  // Só o campo "busca por título" usa debounce. Preço, inv, nível, mínimos etc. disparam fetch na hora (mais fluido).
  const nonSearchParamsKey = useMemo(
    () =>
      JSON.stringify({
        gameTab,
        lztListOrderBy,
        selectedRank,
        selectedWeapon,
        onlyKnife,
        valRegion,
        lolRank,
        lolRegion,
        lolChampMin,
        lolSkinsMin,
        mcJava,
        mcBedrock,
        mcNoBan,
        mcHypixelLvlMin,
        mcCapesMin,
        priceMin,
        priceMax,
        invMin: debouncedInvMin,
        invMax: debouncedInvMax,
        lvlMin,
        lvlMax,
        fnVbMin,
        fnSkinsMin,
      }),
    [
      gameTab,
      lztListOrderBy,
      selectedRank,
      selectedWeapon,
      onlyKnife,
      valRegion,
      lolRank,
      lolRegion,
      lolChampMin,
      lolSkinsMin,
      mcJava,
      mcBedrock,
      mcNoBan,
      mcHypixelLvlMin,
      mcCapesMin,
      priceMin,
      priceMax,
      debouncedInvMin,
      debouncedInvMax,
      lvlMin,
      lvlMax,
      fnVbMin,
      fnSkinsMin,
    ],
  );
  const [debouncedParamsKey, setDebouncedParamsKey] = useState(paramsKey);
  const prevNonSearchRef = useRef(nonSearchParamsKey);
  const prevSearchTrimRef = useRef(searchQuery.trim());
  useEffect(() => {
    // Non-search filter changes: apply immediately (no debounce)
    if (prevNonSearchRef.current !== nonSearchParamsKey) {
      prevNonSearchRef.current = nonSearchParamsKey;
      setDebouncedParamsKey(paramsKey);
      prevSearchTrimRef.current = searchQuery.trim();
      return;
    }
    // Search cleared: apply immediately
    const clearedSearch = prevSearchTrimRef.current !== "" && searchQuery.trim() === "";
    prevSearchTrimRef.current = searchQuery.trim();
    if (clearedSearch) {
      setDebouncedParamsKey(paramsKey);
      return;
    }
    // No actual change from current debounced value: skip debounce timer
    if (debouncedParamsKey === paramsKey) return;
    // Search text changed: debounce 280ms
    const delay = 280;
    const handler = setTimeout(() => setDebouncedParamsKey(paramsKey), delay);
    return () => clearTimeout(handler);
  }, [paramsKey, nonSearchParamsKey, searchQuery, debouncedParamsKey]);

  const fetchWithRetry = useCallback(
    async (
      params: Record<string, string | string[]>,
      controller: AbortController,
      retries = 3
    ): Promise<LztMarketListResponse> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (controller.signal.aborted) throw new Error("aborted");
      try {
        return await fetchAccountsRaw(params, controller.signal);
      } catch (err: unknown) {
        const errName = errorName(err);
        if (controller.signal.aborted || errName === "AbortError") throw err;
        if (attempt >= retries) throw err;
        // Exponential backoff: 1s, 2s, 4s
        await waitWithAbort(1000 * Math.pow(2, attempt), controller.signal);
      }
    }
    throw new Error("fetchWithRetry: retries exhausted");
  },
    [],
  );

  const fetchMultiplePages = useCallback(async (controller: AbortController) => {
    const cacheKey = debouncedParamsKey;
    const cached = fetchCacheRef.current.get(cacheKey);
    // (tabChanged is checked inside the branches below)

    // Show stale cache immediately (even if expired) while fetching fresh data
    const cacheAgeMs = cached ? Date.now() - cached.timestamp : Infinity;
    if (cached) {
      setStreamedItems(cached.items);
      setStreamingDone(true);
      setStreamError(null);
      setCurrentPage(cached.currentPage);
      setLoadingMore(false);
      setDisplayPage(1);
      setFirstPageLoaded(true);
      setHasNextPage(cached.hasNextPage);
      // Always refetch below (stale-while-revalidate). Markup/max_price live only on the server —
      // skipping fetch while cache was "fresh" left old `price_brl` on screen after admin changes.
    }

    try {
      if (!cached) {
        const tabChanged = prevGameTabRef.current !== gameTab;
        setStreamingDone(false);
        setStreamError(null);
        setCurrentPage(1);
        setLoadingMore(false);
        setDisplayPage(1);
        if (tabChanged) {
          // Tab changed with no cache: clear items to avoid rendering old-game data with new-game card components
          setStreamedItems([]);
          setFirstPageLoaded(false);
          setIsRefetching(false);
        } else {
          // Same tab, filter change: keep existing items visible with refetching indicator
          setIsRefetching(true);
          setStreamedItems(prev => {
            if (prev.length === 0) setFirstPageLoaded(false);
            return prev;
          });
        }
      } else {
        // Cached: só mostra indicador de atualização quando o cache já estava velho (evita flicker a cada SWR silencioso)
        if (cacheAgeMs >= 45000) setIsRefetching(true);
      }

      const data = await fetchWithRetry(buildParams(1), controller);
      if (controller.signal.aborted) return;

      setFirstPageLoaded(true);
      setIsRefetching(false);
      const firstPageItems: LztItem[] = data?.items ?? [];
      const hasMore = data?.hasNextPage ?? firstPageItems.length >= 15;
      setHasNextPage(hasMore);
      setCurrentPage(1);
      setStreamedItems(firstPageItems);
      setStreamingDone(true);

      cacheSet(cacheKey, {
        items: firstPageItems,
        hasNextPage: hasMore,
        currentPage: 1,
        timestamp: Date.now(),
      });
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setFirstPageLoaded(true);
        setIsRefetching(false);
        setStreamError(err instanceof Error ? err : new Error(String(err)));
        setStreamingDone(true);
      }
    } finally {
      prevGameTabRef.current = gameTab;
    }
  }, [buildParams, debouncedParamsKey, fetchWithRetry, cacheSet, gameTab]);

  // Prefetch adjacent game tabs in background for instant switching (staggered to avoid 429 Rate Limits)
  const prefetchRef = useRef(new Set<string>());
  const prefetchTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prefetchRunIdRef = useRef(0);

  const clearPrefetchTimeouts = useCallback(() => {
    prefetchTimeoutsRef.current.forEach(clearTimeout);
    prefetchTimeoutsRef.current = [];
  }, []);

  const prefetchAdjacentTabs = useCallback(() => {
    clearPrefetchTimeouts();
    prefetchRunIdRef.current += 1;
    const runId = prefetchRunIdRef.current;

    const allTabs: GameTab[] = ["valorant", "lol", "fortnite", "minecraft"];
    const otherTabs = allTabs.filter(t => t !== gameTab);
    let delayMultiplier = 0;

    for (const tab of otherTabs) {
      if (prefetchRef.current.has(tab)) continue;
      prefetchRef.current.add(tab);

      const gameTypeMap: Record<GameTab, string> = { valorant: "riot", lol: "lol", fortnite: "fortnite", minecraft: "minecraft" };
      const qp = new URLSearchParams();
      qp.set("page", "1");
      qp.set("order_by", "pdate_to_down");
      qp.set("game_type", gameTypeMap[tab]);
      if (tab === "fortnite") qp.set("smin", "10");
      if (tab === "valorant") qp.append("country[]", "Bra");
      if (tab === "lol") qp.append("lol_region[]", "BR1");

      const delayMs = delayMultiplier * 800; // 800ms stagger to reduce API load at 100k+ DAU
      const timeoutId = setTimeout(() => {
        if (runId !== prefetchRunIdRef.current) return;
        void (async () => {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/lzt-market?${qp.toString()}`, {
              headers: {
                "Content-Type": "application/json",
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
            });
            if (runId !== prefetchRunIdRef.current) return;
            if (!res.ok) return;
            const data = await res.json();
            if (runId !== prefetchRunIdRef.current) return;
            const items: LztItem[] = data?.items ?? [];
            const hasMore = data?.hasNextPage ?? items.length >= 15;
            cacheSet(`__prefetch__${tab}`, { items, hasNextPage: hasMore, currentPage: 1, timestamp: Date.now() });
          } catch { /* silent */ }
        })();
      }, delayMs);
      prefetchTimeoutsRef.current.push(timeoutId);

      delayMultiplier++;
    }
  }, [gameTab, cacheSet, clearPrefetchTimeouts]);

  useEffect(() => () => clearPrefetchTimeouts(), [clearPrefetchTimeouts]);

  // Enhanced fetchMultiplePages: check prefetch cache on tab switch
  const fetchMultiplePagesWithPrefetch = useCallback(async (controller: AbortController) => {
    // Check if we have a prefetched result for this game tab
    const prefetchKey = `__prefetch__${gameTab}`;
    const prefetched = fetchCacheRef.current.get(prefetchKey);
    const cacheKey = debouncedParamsKey;
    const cached = fetchCacheRef.current.get(cacheKey);

    // Use prefetch if no specific cache exists and filters are at defaults
    if (!cached && prefetched && Date.now() - prefetched.timestamp < 45000) {
      setStreamedItems(prefetched.items);
      setStreamingDone(true);
      setStreamError(null);
      setCurrentPage(prefetched.currentPage);
      setLoadingMore(false);
      setDisplayPage(1);
      setFirstPageLoaded(true);
      setHasNextPage(prefetched.hasNextPage);
      prevGameTabRef.current = gameTab;

      // Sempre reconciliar com a API: prefetch pode ter `price_brl` antigo (markup mudou no admin).
      const paramsSnapshot = buildParams(1);
      void (async () => {
        try {
          const data = await fetchWithRetry(paramsSnapshot, controller);
          if (controller.signal.aborted) return;
          const items: LztItem[] = data?.items ?? [];
          const hasMore = data?.hasNextPage ?? items.length >= 15;
          setStreamedItems(items);
          setHasNextPage(hasMore);
          setCurrentPage(1);
          cacheSet(cacheKey, { items, hasNextPage: hasMore, currentPage: 1, timestamp: Date.now() });
        } catch (e: unknown) {
          if (import.meta.env.DEV) {
            console.warn("Contas: reconciliação pós-prefetch falhou", e instanceof Error ? e.message : String(e));
          }
        }
      })();
      return;
    }

    // Fallback to original logic
    await fetchMultiplePages(controller);
  }, [buildParams, debouncedParamsKey, fetchMultiplePages, fetchWithRetry, gameTab, cacheSet]);

  useEffect(() => {
    abortRef.current?.abort();
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchMultiplePagesWithPrefetch(controller);
    return () => { controller.abort(); loadMoreControllerRef.current?.abort(); };
  }, [debouncedParamsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger prefetch after initial load completes
  useEffect(() => {
    if (firstPageLoaded && streamedItems.length > 0) {
      // Re-enabled Staggered Prefetch (Safe from 429 API Rate Limit)
      const timer = setTimeout(prefetchAdjacentTabs, 200);
      return () => clearTimeout(timer);
    }
  }, [firstPageLoaded, gameTab, prefetchAdjacentTabs]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMorePages = async () => {
    if (streamError || loadingMore || !hasNextPage) return;
    if (currentPage >= MAX_PAGES) return;
    setLoadingMore(true);
    // Use a SEPARATE controller so load-more doesn't hijack the main abortRef
    // The main abortRef is only used by fetchMultiplePages (tab/filter changes).
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;

    // Also abort load-more when the main controller aborts (tab/filter change)
    const mainController = abortRef.current;
    const onMainAbort = () => controller.abort();
    mainController?.signal.addEventListener("abort", onMainAbort, { once: true });

    const snapshotGameTab = gameTab;
    try {
      const cacheKey = debouncedParamsKey;
      const nextPageNum = currentPage + 1;
      const data = await fetchWithRetry(buildParams(nextPageNum), controller);
      if (controller.signal.aborted || snapshotGameTab !== gameTab) return;
      const pageItems: LztItem[] = data?.items ?? [];
      const nextHasPage = data?.hasNextPage ?? pageItems.length >= 15;
      setHasNextPage(nextHasPage);
      setCurrentPage(nextPageNum);
      // Deduplicate by item_id to prevent duplicates from race conditions
      setStreamedItems(prev => {
        const existingIds = new Set(prev.map(i => i.item_id));
        const newItems = pageItems.filter(i => !existingIds.has(i.item_id));
        const merged = [...prev, ...newItems];
        cacheSet(cacheKey, {
          items: merged,
          hasNextPage: nextHasPage,
          currentPage: nextPageNum,
          timestamp: Date.now(),
        });
        return merged;
      });
    } catch (err: unknown) {
      if (!controller.signal.aborted && snapshotGameTab === gameTab) {
        setStreamError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      mainController?.signal.removeEventListener("abort", onMainAbort);
      setLoadingMore(false);
    }
  };

  const ITEMS_PER_PAGE = 24;
  const [displayPage, setDisplayPage] = useState(1);

  const isLoading = !firstPageLoaded && !streamingDone && !streamError;

  // SEO: update document title per game tab
  useEffect(() => {
    const titles: Record<GameTab, string> = {
      valorant: "Contas Valorant | Royal Store",
      lol: "Contas LoL | Royal Store",
      fortnite: "Contas Fortnite | Royal Store",
      minecraft: "Contas Minecraft | Royal Store",
    };
    document.title = titles[gameTab];
    return () => { document.title = "Royal Store"; };
  }, [gameTab]);

  // Helper: get BRL price for sorting (same rules as getDisplayPrice / getPrice)
  const getBrlPrice = useCallback(
    (item: LztItem): number =>
      getLztItemBrlPrice(
        { price: item.price, price_currency: item.price_currency, price_brl: item.price_brl },
        gameTab,
      ),
    [gameTab],
  );

  const allItems = useMemo(() => {
    let filtered = [...streamedItems];
    if (gameTab === "lol") {
      filtered = filtered.filter((item) => !isLikelyWrongGameInLolList(item));
    }
    // Fortnite client-side filters (level & battle pass not available as API params)
    if (gameTab === "fortnite") {
      const lvlMin = Number(fnLevelMin) || 0;
      if (lvlMin > 0) {
        filtered = filtered.filter((item) => (item.fortnite_level ?? 0) >= lvlMin);
      }
      if (fnHasBattlePass) {
        filtered = filtered.filter((item) => {
          const seasons = item.fortnitePastSeasons;
          return Array.isArray(seasons) && seasons.some((s: Record<string, unknown>) => s.purchasedVIP === true);
        });
      }
    }

    // Region filter is now done server-side via country[] API param
    // Price filtering is done server-side via pmin/pmax — no duplicate client-side filter needed

    // If user explicitly chose a price sort, use BRL display price for accurate ordering
    if (sortBy === "price_to_up") {
      return filtered.sort((a, b) => getBrlPrice(a) - getBrlPrice(b));
    }
    if (sortBy === "price_to_down") {
      return filtered.sort((a, b) => getBrlPrice(b) - getBrlPrice(a));
    }

    // Default sort (pdate_to_down = "Mais Recentes"): preserve API date order for ALL games.
    // The API already returns items sorted by publication date descending.
    return filtered;
  }, [streamedItems, sortBy, gameTab, getBrlPrice, fnLevelMin, fnHasBattlePass]);
  const totalDisplayPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));

  // Clamp displayPage when allItems shrinks (e.g. after price filtering)
  useEffect(() => {
    if (displayPage > totalDisplayPages) setDisplayPage(totalDisplayPages);
  }, [totalDisplayPages, displayPage]);

  const items = allItems.slice((displayPage - 1) * ITEMS_PER_PAGE, displayPage * ITEMS_PER_PAGE);

  const catalogGame: GameCategory =
    gameTab === "valorant" ? "valorant" : gameTab === "fortnite" ? "fortnite" : gameTab === "minecraft" ? "minecraft" : "lol";

  const gridRows = useMemo(
    () =>
      items.map((item) => ({
        item,
        priceLabel: getDisplayPrice(
          { price: item.price, price_currency: item.price_currency, price_brl: item.price_brl },
          catalogGame,
        ),
      })),
    [items, getDisplayPrice, catalogGame],
  );

  const refetch = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDisplayPage(1);
    fetchMultiplePagesWithPrefetch(controller);
  };

  const clearFilters = () => {
    setSelectedRank("todos");
    setSelectedWeapon("todos");
    setLolRank("todos");
    setLolChampMin("");
    setLolSkinsMin("");
    setFnVbMin("");
    setFnSkinsMin("");
    setFnLevelMin("");
    setFnHasBattlePass(false);
    setMcJava(false);
    setMcBedrock(false);
    setMcHypixelLvlMin("");
    setMcCapesMin("");
    setMcNoBan(false);
    setValRegion("br");
    setLolRegion("BR1");
    setPriceMin(""); setPriceMax("");
    setSearchQuery(""); setOnlyKnife(false);
    setInvMin(""); setInvMax("");
    setDebouncedInvMin(""); setDebouncedInvMax("");
    setLvlMin(""); setLvlMax("");
    setSortBy("pdate_to_down");
    setDisplayPage(1);
  };

  const switchTab = (tab: GameTab) => {
    if (tab === gameTab) return;
    setGameTab(tab);
    // Não substituir a query inteira — perdia utm_*, ref, etc. Só removemos chaves que o sync gere.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const k of CONTAS_MANAGED_QUERY_KEYS) next.delete(k);
        if (tab !== "valorant") next.set("game", tab);
        return next;
      },
      { replace: false },
    );
    clearFilters();
  };

  const activeFiltersCount = [
    gameTab === "valorant" && selectedRank !== "todos",
    gameTab === "valorant" && selectedWeapon !== "todos",
    gameTab === "valorant" && onlyKnife,
    gameTab === "valorant" && valRegion !== "br",
    gameTab === "lol" && lolRank !== "todos",
    gameTab === "lol" && lolChampMin !== "",
    gameTab === "lol" && lolSkinsMin !== "",
    gameTab === "lol" && lolRegion !== "BR1",
    gameTab === "fortnite" && fnVbMin !== "",
    gameTab === "fortnite" && fnSkinsMin !== "",
    gameTab === "fortnite" && fnLevelMin !== "",
    gameTab === "fortnite" && fnHasBattlePass,
    isMinecraft && mcJava,
    isMinecraft && mcBedrock,
    isMinecraft && mcHypixelLvlMin !== "",
    isMinecraft && mcCapesMin !== "",
    isMinecraft && mcNoBan,
    priceMin !== "" || priceMax !== "",
    searchQuery !== "",
    invMin !== "", invMax !== "",
    lvlMin !== "", lvlMax !== "",
  ].filter(Boolean).length;

  const accentColor = isValorant ? "hsl(var(--success))" : isFortnite ? FN_PURPLE : isMinecraft ? MC_GREEN : "hsl(198,100%,45%)";
  const accentClass = isValorant
    ? "text-success border-success bg-success/10"
    : isFortnite
    ? "text-[hsl(265,80%,65%)] border-[hsl(265,80%,65%)] bg-[hsl(265,80%,65%,0.1)]"
    : isMinecraft
    ? "text-[hsl(120,60%,45%)] border-[hsl(120,60%,45%)] bg-[hsl(120,60%,45%,0.1)]"
    : "text-[hsl(198,100%,45%)] border-[hsl(198,100%,45%)] bg-[hsl(198,100%,45%,0.1)]";

  const searchPlaceholder = isFortnite
    ? "Buscar por skin... (ex: Travis Scott)"
    : isValorant
      ? "Buscar por skin... (ex: Reaver)"
      : gameTab === "lol"
        ? "Buscar conta..."
        : "Buscar conta...";

  const renderFilterContent = () => (
    <>
      {/* Search */}
      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value.slice(0, 100)); setDisplayPage(1); }}
          className="w-full rounded-lg border border-border bg-secondary/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors"
          onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)}
          onBlur={e => (e.currentTarget.style.borderColor = '')}
        />
      </div>


      {/* Valorant filters */}
      {isValorant && (
        <>
          <div className="mt-6">
            <button onClick={() => setRankOpen(!rankOpen)} className="flex w-full items-center justify-between text-sm font-semibold text-foreground">
              Elo / Rank
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${rankOpen ? "rotate-180" : ""}`} />
            </button>
            {rankOpen && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {valorantRankFilters.map((rank) => (
                  <button key={rank.id} onClick={() => { setSelectedRank(rank.id); setDisplayPage(1); }}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-all ${selectedRank === rank.id ? "border-success bg-success/10 shadow-[0_0_10px_hsl(130,99%,41%,0.15)]" : "border-border hover:border-foreground/30"}`}
                    title={rank.name}>
                    <img src={rank.img} alt={rank.name} className="h-8 w-8 object-contain" loading="lazy" />
                    <span className={`text-[10px] font-medium leading-tight text-center ${selectedRank === rank.id ? "text-success" : "text-muted-foreground"}`}>{rank.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <button onClick={() => setSkinsOpen(!skinsOpen)} className="flex w-full items-center justify-between text-sm font-semibold text-foreground">
              <span className="flex items-center gap-2"><Crosshair className="h-4 w-4 text-success" />Skins de Arma</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${skinsOpen ? "rotate-180" : ""}`} />
            </button>
            {skinsOpen && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {weapons.map((weapon) => (
                  <button key={weapon.id} onClick={() => { setSelectedWeapon(weapon.id); setDisplayPage(1); }}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all ${selectedWeapon === weapon.id ? "border-success bg-success/10 shadow-[0_0_10px_hsl(130,99%,41%,0.15)]" : "border-border hover:border-foreground/30"}`}
                    title={weapon.name}>
                    {weapon.img ? (
                      <img src={weapon.img} alt={weapon.name} className="h-6 w-12 object-contain" loading="lazy" />
                    ) : (
                      <span className="flex h-6 w-12 items-center justify-center text-[10px] font-bold text-muted-foreground">Todas</span>
                    )}
                    <span className={`text-[9px] font-medium leading-tight ${selectedWeapon === weapon.id ? "text-success" : "text-muted-foreground"}`}>{weapon.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Knife toggle */}
          <div className="mt-6">
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input type="checkbox" checked={onlyKnife} onChange={(e) => { setOnlyKnife(e.target.checked); setDisplayPage(1); }} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full border border-border bg-secondary transition-colors peer-checked:border-success peer-checked:bg-success" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 transition-all peer-checked:left-[18px] peer-checked:bg-success-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">🔪 Apenas com Knife</span>
            </label>
          </div>

          {/* Region */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Globe className="h-4 w-4 text-success" />
              Região
            </p>
            <select value={valRegion} onChange={(e) => { setValRegion(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground outline-none transition-colors focus:border-success/50 appearance-none cursor-pointer">
              {valorantRegions.map((region) => (
                <option key={region.id} value={region.id}>{region.label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* LoL filters */}
      {gameTab === "lol" && (
        <>
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-3">Elo / Rank</p>
            <div className="grid grid-cols-3 gap-2">
              {lolRankFilters.map((rank) => (
                <button key={rank.id} onClick={() => { setLolRank(rank.id); setDisplayPage(1); }}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-all ${lolRank === rank.id ? "border-[hsl(198,100%,45%)] bg-[hsl(198,100%,45%,0.1)]" : "border-border hover:border-foreground/30"}`}
                  title={rank.name}>
                  {rank.img ? (
                    <img src={rank.img} alt={rank.name} className="h-8 w-8 object-contain" loading="lazy" />
                  ) : (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--muted))" }}>
                      <span className="text-[9px] font-bold text-muted-foreground">?</span>
                    </div>
                  )}
                  <span className={`text-[10px] font-medium leading-tight ${lolRank === rank.id ? "text-[hsl(198,100%,45%)]" : "text-muted-foreground"}`}>{rank.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[hsl(198,100%,45%)]" />Mín. Campeões
            </p>
            <input type="number" min="0" placeholder="Ex: 50" value={lolChampMin} onChange={(e) => { setLolChampMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(198,100%,45%,0.5)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-[hsl(198,100%,45%)]" />Mín. Skins LoL
            </p>
            <input type="number" min="0" placeholder="Ex: 10" value={lolSkinsMin} onChange={(e) => { setLolSkinsMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(198,100%,45%,0.5)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[hsl(198,100%,45%)]" />Região
            </p>
            <select value={lolRegion} onChange={(e) => { setLolRegion(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground outline-none transition-colors focus:border-[hsl(198,100%,45%,0.5)] appearance-none cursor-pointer">
              {lolRegions.map((region) => (
                <option key={region.id} value={region.id}>{region.label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Fortnite filters */}
      {isFortnite && (
        <>
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: FN_BLUE }}>
                <circle cx="256" cy="256" r="256" fill={FN_BLUE} />
                <path d="M152 160 L256 352 L360 160" stroke="white" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M200 240 L256 352 L312 240" stroke="white" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              Mín. V-Bucks
            </p>
            <input type="number" min="0" placeholder="Ex: 1000" value={fnVbMin} onChange={(e) => { setFnVbMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${FN_PURPLE}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: FN_PURPLE }} />Mín. Skins
            </p>
            <input type="number" min="10" placeholder="Mín: 10" value={fnSkinsMin} onChange={(e) => { setFnSkinsMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${FN_PURPLE}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
            {fnSkinsMin && Number(fnSkinsMin) < 10 && (
              <p className="mt-1 text-[10px] text-muted-foreground">Mínimo aplicado: 10 skins</p>
            )}
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: FN_PURPLE }} />Mín. Nível
            </p>
            <input type="number" min="0" placeholder="Ex: 100" value={fnLevelMin} onChange={(e) => { setFnLevelMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${FN_PURPLE}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-5">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-3 transition-all"
              style={fnHasBattlePass ? { borderColor: FN_PURPLE, background: `${FN_PURPLE}10` } : {}}>
              <input type="checkbox" checked={fnHasBattlePass} onChange={(e) => { setFnHasBattlePass(e.target.checked); setDisplayPage(1); }} className="sr-only" />
              <div className="h-4 w-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-colors" style={{ borderColor: fnHasBattlePass ? FN_PURPLE : undefined, background: fnHasBattlePass ? FN_PURPLE : "transparent" }}>
                {fnHasBattlePass && <span className="text-[9px] font-bold text-white">✓</span>}
              </div>
              <div>
                <span className="text-xs font-semibold" style={{ color: fnHasBattlePass ? FN_PURPLE : undefined }}>Battle Pass Comprado</span>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Contas com passe de batalha pago</p>
              </div>
            </label>
          </div>
        </>
      )}

      {/* Minecraft filters */}
      {isMinecraft && (
        <>
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill={MC_GREEN}><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M6,6V10H10V12H8V18H10V16H14V18H16V12H14V10H18V6H14V10H10V6H6Z" /></svg>
              Edição
            </p>
            <div className="flex gap-2">
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 transition-all"
                style={mcJava ? { borderColor: MC_GREEN, background: `${MC_GREEN}10` } : {}}>
                <input type="checkbox" checked={mcJava} onChange={(e) => { setMcJava(e.target.checked); setDisplayPage(1); }} className="sr-only" />
                <div className="h-3.5 w-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: mcJava ? MC_GREEN : undefined, background: mcJava ? MC_GREEN : "transparent" }}>
                  {mcJava && <span className="text-[8px] font-bold text-white">✓</span>}
                </div>
                <span className="text-xs font-medium" style={{ color: mcJava ? MC_GREEN : undefined }}>Java</span>
              </label>
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 transition-all"
                style={mcBedrock ? { borderColor: MC_GREEN, background: `${MC_GREEN}10` } : {}}>
                <input type="checkbox" checked={mcBedrock} onChange={(e) => { setMcBedrock(e.target.checked); setDisplayPage(1); }} className="sr-only" />
                <div className="h-3.5 w-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: mcBedrock ? MC_GREEN : undefined, background: mcBedrock ? MC_GREEN : "transparent" }}>
                  {mcBedrock && <span className="text-[8px] font-bold text-white">✓</span>}
                </div>
                <span className="text-xs font-medium" style={{ color: mcBedrock ? MC_GREEN : undefined }}>Bedrock</span>
              </label>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4" style={{ color: MC_GREEN }} />Mín. Nível Hypixel
            </p>
            <input type="number" min="0" placeholder="Ex: 50" value={mcHypixelLvlMin} onChange={(e) => { setMcHypixelLvlMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${MC_GREEN}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: MC_GREEN }} />Mín. Capes
            </p>
            <input type="number" min="0" placeholder="Ex: 1" value={mcCapesMin} onChange={(e) => { setMcCapesMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${MC_GREEN}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input type="checkbox" checked={mcNoBan} onChange={(e) => { setMcNoBan(e.target.checked); setDisplayPage(1); }} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full border border-border bg-secondary transition-colors peer-checked:border-[hsl(120,60%,45%)] peer-checked:bg-[hsl(120,60%,45%)]" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 transition-all peer-checked:left-[18px] peer-checked:bg-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">🚫 Sem Ban Hypixel</span>
            </label>
          </div>
        </>
      )}

      {/* Price (shared) */}
      <div className="mt-8">
        <button onClick={() => setPriceOpen(!priceOpen)} className="flex w-full items-center justify-between text-sm font-semibold text-foreground">
          <span className="flex items-center gap-2"><DollarSign className="h-4 w-4" style={{ color: accentColor }} />Faixa de Preço</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${priceOpen ? "rotate-180" : ""}`} />
        </button>
        {priceOpen && (
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <input type="number" min="0" placeholder="Mín" value={priceMin} onChange={(e) => { setPriceMin(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <span className="text-xs text-muted-foreground">—</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <input type="number" min="0" placeholder="Máx" value={priceMax} onChange={(e) => { setPriceMax(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          </div>
        )}
      </div>

      {/* Inventory Value (Valorant only) */}
      {isValorant && (
        <div className="mt-6">
          <button onClick={() => setInvOpen(!invOpen)} className="flex w-full items-center justify-between text-sm font-semibold text-foreground">
            <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" style={{ color: accentColor }} />Valor do Inventário</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${invOpen ? "rotate-180" : ""}`} />
          </button>
          {invOpen && (
            <div className="mt-3 flex items-center gap-2">
              <input type="number" min="0" placeholder="Mín" value={invMin} onChange={(e) => { setInvMin(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="number" min="0" placeholder="Máx" value={invMax} onChange={(e) => { setInvMax(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          )}
        </div>
      )}

      {/* Level (Valorant and LoL only) */}
      {(isValorant || gameTab === "lol") && (
        <div className="mt-6">
          <button onClick={() => setLvlOpen(!lvlOpen)} className="flex w-full items-center justify-between text-sm font-semibold text-foreground">
            <span className="flex items-center gap-2"><Star className="h-4 w-4" style={{ color: accentColor }} />Nível da Conta</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${lvlOpen ? "rotate-180" : ""}`} />
          </button>
          {lvlOpen && (
            <div className="mt-3 flex items-center gap-2">
              <input type="number" min="0" placeholder="Mín" value={lvlMin} onChange={(e) => { setLvlMin(e.target.value.slice(0, 4)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="number" min="0" placeholder="Máx" value={lvlMax} onChange={(e) => { setLvlMax(e.target.value.slice(0, 4)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-3 min-[400px]:px-4 sm:px-6 pt-4 pb-20">

        {/* ─── Game Tab Switcher (segment control) ─── */}
        <nav
          className="mb-6 sm:mb-8 rounded-2xl border border-border/60 bg-card p-1 shadow-sm"
          aria-label="Categorias de contas"
        >
          <div className="grid grid-cols-2 gap-0.5 min-[400px]:gap-1 sm:flex sm:flex-wrap sm:justify-stretch sm:gap-1">
          <button
            type="button"
            onClick={() => switchTab("valorant")}
            className={`touch-manipulation flex min-h-11 min-w-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 min-[400px]:px-2 sm:flex-1 sm:px-3 py-2.5 sm:py-2.5 text-[11px] min-[400px]:text-xs sm:text-sm font-semibold tracking-tight transition-colors duration-200 ${
              isValorant
                ? "bg-success/15 text-success ring-2 ring-success/35 ring-offset-1 ring-offset-background sm:ring-offset-2"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
          >
            <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z"/></svg>
            <span className="leading-none">Valorant</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("lol")}
            className={`touch-manipulation flex min-h-11 min-w-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 min-[400px]:px-2 sm:flex-1 sm:px-3 py-2.5 sm:py-2.5 text-[11px] min-[400px]:text-xs sm:text-sm font-semibold tracking-tight transition-colors duration-200 ${
              gameTab === "lol"
                ? "bg-[hsl(198,100%,45%,0.12)] text-[hsl(198,100%,48%)] ring-2 ring-[hsl(198,100%,45%,0.35)] ring-offset-1 ring-offset-background sm:ring-offset-2"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
          >
            <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m1.912 0 1.212 2.474v19.053L1.912 24h14.73l1.337-4.682H8.33V0ZM12 1.516c-.913 0-1.798.112-2.648.312v1.74a9.738 9.738 0 0 1 2.648-.368c5.267 0 9.536 4.184 9.536 9.348a9.203 9.203 0 0 1-2.3 6.086l-.273.954-.602 2.112c2.952-1.993 4.89-5.335 4.89-9.122C23.25 6.468 18.213 1.516 12 1.516Zm0 2.673c-.924 0-1.814.148-2.648.414v13.713h8.817a8.246 8.246 0 0 0 2.36-5.768c0-4.617-3.818-8.359-8.529-8.359zM2.104 7.312A10.858 10.858 0 0 0 .75 12.576c0 1.906.492 3.7 1.355 5.266z"/></svg>
            <span className="leading-none sm:hidden" title="League of Legends">LoL</span>
            <span className="leading-none hidden sm:inline">League of Legends</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("fortnite")}
            className={`touch-manipulation flex min-h-11 min-w-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 min-[400px]:px-2 sm:flex-1 sm:px-3 py-2.5 sm:py-2.5 text-[11px] min-[400px]:text-xs sm:text-sm font-semibold tracking-tight transition-colors duration-200 ${
              isFortnite
                ? "bg-[hsl(265,80%,65%,0.12)] text-[hsl(265,80%,65%)] ring-2 ring-[hsl(265,80%,65%,0.45)] ring-offset-1 ring-offset-background sm:ring-offset-2"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
          >
            <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m15.767 14.171.097-5.05H12.4V5.197h3.99L16.872 0H7.128v24l5.271-.985V14.17z"/></svg>
            <span className="leading-none">Fortnite</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("minecraft")}
            className={`touch-manipulation flex min-h-11 min-w-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 min-[400px]:px-2 sm:flex-1 sm:px-3 py-2.5 sm:py-2.5 text-[11px] min-[400px]:text-xs sm:text-sm font-semibold tracking-tight transition-colors duration-200 ${
              isMinecraft
                ? "ring-2 ring-offset-1 ring-offset-background sm:ring-offset-2"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
            style={
              isMinecraft
                ? { background: `${MC_GREEN}18`, color: MC_GREEN, boxShadow: `0 0 0 2px ${MC_GREEN}66` }
                : {}
            }
          >
            <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 opacity-90" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M6,6V10H10V12H8V18H10V16H14V18H16V12H14V10H18V6H14V10H10V6H6Z" /></svg>
            <span className="leading-none">Minecraft</span>
          </button>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Marketplace ·{" "}
              <span style={{ color: accentColor }}>
                {isValorant ? "Valorant" : isFortnite ? "Fortnite" : isMinecraft ? "Minecraft" : "League of Legends"}
              </span>
            </p>
            <h1
              className={`mt-1.5 text-xl min-[400px]:text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl ${isValorant ? "" : "font-sans"}`}
              style={isValorant ? { fontFamily: "'Valorant', sans-serif" } : undefined}
            >
              {isValorant
                ? "Contas Valorant"
                : isFortnite
                  ? "Contas Fortnite"
                  : isMinecraft
                    ? "Contas Minecraft"
                    : "Contas League of Legends"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {streamError ? "Não foi possível carregar a lista. Tente atualizar." : isLoading ? "Buscando contas disponíveis…" : `${allItems.length} ${allItems.length === 1 ? "conta listada" : "contas listadas"} · página ${displayPage} de ${totalDisplayPages}`}
            </p>
            <p className="mt-2.5 inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-border/50 bg-secondary/30 px-2.5 py-1 text-[10px] min-[400px]:text-[11px] text-muted-foreground sm:px-3">
              Procurando softwares?{" "}
              <Link to="/produtos" className="font-medium underline-offset-2 hover:underline" style={{ color: accentColor }}>Ver Produtos →</Link>
            </p>
          </div>
          <div
            className="flex min-h-[44px] w-full min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-hide pb-1 [-webkit-overflow-scrolling:touch] sm:min-h-0 sm:w-auto sm:gap-2 sm:pb-0.5 snap-x snap-mandatory px-0.5 sm:px-0"
            role="group"
            aria-label="Ordenar e atualizar lista"
          >
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-11 w-11 shrink-0 snap-start items-center justify-center rounded border border-border text-muted-foreground transition-colors sm:h-9 sm:w-9 touch-manipulation"
              style={{ "--hover-color": accentColor } as CSSProperties}
              onMouseEnter={(e) => setLinkAccentHover(e, accentColor)}
              onMouseLeave={clearLinkAccentHover}
              title="Atualizar lista (busca de novo na API)"
              aria-label="Atualizar lista de contas"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {sortOptions.map((opt) => (
              <button
                type="button"
                key={opt.value}
                title={opt.title}
                aria-pressed={sortBy === opt.value}
                onClick={() => { setSortBy(opt.value); setDisplayPage(1); }}
                className={`min-h-11 shrink-0 snap-start touch-manipulation whitespace-nowrap rounded border px-2.5 py-2 text-[11px] font-medium transition-colors sm:min-h-0 sm:px-4 sm:py-2 sm:text-xs ${
                  sortBy === opt.value ? accentClass : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                <span className="sm:hidden">{opt.shortLabel}</span>
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          {/* ─── Mobile Filter Button ─── */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex min-h-12 lg:hidden items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all active:scale-[0.98] touch-manipulation"
            style={{ borderColor: activeFiltersCount > 0 ? `${accentColor}60` : undefined }}
          >
            <SlidersHorizontal className="h-4 w-4" style={{ color: accentColor }} />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: accentColor }}>{activeFiltersCount}</span>
            )}
          </button>

          {/* ─── Mobile Filter Bottom Sheet ─── */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" style={{ touchAction: 'none' }}>
              <div className="absolute inset-0 bg-black/70" onClick={() => setMobileFiltersOpen(false)} />
              <div
                className="absolute bottom-0 left-0 right-0 max-h-[min(85dvh,85vh)] overflow-y-auto overscroll-y-contain rounded-t-2xl bg-card border-t border-border animate-in slide-in-from-bottom duration-300"
                style={{ touchAction: "auto" }}
              >
                <div className="flex justify-center pt-2 pb-1" aria-hidden>
                  <span className="h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
                </div>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-4 min-[400px]:px-5 py-3 min-[400px]:py-4 rounded-t-2xl">
                  <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <SlidersHorizontal className="h-4 w-4" style={{ color: accentColor }} />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: accentColor }}>{activeFiltersCount}</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { clearFilters(); }} className="text-xs text-muted-foreground transition-colors" onMouseEnter={e => (e.currentTarget.style.color = accentColor)} onMouseLeave={e => (e.currentTarget.style.color = '')}>Limpar</button>
                    <button onClick={() => setMobileFiltersOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="p-4 min-[400px]:p-5">
                  {renderFilterContent()}
                </div>
                <div className="sticky bottom-0 border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="min-h-12 w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] touch-manipulation"
                    style={{ background: accentColor }}
                  >
                    Ver resultados
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Desktop Sidebar ─── */}
          <aside className="hidden shrink-0 lg:block lg:w-72">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto space-y-4 scrollbar-hide">
              <div className="rounded-lg border bg-card p-5 transition-colors duration-300" style={{ borderColor: isValorant ? 'hsl(var(--border))' : `${accentColor}25` }}>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <SlidersHorizontal className="h-4 w-4" style={{ color: accentColor }} />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: accentColor }}>{activeFiltersCount}</span>
                    )}
                  </h3>
                  <button onClick={clearFilters} className="text-xs text-muted-foreground transition-colors" style={{}} onMouseEnter={e => (e.currentTarget.style.color = accentColor)} onMouseLeave={e => (e.currentTarget.style.color = '')}>Limpar</button>
                </div>
                {renderFilterContent()}
              </div>
            </div>
          </aside>

          {/* ─── Grid ─── */}
          <div className="flex-1">
            {isLoading && (
              <div className="grid w-full grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-border/30 bg-card overflow-hidden">
                    <div className="h-28 sm:h-36 bg-secondary/20" />
                    <div className="p-2.5 sm:p-3 space-y-2">
                      <div className="h-2.5 w-3/4 rounded bg-secondary/30" />
                      <div className="h-2.5 w-1/2 rounded bg-secondary/30" />
                      <div className="mt-3 h-5 w-20 rounded bg-secondary/30" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {streamError && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                <AlertTriangle className="h-10 w-10 text-warning" />
                <p className="text-lg font-semibold text-foreground">
                  {streamError.message?.includes("instável") || streamError.message?.includes("503")
                    ? "Serviço em manutenção"
                    : "Ops! Algo deu errado"}
                </p>
                <p className="mt-1 text-sm text-center max-w-md">{streamError.message}</p>
                <button
                  onClick={() => refetch()}
                  className="mt-4 rounded border border-border px-4 py-2 text-xs font-medium transition-colors"
                  onMouseEnter={(e) => setLinkAccentHover(e, accentColor)}
                  onMouseLeave={clearLinkAccentHover}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!isLoading && !streamError && (
              <>
                {isRefetching && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-4 py-2.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: accentColor }} />
                    Atualizando contas…
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3 relative">
                  {gridRows.map(({ item, priceLabel }) => (
                    <div
                      key={item.item_id}
                      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 320px' } as CSSProperties}
                    >
                      {isValorant ? (
                        <ValorantCard item={item} skinsMap={skinsMap} priceLabel={priceLabel} queryClient={queryClient} />
                      ) : isFortnite ? (
                        <FortniteCard item={item} skinsDb={fnSkinsDb} priceLabel={priceLabel} queryClient={queryClient} />
                      ) : isMinecraft ? (
                        <MinecraftCard item={item} priceLabel={priceLabel} queryClient={queryClient} />
                      ) : (
                        <LolCard item={item} champKeyMap={champKeyMap} priceLabel={priceLabel} queryClient={queryClient} />
                      )}
                    </div>
                  ))}
                </div>

                {items.length === 0 && allItems.length === 0 && streamingDone && (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <p className="text-lg font-semibold">Nenhuma conta encontrada</p>
                    <p className="mt-1 text-sm">Tente alterar os filtros</p>
                  </div>
                )}

                {/* Pagination */}
                {totalDisplayPages > 1 && streamingDone && (
                  <div className="mt-8 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setDisplayPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={displayPage <= 1}
                        className="flex h-9 w-9 items-center justify-center rounded border border-border text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        onMouseEnter={(e) => setLinkAccentHover(e, accentColor)}
                        onMouseLeave={clearLinkAccentHover}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: totalDisplayPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalDisplayPages || Math.abs(p - displayPage) <= 2)
                        .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                          const prev = i > 0 ? arr[i - 1] : undefined;
                          if (i > 0 && typeof prev === "number" && p - prev > 1) acc.push("ellipsis");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === 'ellipsis' ? (
                            <span key={`e${i}`} className="flex h-9 w-9 items-center justify-center text-xs text-muted-foreground">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => {
                                if (typeof p === "number") {
                                  setDisplayPage(p);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded border text-xs font-medium transition-colors"
                              style={displayPage === p ? { borderColor: accentColor, background: `${accentColor}15`, color: accentColor } : {}}
                              onMouseEnter={(e) => {
                                if (displayPage !== p) setLinkAccentHover(e, accentColor);
                              }}
                              onMouseLeave={(e) => {
                                if (displayPage !== p) clearLinkAccentHover(e);
                              }}
                            >
                              {p}
                            </button>
                          )
                        )}
                      <button
                        onClick={() => { setDisplayPage(p => Math.min(totalDisplayPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={displayPage >= totalDisplayPages}
                        className="flex h-9 w-9 items-center justify-center rounded border border-border text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        onMouseEnter={(e) => setLinkAccentHover(e, accentColor)}
                        onMouseLeave={clearLinkAccentHover}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Página {displayPage} de {totalDisplayPages} · {allItems.length} contas
                    </span>

                    {hasNextPage && (
                      <button
                        onClick={loadMorePages}
                        disabled={loadingMore || !!streamError}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2 text-xs font-medium text-muted-foreground transition-colors disabled:opacity-50"
                        onMouseEnter={(e) => setLinkAccentHover(e, accentColor)}
                        onMouseLeave={clearLinkAccentHover}
                      >
                        {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {loadingMore ? "Carregando..." : "Buscar mais contas"}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contas;
