import { useState, useCallback, useEffect, useRef, useMemo, memo, type CSSProperties } from "react";
import { useLztMarkup, getLztItemBrlPrice, type GameCategory } from "@/hooks/useLztMarkup";
import Header from "@/components/Header";
import { ChevronLeft, ChevronRight, ChevronDown, Search, SlidersHorizontal, DollarSign, Crosshair, Loader2, RefreshCw, Globe, TrendingUp, Star, Shield, Trophy, AlertTriangle, X, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { throwApiError } from "@/lib/apiErrors";
import { translateRegion } from "@/lib/regionTranslation";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import type {
  DDragonChampionJson,
  DDragonVersionList,
  FortniteCosmeticItem,
  FortniteCosmeticsResponse,
} from "@/lib/edgeFunctionTypes";

import lolRankFerroImg from "@/assets/lol-rank-ferro.png";
import lolRankBronzeImg from "@/assets/lol-rank-bronze.webp";
import lolRankPrataImg from "@/assets/lol-rank-prata.png";
import lolRankOuroImg from "@/assets/lol-rank-ouro.png";
import lolRankPlatinaImg from "@/assets/lol-rank-platina.png";
import lolRankEsmeraldaImg from "@/assets/lol-rank-esmeralda.png";
import lolRankDiamanteImg from "@/assets/lol-rank-diamante.webp";
import lolRankMestreImg from "@/assets/lol-rank-mestre.png";

import {
  rankFerro, rankBronze, rankPrata, rankOuro, rankPlatina,
  rankDiamante, rankAscendente, rankImortal, rankRadianteNew as rankRadiante,
  rankUnranked, rankMap, fetchAllValorantSkins,
  type SkinEntry,
} from "@/lib/valorantData";
import { getListingCardTitle } from "@/lib/lztDisplayTitles";
import {
  hideImgOnError,
  setBorderAndBoxShadow,
  clearBorderAndBoxShadow,
  setLinkAccentHover,
  clearLinkAccentHover,
} from "@/lib/domEventHelpers";
import { errorName } from "@/lib/errorMessage";
import { isRecord } from "@/types/ticketChat";
import { prefetchAccountDetail } from "@/lib/lztPrefetch";

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

const sortOptions = [
  { label: "Mais Recentes", value: "pdate_to_down" },
  { label: "Menor Preço", value: "price_to_up" },
  { label: "Maior Preço", value: "price_to_down" },
] as const;

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
  fortniteSkins?: Array<{ id: string; title?: string }>;
  fortnitePickaxe?: Array<{ id: string; title?: string }>;
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
const fetchFortniteSkins = async (): Promise<Map<string, { name: string; image: string }>> => {
  try {
    const data = await safeJsonFetch<FortniteCosmeticsResponse>("https://fortnite-api.com/v2/cosmetics/br?language=pt-BR");
    const map = new Map<string, { name: string; image: string }>();
    const raw = data.data;
    const list: FortniteCosmeticItem[] = Array.isArray(raw) ? raw : raw?.items ?? [];
    for (const item of list) {
      const image = item.images?.smallIcon || item.images?.icon;
      if (image && item.id) {
        map.set(item.id.toLowerCase(), { name: item.name || item.id, image });
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
      <img
        src={getProxiedImageUrl(url)}
        alt="Skins preview"
        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
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
    return (premium.length >= 4 ? premium : results.filter(s => s.rarity > 0).length >= 4 ? results.filter(s => s.rarity > 0) : results).slice(0, 6);
  }, [inventoryUuids, skinsMap, skinsMapReady]);

  return (
    <Link
      to={`/conta/${item.item_id}`}
      onPointerEnter={() => prefetchAccountDetail(queryClient, "valorant", item.item_id)}
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-success/50 hover:shadow-[0_4px_24px_hsl(var(--success)/0.12)] flex flex-col h-full no-underline text-inherit"
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--success)/0.06),transparent_70%)]" />
        {skinPreviews.length === 1 ? (
          <div className="relative z-[1] w-full h-full flex items-center justify-center bg-secondary/30">
            <img src={getProxiedImageUrl(skinPreviews[0].image)} alt={skinPreviews[0].name} className="w-full h-full object-contain" loading="lazy" />
          </div>
        ) : skinPreviews.length === 2 ? (
          <div className="relative z-[1] grid grid-cols-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length === 3 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.slice(0, 2).map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
            ))}
            <div className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5 col-span-2">
              <img src={getProxiedImageUrl(skinPreviews[2].image)} alt={skinPreviews[2].name} className="w-full h-full object-contain" loading="lazy" />
            </div>
          </div>
        ) : skinPreviews.length === 4 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        ) : hasInventoryData && !skinsMapReady ? (
          /* Skeleton while Valorant API loads — avoids flashing the raw LZT screenshot */
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-full h-full rounded bg-secondary/50 animate-pulse" />
            ))}
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
          <p className="text-sm sm:text-base font-bold text-success tracking-tight">{priceLabel}</p>
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
const LolCard = memo(({ item, champKeyMap, priceLabel }: { item: LztItem; champKeyMap: Map<number, string>; priceLabel: string }) => {
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
          image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champName}_${skinNum}.jpg`,
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
            image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champName}_0.jpg`,
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
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-[hsl(198,100%,45%)/50%] hover:shadow-[0_4px_24px_hsl(198,100%,45%,0.12)] flex flex-col h-full no-underline text-inherit"
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(198,100%,45%,0.08),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[hsl(var(--card))] to-transparent z-[2]" />
        {skinPreviews.length === 1 ? (
          <div className="relative z-[1] w-full h-full">
            <img src={getProxiedImageUrl(skinPreviews[0].image)} alt={skinPreviews[0].name} className="h-full w-full object-cover object-top" loading="lazy" />
          </div>
        ) : skinPreviews.length === 2 ? (
          <div className="relative z-[1] grid grid-cols-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-cover object-top" loading="lazy" />
                {i > 0 && <div className="absolute inset-y-0 left-0 w-px bg-black/20" />}
              </div>
            ))}
          </div>
        ) : skinPreviews.length <= 4 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-cover object-top" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-cover object-top" loading="lazy" />
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
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: "hsl(198,100%,45%,0.1)", border: "1px solid hsl(198,100%,45%,0.2)" }}>
          <svg className="h-3 w-3 flex-shrink-0" style={{ color: "hsl(198,100%,45%)" }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <span className="text-[9px] sm:text-[11px] font-semibold" style={{ color: "hsl(198,100%,45%)" }}>Full Acesso · Entrega Automática</span>
        </div>
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <h3 className="text-[11px] sm:text-xs font-semibold text-foreground line-clamp-2 text-balance leading-snug tracking-tight mb-1">{cleanedTitle}</h3>
          <p className="text-sm sm:text-base font-bold text-[hsl(198,100%,45%)] tracking-tight">{priceLabel}</p>
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
const FortniteCard = memo(({ item, skinsDb, priceLabel }: { item: LztItem; skinsDb: Map<string, { name: string; image: string }>; priceLabel: string }) => {
  const vbucks = item.fortnite_balance ?? item.fortnite_vbucks ?? 0;
  const skinCount = item.fortnite_skin_count ?? 0;
  const level = item.fortnite_level ?? 0;

  const cleanedTitle = getListingCardTitle(item, "fortnite");

  // fortniteSkins is an array of { id, title, rarity } from LZT API
  const skinPreviews = useMemo(() => {
    const fortniteSkins: Array<{ id: string; title?: string }> = Array.isArray(item.fortniteSkins) ? item.fortniteSkins : [];
    const results: { name: string; image: string }[] = [];
    for (const s of fortniteSkins) {
      const found = skinsDb.get(String(s.id).toLowerCase());
      if (found) {
        results.push(found);
      } else {
        // Fallback: direct URL from fortnite-api.com using the cosmetic id
        results.push({
          name: s.title || s.id,
          image: `https://fortnite-api.com/images/cosmetics/br/${String(s.id).toLowerCase()}/smallicon.png`,
        });
      }
      if (results.length >= 6) break;
    }
    // If no skins, try pickaxes
    if (results.length === 0) {
      const pickaxes: Array<{ id: string; title?: string }> = Array.isArray(item.fortnitePickaxe) ? item.fortnitePickaxe : [];
      for (const p of pickaxes) {
        if (p.id === "defaultpickaxe") continue;
        const found = skinsDb.get(String(p.id).toLowerCase());
        if (found) {
          results.push(found);
        } else {
          results.push({
            name: p.title || p.id,
            image: `https://fortnite-api.com/images/cosmetics/br/${String(p.id).toLowerCase()}/smallicon.png`,
          });
        }
        if (results.length >= 6) break;
      }
    }
    return results;
  }, [item.fortniteSkins, item.fortnitePickaxe, skinsDb]);

  return (
    <Link
      to={`/fortnite/${item.item_id}`}
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-[hsl(265,80%,65%)/50%] hover:shadow-[0_4px_24px_hsl(265,80%,65%,0.12)] flex flex-col h-full no-underline text-inherit"
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(265,80%,65%,0.08),transparent_70%)]" />
        {skinPreviews.length === 1 ? (
          <div className="relative z-[1] w-full h-full flex items-center justify-center bg-secondary/20">
            <img src={getProxiedImageUrl(skinPreviews[0].image)} alt={skinPreviews[0].name} className="w-full h-full object-contain" loading="lazy" />
          </div>
        ) : skinPreviews.length === 2 ? (
          <div className="relative z-[1] grid grid-cols-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length === 3 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.slice(0, 2).map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
              </div>
            ))}
            <div className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5 col-span-2">
              <img src={getProxiedImageUrl(skinPreviews[2].image)} alt={skinPreviews[2].name} className="w-full h-full object-contain drop-shadow-sm" loading="lazy" />
            </div>
          </div>
        ) : skinPreviews.length === 4 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <img src={getProxiedImageUrl(skin.image)} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
              </div>
            ))}
          </div>
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
          <p className="text-sm sm:text-base font-bold tracking-tight" style={{ color: FN_PURPLE }}>{priceLabel}</p>
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
const MinecraftCard = memo(({ item, priceLabel }: { item: LztItem; priceLabel: string }) => {
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
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all flex flex-col h-full no-underline text-inherit"
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
          <p className="text-sm sm:text-base font-bold tracking-tight" style={{ color: MC_GREEN }}>{priceLabel}</p>
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
      headers: { apikey: supabaseAnonKey },
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

  // ─── Valorant filters ───
  const [selectedRank, setSelectedRank] = useState("todos");
  const [selectedWeapon, setSelectedWeapon] = useState("todos");
  const [onlyKnife, setOnlyKnife] = useState(false);
  const [valRegion, setValRegion] = useState("br");

  // ─── LoL filters ───
  const [lolRank, setLolRank] = useState("todos");
  const [lolChampMin, setLolChampMin] = useState("");
  const [lolSkinsMin, setLolSkinsMin] = useState("");
  const [lolRegion, setLolRegion] = useState("BR1");

  // ─── Fortnite filters ───
  const [fnVbMin, setFnVbMin] = useState("");
  const [fnSkinsMin, setFnSkinsMin] = useState("");

  // ─── Minecraft filters ───
  const [mcJava, setMcJava] = useState(false);
  const [mcBedrock, setMcBedrock] = useState(false);
  const [mcHypixelLvlMin, setMcHypixelLvlMin] = useState("");
  const [mcCapesMin, setMcCapesMin] = useState("");
  const [mcNoBan, setMcNoBan] = useState(false);

  // ─── Shared filters ───
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState<string>("pdate_to_down");
  const [searchQuery, setSearchQuery] = useState("");
  const [lvlMin, setLvlMin] = useState("");
  const [lvlMax, setLvlMax] = useState("");
  const [invMin, setInvMin] = useState("");
  const [invMax, setInvMax] = useState("");
  // page state removed — displayPage handles client-side pagination
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
  const prevGameTabRef = useRef(gameTab);
  
  const isValorant = gameTab === "valorant";
  const isLol = gameTab === "lol";
  const isFortnite = gameTab === "fortnite";
  const isMinecraft = gameTab === "minecraft";
  
  // ─── Persistent Cache (Session Storage) ───
  // Use session storage so when users navigate away and back, it's instant.
  type CacheEntry = { items: LztItem[]; hasNextPage: boolean; currentPage: number; timestamp: number };

  const readLztCacheFromSession = (): Map<string, CacheEntry> => {
    if (typeof window === "undefined") return new Map();
    try {
      const stored = sessionStorage.getItem("royal_lzt_cache");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return new Map();
        const tuples = parsed.filter(
          (row): row is [string, CacheEntry] =>
            Array.isArray(row) &&
            row.length >= 2 &&
            typeof row[0] === "string" &&
            row[1] !== null &&
            typeof row[1] === "object",
        );
        return new Map(tuples);
      }
    } catch { /* silent */ }
    return new Map();
  };

  const fetchCacheRef = useRef(readLztCacheFromSession());
  const MAX_CACHE_ENTRIES = 20;
  const persistSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushCacheToSession = useCallback(() => {
    try {
      sessionStorage.setItem("royal_lzt_cache", JSON.stringify(Array.from(fetchCacheRef.current.entries())));
    } catch { /* silent */ }
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
      }, 450);
    },
    [flushCacheToSession],
  );
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

  const { data: fnSkinsDb = new Map<string, { name: string; image: string }>() } = useQuery({
    queryKey: ["fortnite-cosmetics"],
    queryFn: fetchFortniteSkins,
    staleTime: 1000 * 60 * 60 * 6,
    enabled: gameTab === "fortnite",
  });

  const buildParams = useCallback((pageNum: number = currentPage): Record<string, string | string[]> => {
    const params: Record<string, string | string[]> = {};
    params.page = String(pageNum);
    // Send user's chosen sort to API (validated enum values from LZT API)
    params.order_by = sortBy || "pdate_to_down";
    if (searchQuery) params.title = searchQuery;

    // Send price filters to API so server filters before returning
    if (priceMin && Number(priceMin) > 0) params.pmin = priceMin;
    if (priceMax && Number(priceMax) > 0) params.pmax = priceMax;

    if (gameTab === "valorant") {
      params.game_type = "riot";
      if (invMin) params.inv_min = invMin;
      if (invMax) params.inv_max = invMax;
      if (onlyKnife) params.knife = "true";
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
        params.title = searchQuery ? `${searchQuery} ${selectedWeapon}` : selectedWeapon;
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
      // Fortnite-specific
      params.game_type = "fortnite";
      if (fnVbMin) params.vbmin = fnVbMin;
      // Always enforce minimum 10 skins server-side, even if user leaves field empty
      const effectiveSmin = fnSkinsMin && Number(fnSkinsMin) > 10 ? fnSkinsMin : "10";
      params.smin = effectiveSmin;
    }

    return params;
  }, [currentPage, searchQuery, onlyKnife, selectedRank, selectedWeapon, invMin, invMax, lvlMin, lvlMax, gameTab, lolRank, lolChampMin, lolSkinsMin, fnVbMin, fnSkinsMin, mcJava, mcBedrock, mcHypixelLvlMin, mcCapesMin, mcNoBan, lolRegion, valRegion, sortBy, priceMin, priceMax]);

  const paramsKey = JSON.stringify(buildParams(1)) + gameTab;
  // Só o campo "busca por título" usa debounce. Preço, inv, nível, mínimos etc. disparam fetch na hora (mais fluido).
  const nonSearchParamsKey = useMemo(
    () =>
      JSON.stringify({
        gameTab,
        sortBy,
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
        invMin,
        invMax,
        lvlMin,
        lvlMax,
        fnVbMin,
        fnSkinsMin,
      }),
    [
      gameTab,
      sortBy,
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
      invMin,
      invMax,
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
    if (prevNonSearchRef.current !== nonSearchParamsKey) {
      prevNonSearchRef.current = nonSearchParamsKey;
      setDebouncedParamsKey(paramsKey);
      prevSearchTrimRef.current = searchQuery.trim();
      return;
    }
    const clearedSearch = prevSearchTrimRef.current !== "" && searchQuery.trim() === "";
    prevSearchTrimRef.current = searchQuery.trim();
    if (clearedSearch) {
      setDebouncedParamsKey(paramsKey);
      return;
    }
    const delay = 280;
    const handler = setTimeout(() => setDebouncedParamsKey(paramsKey), delay);
    return () => clearTimeout(handler);
  }, [paramsKey, nonSearchParamsKey, searchQuery]);

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
    const tabChanged = prevGameTabRef.current !== gameTab;

    // Show stale cache immediately (even if expired) while fetching fresh data
    if (cached) {
      setStreamedItems(cached.items);
      setStreamingDone(true);
      setStreamError(null);
      setCurrentPage(cached.currentPage);
      setLoadingMore(false);
      setDisplayPage(1);
      setFirstPageLoaded(true);
      setHasNextPage(cached.hasNextPage);

      // If cache is fresh (5 min), don't refetch
      if (Date.now() - cached.timestamp < 300000) {
        prevGameTabRef.current = gameTab;
        return;
      }
    }

    try {
      if (!cached) {
        // Don't clear items on tab switch — show a loading overlay instead
        // so the page remains interactive while the API responds
        setIsRefetching(true);
        setStreamingDone(false);
        setStreamError(null);
        setCurrentPage(1);
        setLoadingMore(false);
        setDisplayPage(1);
        if (streamedItems.length === 0) {
          // Only show skeleton if we truly have nothing to display
          setFirstPageLoaded(false);
        }
      } else {
        // Cache expirado: manter itens antigos e indicar refetch
        setIsRefetching(true);
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

      const delayMs = delayMultiplier * 400;
      const timeoutId = setTimeout(() => {
        if (runId !== prefetchRunIdRef.current) return;
        void (async () => {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/lzt-market?${qp.toString()}`, {
              headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
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
    if (!cached && prefetched && Date.now() - prefetched.timestamp < 300000) {
      setStreamedItems(prefetched.items);
      setStreamingDone(true);
      setStreamError(null);
      setCurrentPage(prefetched.currentPage);
      setLoadingMore(false);
      setDisplayPage(1);
      setFirstPageLoaded(true);
      setHasNextPage(prefetched.hasNextPage);
      prevGameTabRef.current = gameTab;
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
        } catch {
          /* silent */
        }
      })();
      return;
    }

    // Fallback to original logic
    await fetchMultiplePages(controller);
  }, [buildParams, debouncedParamsKey, fetchMultiplePages, fetchWithRetry, gameTab, cacheSet]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchMultiplePagesWithPrefetch(controller);
    return () => controller.abort();
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
    const controller = new AbortController();
    try {
      const cacheKey = debouncedParamsKey;
      const nextPageNum = currentPage + 1;
      const data = await fetchWithRetry(buildParams(nextPageNum), controller);
      if (controller.signal.aborted) return;
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
      if (!controller.signal.aborted) {
        setStreamError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
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

    // Region filter is now done server-side via country[] API param

    // Post-filter by BRL price range
    const brlMin = priceMin ? Number(priceMin) : 0;
    const brlMax = priceMax ? Number(priceMax) : 0;
    if (brlMin > 0 || brlMax > 0) {
      filtered = filtered.filter(item => {
        const p = getBrlPrice(item);
        if (brlMin > 0 && p < brlMin) return false;
        if (brlMax > 0 && p > brlMax) return false;
        return true;
      });
    }

    // If user explicitly chose a price sort, use BRL display price for accurate ordering
    if (sortBy === "price_to_up") {
      return filtered.sort((a, b) => getBrlPrice(a) - getBrlPrice(b));
    }
    if (sortBy === "price_to_down") {
      return filtered.sort((a, b) => getBrlPrice(b) - getBrlPrice(a));
    }

    // Default sort (pdate_to_down): apply game-specific "best quality" sorting
    if (gameTab === "lol") {
      return filtered.sort((a, b) => {
        const scoreA = (a.riot_lol_level ?? 0) > 0 && (a.riot_lol_skin_count ?? 0) > 0 ? 2
          : (a.riot_lol_level ?? 0) > 0 || (a.riot_lol_skin_count ?? 0) > 0 ? 1 : 0;
        const scoreB = (b.riot_lol_level ?? 0) > 0 && (b.riot_lol_skin_count ?? 0) > 0 ? 2
          : (b.riot_lol_level ?? 0) > 0 || (b.riot_lol_skin_count ?? 0) > 0 ? 1 : 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return ((b.riot_lol_skin_count ?? 0) - (a.riot_lol_skin_count ?? 0)) || ((b.riot_lol_level ?? 0) - (a.riot_lol_level ?? 0));
      });
    }
    if (gameTab === "fortnite") {
      return filtered.sort((a, b) => {
        const skinsA = a.fortnite_skin_count ?? 0;
        const skinsB = b.fortnite_skin_count ?? 0;
        const hasSkinA = skinsA > 0;
        const hasSkinB = skinsB > 0;
        if (hasSkinA && !hasSkinB) return -1;
        if (!hasSkinA && hasSkinB) return 1;
        if (!hasSkinA && !hasSkinB) return getBrlPrice(a) - getBrlPrice(b);
        const valueA = skinsA / (getBrlPrice(a) || 1);
        const valueB = skinsB / (getBrlPrice(b) || 1);
        if (Math.abs(valueB - valueA) > 0.0001) return valueB - valueA;
        return getBrlPrice(a) - getBrlPrice(b);
      });
    }
    if (gameTab === "minecraft") {
      return filtered.sort((a, b) => getBrlPrice(a) - getBrlPrice(b));
    }
    return filtered;
  }, [streamedItems, sortBy, gameTab, priceMin, priceMax, getBrlPrice]);
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
    setLvlMin(""); setLvlMax("");
    // page state removed
    setDisplayPage(1);
  };

  const switchTab = (tab: GameTab) => {
    if (tab === gameTab) return;
    setGameTab(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "valorant") next.delete("game");
        else next.set("game", tab);
        return next;
      },
      { replace: false },
    );
    clearFilters();
    setSortBy("pdate_to_down");
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
    isMinecraft && mcJava,
    isMinecraft && mcBedrock,
    isMinecraft && mcHypixelLvlMin !== "",
    isMinecraft && mcCapesMin !== "",
    isMinecraft && mcNoBan,
    priceMin !== "", priceMax !== "",
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
            <input type="number" placeholder="Ex: 50" value={lolChampMin} onChange={(e) => { setLolChampMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(198,100%,45%,0.5)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-[hsl(198,100%,45%)]" />Mín. Skins LoL
            </p>
            <input type="number" placeholder="Ex: 10" value={lolSkinsMin} onChange={(e) => { setLolSkinsMin(e.target.value); setDisplayPage(1); }}
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
            <input type="number" placeholder="Ex: 1000" value={fnVbMin} onChange={(e) => { setFnVbMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${FN_PURPLE}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: FN_PURPLE }} />Mín. Skins
            </p>
            <input type="number" placeholder="Ex: 10" value={fnSkinsMin} onChange={(e) => { setFnSkinsMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${FN_PURPLE}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
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
            <input type="number" placeholder="Ex: 50" value={mcHypixelLvlMin} onChange={(e) => { setMcHypixelLvlMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${MC_GREEN}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: MC_GREEN }} />Mín. Capes
            </p>
            <input type="number" placeholder="Ex: 1" value={mcCapesMin} onChange={(e) => { setMcCapesMin(e.target.value); setDisplayPage(1); }}
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
              <input type="number" placeholder="Mín" value={priceMin} onChange={(e) => { setPriceMin(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <span className="text-xs text-muted-foreground">—</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <input type="number" placeholder="Máx" value={priceMax} onChange={(e) => { setPriceMax(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
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
              <input type="number" placeholder="Mín" value={invMin} onChange={(e) => { setInvMin(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="number" placeholder="Máx" value={invMax} onChange={(e) => { setInvMax(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
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
              <input type="number" placeholder="Mín" value={lvlMin} onChange={(e) => { setLvlMin(e.target.value.slice(0, 4)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="number" placeholder="Máx" value={lvlMax} onChange={(e) => { setLvlMax(e.target.value.slice(0, 4)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-20">

        {/* ─── Game Tab Switcher (segment control) ─── */}
        <nav
          className="mb-6 sm:mb-8 rounded-2xl border border-border/60 bg-card/30 p-1 shadow-sm backdrop-blur-sm"
          aria-label="Categorias de contas"
        >
          <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:justify-stretch sm:gap-1">
          <button
            type="button"
            onClick={() => switchTab("valorant")}
            className={`touch-manipulation flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:flex-1 sm:px-3 py-2.5 sm:py-2.5 text-xs sm:text-sm font-semibold tracking-tight transition-all duration-200 ${
              isValorant
                ? "bg-success/15 text-success ring-2 ring-success/35 ring-offset-2 ring-offset-background"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
          >
            <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z"/></svg>
            <span className="leading-none">Valorant</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("lol")}
            className={`touch-manipulation flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:flex-1 sm:px-3 py-2.5 sm:py-2.5 text-xs sm:text-sm font-semibold tracking-tight transition-all duration-200 ${
              gameTab === "lol"
                ? "bg-[hsl(198,100%,45%,0.12)] text-[hsl(198,100%,48%)] ring-2 ring-[hsl(198,100%,45%,0.35)] ring-offset-2 ring-offset-background"
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
            className={`touch-manipulation flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:flex-1 sm:px-3 py-2.5 sm:py-2.5 text-xs sm:text-sm font-semibold tracking-tight transition-all duration-200 ${
              isFortnite
                ? "bg-[hsl(265,80%,65%,0.12)] text-[hsl(265,80%,65%)] ring-2 ring-[hsl(265,80%,65%,0.45)] ring-offset-2 ring-offset-background"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
          >
            <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m15.767 14.171.097-5.05H12.4V5.197h3.99L16.872 0H7.128v24l5.271-.985V14.17z"/></svg>
            <span className="leading-none">Fortnite</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("minecraft")}
            className={`touch-manipulation flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:flex-1 sm:px-3 py-2.5 sm:py-2.5 text-xs sm:text-sm font-semibold tracking-tight transition-all duration-200 ${
              isMinecraft
                ? "ring-2 ring-offset-2 ring-offset-background"
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

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Marketplace ·{" "}
              <span style={{ color: accentColor }}>
                {isValorant ? "Valorant" : isFortnite ? "Fortnite" : isMinecraft ? "Minecraft" : "League of Legends"}
              </span>
            </p>
            <h1
              className={`mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl ${isValorant ? "" : "font-sans"}`}
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
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/30 px-3 py-1 text-[11px] text-muted-foreground">
              Procurando softwares?{" "}
              <Link to="/produtos" className="font-medium underline-offset-2 hover:underline" style={{ color: accentColor }}>Ver Produtos →</Link>
            </p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => refetch()}
              className="flex h-9 w-9 items-center justify-center rounded border border-border text-muted-foreground transition-colors"
              style={{ "--hover-color": accentColor } as CSSProperties}
              onMouseEnter={(e) => setLinkAccentHover(e, accentColor)}
              onMouseLeave={clearLinkAccentHover}
              title="Atualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setDisplayPage(1); }}
                className={`rounded border px-4 py-2 text-xs font-medium transition-colors ${
                  sortBy === opt.value ? accentClass : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          {/* ─── Mobile Filter Button ─── */}
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="flex lg:hidden items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all active:scale-[0.98]"
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
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card border-t border-border animate-in slide-in-from-bottom duration-300">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4 rounded-t-2xl">
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
                <div className="p-5">
                  {renderFilterContent()}
                </div>
                <div className="sticky bottom-0 border-t border-border bg-card p-4">
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98]"
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
              <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-border/40 bg-card overflow-hidden">
                    <div className="h-28 sm:h-36 bg-secondary/30" />
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-secondary/20">
                      <div className="h-3 w-16 rounded bg-secondary/50" />
                      <div className="h-3 w-12 rounded bg-secondary/50" />
                    </div>
                    <div className="p-2.5 sm:p-3 space-y-2">
                      <div className="h-2.5 w-3/4 rounded bg-secondary/40" />
                      <div className="h-2.5 w-1/2 rounded bg-secondary/40" />
                      <div className="mt-3 pt-2 border-t border-border/20">
                        <div className="h-5 w-20 rounded bg-secondary/50" />
                        <div className="mt-2 h-7 w-full rounded-lg bg-secondary/30" />
                      </div>
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
                <div
                  className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3 relative"
                >
                  {gridRows.map(({ item, priceLabel }) => (
                    <div key={item.item_id}>
                      {isValorant ? (
                        <ValorantCard item={item} skinsMap={skinsMap} priceLabel={priceLabel} />
                      ) : isFortnite ? (
                        <FortniteCard item={item} skinsDb={fnSkinsDb} priceLabel={priceLabel} />
                      ) : isMinecraft ? (
                        <MinecraftCard item={item} priceLabel={priceLabel} />
                      ) : (
                        <LolCard item={item} champKeyMap={champKeyMap} priceLabel={priceLabel} />
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
