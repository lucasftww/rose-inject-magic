import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import Header from "@/components/Header";
import { ChevronLeft, ChevronRight, ChevronDown, Search, SlidersHorizontal, DollarSign, Crosshair, Loader2, RefreshCw, Globe, TrendingUp, Star, Shield, Trophy, AlertTriangle, X, ArrowRight } from "lucide-react";
import { throwApiError } from "@/lib/apiErrors";
import { translateRegion } from "@/lib/regionTranslation";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

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
  rankUnranked, rankMap, RARITY_PRIORITY, fetchAllValorantSkins,
  type SkinEntry,
} from "@/lib/valorantData";

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

// Minecraft colors
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

// LoL rank ordering (text rank from API)
const lolRankOrder = [
  "Unranked","IRON IV","IRON III","IRON II","IRON I",
  "BRONZE IV","BRONZE III","BRONZE II","BRONZE I",
  "SILVER IV","SILVER III","SILVER II","SILVER I",
  "GOLD IV","GOLD III","GOLD II","GOLD I",
  "PLATINUM IV","PLATINUM III","PLATINUM II","PLATINUM I",
  "EMERALD IV","EMERALD III","EMERALD II","EMERALD I",
  "DIAMOND IV","DIAMOND III","DIAMOND II","DIAMOND I",
  "MASTER I","GRANDMASTER I","CHALLENGER I",
];

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
  { label: "Mais Recentes", value: "pdate_desc" },
  { label: "Menor Preço", value: "price_asc" },
  { label: "Maior Preço", value: "price_desc" },
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
  fortnite_vbucks?: number;
  fortnite_level?: number;
  fortnite_skin_count?: number;
  valorantInventory?: {
    WeaponSkins?: string[];
    Agent?: string[];
    Buddy?: string[];
    Champion?: string[];
    Skin?: string[];
  };
  imagePreviewLinks?: {
    direct?: { weapons?: string; agents?: string; buddies?: string };
  };
  // Server-calculated BRL price (with correct markup)
  price_brl?: number;
}

// ─── Data fetchers ───

// Rarity priority: higher = rarer/better
const RARITY_PRIORITY: Record<string, number> = {
  "411e4a55-4e59-7757-41f0-86a53f101bb5": 5, // Exclusive
  "e046854e-406c-37f4-6571-7a8baeeb93ab": 4, // Ultra
  "60bca009-4182-7998-dee7-b8a2558dc369": 3, // Premium
  "12683d76-48d7-84a3-4e09-6985794f0445": 2, // Deluxe
  "0cebb8be-46d7-c12a-d306-e9907bfc5a25": 1, // Select
};

type SkinEntry = { name: string; image: string; rarity: number };

const fetchAllValorantSkins = async (): Promise<Map<string, SkinEntry>> => {
  const map = new Map<string, SkinEntry>();

  // Fetch weapon skins
  try {
    const res = await fetch("https://valorant-api.com/v1/weapons/skins?language=pt-BR");
    if (res.ok) {
      const data = await res.json();
      for (const s of (data.data || [])) {
        const image = s.levels?.[0]?.displayIcon || s.displayIcon || s.chromas?.[0]?.fullRender;
        if (!image) continue;
        const rarity = RARITY_PRIORITY[s.contentTierUuid?.toLowerCase()] || 0;
        const entry: SkinEntry = { name: s.displayName, image, rarity };
        if (s.uuid) map.set(s.uuid.toLowerCase(), entry);
        for (const level of (s.levels || [])) {
          if (level.uuid) map.set(level.uuid.toLowerCase(), entry);
        }
        for (const chroma of (s.chromas || [])) {
          if (chroma.uuid) map.set(chroma.uuid.toLowerCase(), entry);
        }
      }
    }
  } catch { /* ignore */ }

  // Fetch agents (fallback preview)
  try {
    const res = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=pt-BR");
    if (res.ok) {
      const data = await res.json();
      for (const a of (data.data || [])) {
        const image = a.displayIcon || a.fullPortrait || a.bustPortrait;
        if (!image || !a.uuid) continue;
        map.set(a.uuid.toLowerCase(), { name: a.displayName, image, rarity: 0 });
      }
    }
  } catch { /* ignore */ }

  // Fetch buddies (fallback preview)
  try {
    const res = await fetch("https://valorant-api.com/v1/buddies?language=pt-BR");
    if (res.ok) {
      const data = await res.json();
      for (const b of (data.data || [])) {
        const image = b.displayIcon;
        if (!image || !b.uuid) continue;
        const entry: SkinEntry = { name: b.displayName, image, rarity: 0 };
        if (b.uuid) map.set(b.uuid.toLowerCase(), entry);
        for (const level of (b.levels || [])) {
          if (level.uuid) map.set(level.uuid.toLowerCase(), entry);
        }
      }
    }
  } catch { /* ignore */ }

  return map;
};

// Fortnite-API: fetch all BR cosmetics (smallIcon)
const fetchFortniteSkins = async (): Promise<Map<string, { name: string; image: string }>> => {
  try {
    const res = await fetch("https://fortnite-api.com/v2/cosmetics/br?language=pt-BR");
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();
    const map = new Map<string, { name: string; image: string }>();
    for (const item of (data.data || [])) {
      const image = item.images?.smallIcon || item.images?.icon;
      if (image && item.id) {
        map.set(item.id.toLowerCase(), { name: item.name || item.id, image });
      }
    }
    return map;
  } catch {
    return new Map();
  }
};

// Data Dragon: champion numeric key -> internal name (e.g., 103 -> "Ahri")
// Used to resolve LoL skin IDs: skinId = champKey * 1000 + skinNum
// Loading art URL: https://ddragon.leagueoflegends.com/cdn/img/champion/loading/{Name}_{skinNum}.jpg
const fetchLolChampKeyMap = async (): Promise<Map<number, string>> => {
  const versRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!versRes.ok) return new Map();
  const versions = await versRes.json();
  const version = versions[0];

  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map<number, string>();
  for (const [internalName, champ] of Object.entries(data.data as Record<string, any>)) {
    // champ.key is the numeric ID as a string (e.g., "103")
    map.set(parseInt((champ as any).key), internalName);
  }
  return map;
};

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.25, delay: i * 0.03, ease: "easeOut" as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0 } },
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
        src={url}
        alt="Skins preview"
        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

const ValorantCard = ({ item, skinsMap, formatPrice }: { item: LztItem; skinsMap: Map<string, SkinEntry>; formatPrice: (price: number, currency?: string) => string }) => {
  const navigate = useNavigate();
  const rank = item.riot_valorant_rank ? rankMap[item.riot_valorant_rank] : null;
  const hasKnife = (item.riot_valorant_knife ?? 0) > 0;
  const skinCount = item.riot_valorant_skin_count ?? 0;

  const skinPreviews = useMemo(() => {
    const results: SkinEntry[] = [];
    const toUuids = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === "object") return Object.values(raw as Record<string, string>);
      return [];
    };
    const allUuids = toUuids(item.valorantInventory?.WeaponSkins);
    for (const uuid of allUuids) {
      if (typeof uuid !== "string") continue;
      const entry = skinsMap.get(uuid.toLowerCase());
      if (entry) results.push(entry);
    }
    // Sort by rarity descending (best skins first)
    results.sort((a, b) => b.rarity - a.rarity);
    // Prefer Deluxe+ (rarity >= 2), exclude Select/battle pass skins
    const premium = results.filter(s => s.rarity >= 2);
    return (premium.length >= 4 ? premium : results.filter(s => s.rarity > 0).length >= 4 ? results.filter(s => s.rarity > 0) : results).slice(0, 6);
  }, [item.valorantInventory, skinsMap]);

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-success/50 hover:shadow-[0_4px_24px_hsl(var(--success)/0.12)] flex flex-col h-full"
      onClick={() => navigate(`/conta/${item.item_id}`)}
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--success)/0.06),transparent_70%)]" />
        {skinPreviews.length === 1 ? (
          <div className="relative z-[1] w-full h-full flex items-center justify-center bg-secondary/30">
            <img src={skinPreviews[0].image} alt={skinPreviews[0].name} className="w-full h-full object-contain" loading="lazy" />
          </div>
        ) : skinPreviews.length === 2 ? (
          <div className="relative z-[1] grid grid-cols-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={skin.image} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length === 3 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.slice(0, 2).map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={skin.image} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
            ))}
            <div className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5 col-span-2">
              <img src={skinPreviews[2].image} alt={skinPreviews[2].name} className="w-full h-full object-contain" loading="lazy" />
            </div>
          </div>
        ) : skinPreviews.length === 4 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={skin.image} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length === 5 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={skin.image} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/30 p-0.5">
                <img src={skin.image} alt={skin.name} className="w-full h-full object-contain" loading="lazy" />
              </div>
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
        <div className="flex items-center gap-1">
          <svg className="h-2.5 w-2.5 text-success flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span className="text-[9px] sm:text-[11px] text-muted-foreground">Full Acesso · Entrega Automática</span>
        </div>
        {item.valorantRegionPhrase && (
          <div className="flex items-center gap-1">
            <Globe className="h-2.5 w-2.5 text-muted-foreground/60 flex-shrink-0" />
            <span className="text-[9px] sm:text-[11px] text-muted-foreground/80">{translateRegion(item.valorantRegionPhrase)}</span>
          </div>
        )}
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <p className="text-sm sm:text-base font-bold text-success tracking-tight">{formatPrice(item.price, item.price_currency)}</p>
          <button className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg bg-success py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-success-foreground">
            Ver conta <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── LoL Card ───
const LolCard = ({ item, champKeyMap, formatPrice }: { item: LztItem; champKeyMap: Map<number, string>; formatPrice: (price: number, currency?: string) => string }) => {
  const navigate = useNavigate();
  const rankText = item.riot_lol_rank || "Unranked";
  const rankFilterId = lolRankToFilterId(rankText);
  const rankFilterData = lolRankFilters.find(r => r.id === rankFilterId);
  const rankColor = rankFilterData?.color || "hsl(var(--muted-foreground))";
  const champCount = item.riot_lol_champion_count ?? 0;
  const skinCount = item.riot_lol_skin_count ?? 0;
  const level = item.riot_lol_level ?? 0;
  const winRate = item.riot_lol_rank_win_rate;

  // Resolve LoL skin IDs via lolInventory (não valorantInventory!)
  // skinId = champKey * 1000 + skinNum
  const lolInventory = (item as any).lolInventory as { Champion?: number[]; Skin?: number[] } | null | undefined;
  const skinPreviews = useMemo(() => {
    // Tenta skins primeiro; se vazio, mostra campeões como preview
    const skinIds = Array.isArray(lolInventory?.Skin) ? lolInventory!.Skin! : [];
    const champIds = Array.isArray(lolInventory?.Champion) ? lolInventory!.Champion! : [];
    const results: { name: string; image: string }[] = [];

    // Skins com arte personalizada
    for (const skinId of skinIds) {
      const id = Number(skinId);
      if (isNaN(id)) continue;
      const champKey = Math.floor(id / 1000);
      const skinNum = id % 1000;
      const champName = champKeyMap.get(champKey);
      if (champName && skinNum > 0) {
        results.push({
          name: champName,
          image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champName}_${skinNum}.jpg`,
        });
      }
      if (results.length >= 6) break;
    }

    // Fallback: campeões (skin 0 = arte base)
    if (results.length === 0) {
      for (const champId of champIds) {
        const champName = champKeyMap.get(Number(champId));
        if (champName) {
          results.push({
            name: champName,
            image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champName}_0.jpg`,
          });
        }
        if (results.length >= 6) break;
      }
    }

    return results;
  }, [lolInventory?.Skin, lolInventory?.Champion, champKeyMap]);

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-[hsl(198,100%,45%)/50%] hover:shadow-[0_4px_24px_hsl(198,100%,45%,0.12)] flex flex-col h-full"
      onClick={() => navigate(`/lol/${item.item_id}`)}
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(198,100%,45%,0.08),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[hsl(var(--card))] to-transparent z-[2]" />
        {skinPreviews.length === 1 ? (
          <div className="relative z-[1] w-full h-full">
            <img src={skinPreviews[0].image} alt={skinPreviews[0].name} className="h-full w-full object-cover object-top" loading="lazy" />
          </div>
        ) : skinPreviews.length === 2 ? (
          <div className="relative z-[1] grid grid-cols-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={skin.image} alt={skin.name} className="h-full w-full object-cover object-top" loading="lazy" />
                {i > 0 && <div className="absolute inset-y-0 left-0 w-px bg-black/20" />}
              </div>
            ))}
          </div>
        ) : skinPreviews.length <= 4 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={skin.image} alt={skin.name} className="h-full w-full object-cover object-top" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={skin.image} alt={skin.name} className="h-full w-full object-cover object-top" loading="lazy" />
              </div>
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
              {winRate}% WR
            </span>
          )}
          {item.riot_lol_region && (
            <span className="flex items-center gap-1">
              <Globe className="h-2.5 w-2.5 text-muted-foreground/60" />
              {item.riot_lol_region.toUpperCase()}
            </span>
          )}
        </div>
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <p className="text-sm sm:text-base font-bold text-[hsl(198,100%,45%)] tracking-tight">{formatPrice(item.price, item.price_currency)}</p>
          <button className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-white" style={{ background: "hsl(198,100%,45%)" }}>
            Ver conta <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Fortnite Card ───
const FortniteCard = ({ item, skinsDb, formatPrice }: { item: LztItem; skinsDb: Map<string, { name: string; image: string }>; formatPrice: (price: number, currency?: string) => string }) => {
  const navigate = useNavigate();
  const raw = item as any;
  const vbucks = raw.fortnite_balance ?? raw.fortnite_vbucks ?? item.riot_valorant_wallet_vp ?? 0;
  const skinCount = raw.fortnite_skin_count ?? item.riot_valorant_skin_count ?? 0;
  const level = raw.fortnite_level ?? item.riot_valorant_level ?? 0;

  // fortniteSkins is an array of { id, title, rarity } from LZT API
  const skinPreviews = useMemo(() => {
    const fortniteSkins: { id: string; title: string }[] = Array.isArray(raw.fortniteSkins) ? raw.fortniteSkins : [];
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
      const pickaxes: { id: string; title: string }[] = Array.isArray(raw.fortnitePickaxe) ? raw.fortnitePickaxe : [];
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
  }, [raw.fortniteSkins, raw.fortnitePickaxe, skinsDb]);

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-[hsl(265,80%,65%)/50%] hover:shadow-[0_4px_24px_hsl(265,80%,65%,0.12)] flex flex-col h-full"
      onClick={() => navigate(`/fortnite/${item.item_id}`)}
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(265,80%,65%,0.08),transparent_70%)]" />
        {skinPreviews.length === 1 ? (
          <div className="relative z-[1] w-full h-full flex items-center justify-center bg-secondary/20">
            <img src={skinPreviews[0].image} alt={skinPreviews[0].name} className="w-full h-full object-contain" loading="lazy" />
          </div>
        ) : skinPreviews.length === 2 ? (
          <div className="relative z-[1] grid grid-cols-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <img src={skin.image} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length === 3 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.slice(0, 2).map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <img src={skin.image} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
              </div>
            ))}
            <div className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5 col-span-2">
              <img src={skinPreviews[2].image} alt={skinPreviews[2].name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
            </div>
          </div>
        ) : skinPreviews.length === 4 ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <img src={skin.image} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
              </div>
            ))}
          </div>
        ) : skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center w-full h-full rounded bg-secondary/20 p-0.5">
                <img src={skin.image} alt={skin.name} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" />
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
        <div className="flex items-center gap-1">
          <svg className="h-2.5 w-2.5" style={{ color: FN_PURPLE }} viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span className="text-[9px] sm:text-[11px] text-muted-foreground">Full Acesso · Entrega Automática</span>
        </div>
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <p className="text-sm sm:text-base font-bold tracking-tight" style={{ color: FN_PURPLE }}>{formatPrice(item.price, item.price_currency)}</p>
          <button className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-white" style={{ background: FN_PURPLE }}>
            Ver conta <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Minecraft Card ───
const MinecraftCard = ({ item, formatPrice }: { item: LztItem; formatPrice: (price: number, currency?: string) => string }) => {
  const navigate = useNavigate();
  const nickname = item.minecraft_nickname;
  const hasJava = (item.minecraft_java ?? 0) > 0;
  const hasBedrock = (item.minecraft_bedrock ?? 0) > 0;
  const hypixelRank = item.minecraft_hypixel_rank;
  const hypixelLevel = item.minecraft_hypixel_level ?? 0;
  const capes = item.minecraft_capes_count ?? 0;
  const banned = (item.minecraft_hypixel_ban ?? 0) > 0;

  // mineskin.eu avatar (body render)
  const skinUrl = nickname
    ? `https://mineskin.eu/body/${encodeURIComponent(nickname)}/120.png`
    : null;

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all flex flex-col h-full"
      style={{ ['--hover-shadow' as string]: `0 0 24px ${MC_GREEN}15` }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${MC_GREEN}80`; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${MC_GREEN}15`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      onClick={() => navigate(`/minecraft/${item.item_id}`)}
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${MC_GREEN}0a, transparent 70%)` }} />
        {skinUrl ? (
          <div className="relative z-[1] flex items-end justify-center h-full pt-2 pb-1">
            <img src={skinUrl} alt={nickname || "Skin"} className="h-full w-auto object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
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
        <div className="flex items-center gap-1">
          <svg className="h-2.5 w-2.5" style={{ color: MC_GREEN }} viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span className="text-[9px] sm:text-[11px] text-muted-foreground">Full Acesso · Entrega Automática</span>
        </div>
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <p className="text-sm sm:text-base font-bold tracking-tight" style={{ color: MC_GREEN }}>{formatPrice(item.price, item.price_currency)}</p>
          <button className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-white" style={{ background: MC_GREEN }}>
            Ver conta <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── API ───
const fetchAccountsRaw = async (params: Record<string, string | string[]>) => {
  const queryParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(val => queryParams.append(k, val));
    else queryParams.set(k, v);
  }
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${projectUrl}/functions/v1/lzt-market?${queryParams.toString()}`, {
    headers: { "Content-Type": "application/json", apikey: anonKey },
  });
  if (!res.ok) throwApiError(res.status);
  return res.json();
};

const Contas = () => {
  const { getDisplayPrice } = useLztMarkup();
  const [searchParams, setSearchParams] = useSearchParams();
  const [gameTab, setGameTab] = useState<GameTab>(() => {
    const g = searchParams.get("game");
    if (g === "lol") return "lol";
    if (g === "fortnite") return "fortnite";
    if (g === "minecraft") return "minecraft";
    return "valorant";
  });

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
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
  const [fnSkinsMin, setFnSkinsMin] = useState("1");

  // ─── Minecraft filters ───
  const [mcJava, setMcJava] = useState(false);
  const [mcBedrock, setMcBedrock] = useState(false);
  const [mcHypixelLvlMin, setMcHypixelLvlMin] = useState("");
  const [mcCapesMin, setMcCapesMin] = useState("");
  const [mcNoBan, setMcNoBan] = useState(false);

  // ─── Shared filters ───
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState<string>("price_desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [lvlMin, setLvlMin] = useState("");
  const [lvlMax, setLvlMax] = useState("");
  const [invMin, setInvMin] = useState("");
  const [invMax, setInvMax] = useState("");
  const [page, setPage] = useState(1);
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
  const [totalItems, setTotalItems] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const MAX_PAGES = 5;

  // ─── Asset maps ───
  const { data: skinsMap = new Map() } = useQuery({
    queryKey: ["all-valorant-skins"],
    queryFn: fetchAllValorantSkins,
    staleTime: 1000 * 60 * 60,
  });

  const { data: champKeyMap = new Map<number, string>() } = useQuery({
    queryKey: ["lol-champ-key-map"],
    queryFn: fetchLolChampKeyMap,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const { data: fnSkinsDb = new Map<string, { name: string; image: string }>() } = useQuery({
    queryKey: ["fortnite-cosmetics"],
    queryFn: fetchFortniteSkins,
    staleTime: 1000 * 60 * 60 * 6,
    enabled: gameTab === "fortnite",
  });

  const buildParams = useCallback((pageNum: number = page): Record<string, string | string[]> => {
    const params: Record<string, string | string[]> = {};
    params.page = String(pageNum);
    if (sortBy) params.order_by = sortBy;
    if (priceMin) params.pmin = priceMin;
    if (priceMax) params.pmax = priceMax;
    if (searchQuery) params.title = searchQuery;

    if (gameTab === "valorant") {
      params.game_type = "riot";
      // Valorant-specific — require 10+ skins only when sorting by highest price
      params.valorant_smin = sortBy === "price_desc" ? "10" : "1";
      params.inv_min = "1000";
      params.valorant_level_min = "20";
      if (onlyKnife) params.knife = "true";
      if (lvlMin) params.valorant_level_min = lvlMin;
      if (lvlMax) params.valorant_level_max = lvlMax;
      if (invMin) params.inv_min = invMin;
      if (invMax) params.inv_max = invMax;

      const rankFilter = valorantRankFilters.find((r) => r.id === selectedRank);
      if (rankFilter && rankFilter.id !== "todos") {
        params.rmin = String(rankFilter.rmin);
        params.rmax = String(rankFilter.rmax);
      }

      // Region filter
      if (valRegion !== "all") {
        params["valorant_region[]"] = valRegion;
      }

      if (selectedWeapon !== "todos") {
        params.title = selectedWeapon;
      }
    } else if (gameTab === "lol") {
      // LoL-specific — hide empty accounts, require at least 1 skin and 10 champions
      params.game_type = "lol";
      params.lol_smin = "1";
      params.champion_min = "10";
      if (lvlMin) params.lol_level_min = lvlMin;
      if (lvlMax) params.lol_level_max = lvlMax;
      if (lolChampMin) params.champion_min = lolChampMin;
      if (lolSkinsMin) params.lol_smin = lolSkinsMin;

      if (lolRank !== "todos" && lolRankApiValues[lolRank]) {
        params["lol_rank[]"] = lolRankApiValues[lolRank];
      }

      // Region filter
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
    } else {
      // Fortnite-specific
      params.game_type = "fortnite";
      if (fnVbMin) params.vbmin = fnVbMin;
      if (fnSkinsMin) params.smin = fnSkinsMin;
    }

    return params;
  }, [page, sortBy, priceMin, priceMax, searchQuery, onlyKnife, selectedRank, selectedWeapon, invMin, invMax, lvlMin, lvlMax, gameTab, lolRank, lolChampMin, lolSkinsMin, fnVbMin, fnSkinsMin, mcJava, mcBedrock, mcHypixelLvlMin, mcCapesMin, mcNoBan, valRegion, lolRegion]);

  const paramsKey = JSON.stringify(buildParams(1)) + gameTab;

  const fetchWithRetry = useCallback(async (params: Record<string, string | string[]>, controller: AbortController, retries = 3): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (controller.signal.aborted) throw new Error("aborted");
      try {
        return await fetchAccountsRaw(params);
      } catch (err: any) {
        if (attempt >= retries) throw err;
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }, []);

  const fetchMultiplePages = useCallback(async (controller: AbortController) => {
    setStreamedItems([]);
    setStreamingDone(false);
    setStreamError(null);
    setCurrentPage(1);
    setLoadingMore(false);
    setDisplayPage(1);
    setFirstPageLoaded(false);

    try {
      // Fetch first page immediately
      const data = await fetchWithRetry(buildParams(1), controller);
      if (controller.signal.aborted) return;

      setFirstPageLoaded(true);
      const firstPageItems: LztItem[] = data?.items ?? [];
      setTotalItems(data?.totalItems ?? 0);
      const hasMore = data?.hasNextPage ?? false;
      setHasNextPage(hasMore);
      setCurrentPage(1);
      setStreamedItems(firstPageItems);

      // Fetch remaining pages in background, batch by page
      if (hasMore) {
        let allItems = [...firstPageItems];
        let nextPage = hasMore;
        let pageNum = 2;

          while (nextPage && pageNum <= MAX_PAGES) {
            if (controller.signal.aborted) return;
            const pageData = await fetchWithRetry(buildParams(pageNum), controller);
          if (controller.signal.aborted) return;

          const pageItems: LztItem[] = pageData?.items ?? [];
          allItems = [...allItems, ...pageItems];
          setStreamedItems(allItems);
          nextPage = pageData?.hasNextPage ?? false;
          setHasNextPage(nextPage);
          setCurrentPage(pageNum);
          pageNum++;
        }
      }

      if (!controller.signal.aborted) setStreamingDone(true);
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setFirstPageLoaded(true);
        setStreamError(err);
        setStreamingDone(true);
      }
    }
  }, [buildParams, fetchWithRetry]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchMultiplePages(controller);
    return () => controller.abort();
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMorePages = async () => {
    if (loadingMore || !hasNextPage) return;
    setLoadingMore(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const nextPageNum = currentPage + 1;
      const data = await fetchAccountsRaw(buildParams(nextPageNum));
      if (controller.signal.aborted) return;
      const pageItems: LztItem[] = data?.items ?? [];
      setHasNextPage(data?.hasNextPage ?? false);
      setCurrentPage(nextPageNum);
      setStreamedItems(prev => [...prev, ...pageItems]);
    } catch (err: any) {
      if (!controller.signal.aborted) setStreamError(err);
    }
    setLoadingMore(false);
  };

  const ITEMS_PER_PAGE = 24;
  const [displayPage, setDisplayPage] = useState(1);
  const [firstPageLoaded, setFirstPageLoaded] = useState(false);

  const isLoading = !firstPageLoaded && !streamingDone && !streamError;
  const isStreaming = firstPageLoaded && !streamingDone;
  const allItems = (() => {
    const sorted = [...streamedItems];

    // If user explicitly chose a price sort, respect it across all games
    if (sortBy === "price_asc") {
      return sorted.sort((a, b) => a.price - b.price);
    }
    if (sortBy === "price_desc") {
      return sorted.sort((a, b) => b.price - a.price);
    }

    // Default sort (pdate_desc): apply game-specific "best quality" sorting
    if (gameTab === "lol") {
      return sorted.sort((a, b) => {
        const scoreA = (a.riot_lol_level ?? 0) > 0 && (a.riot_lol_skin_count ?? 0) > 0 ? 2
          : (a.riot_lol_level ?? 0) > 0 || (a.riot_lol_skin_count ?? 0) > 0 ? 1 : 0;
        const scoreB = (b.riot_lol_level ?? 0) > 0 && (b.riot_lol_skin_count ?? 0) > 0 ? 2
          : (b.riot_lol_level ?? 0) > 0 || (b.riot_lol_skin_count ?? 0) > 0 ? 1 : 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return ((b.riot_lol_skin_count ?? 0) - (a.riot_lol_skin_count ?? 0)) || ((b.riot_lol_level ?? 0) - (a.riot_lol_level ?? 0));
      });
    }
    if (gameTab === "fortnite") {
      return sorted.sort((a, b) => {
        const skinsA = (a as any).fortnite_skin_count ?? a.riot_valorant_skin_count ?? 0;
        const skinsB = (b as any).fortnite_skin_count ?? b.riot_valorant_skin_count ?? 0;
        const hasSkinA = skinsA > 0;
        const hasSkinB = skinsB > 0;
        if (hasSkinA && !hasSkinB) return -1;
        if (!hasSkinA && hasSkinB) return 1;
        if (!hasSkinA && !hasSkinB) return a.price - b.price;
        const valueA = skinsA / (a.price || 1);
        const valueB = skinsB / (b.price || 1);
        if (Math.abs(valueB - valueA) > 0.0001) return valueB - valueA;
        return a.price - b.price;
      });
    }
    if (gameTab === "minecraft") {
      return sorted.sort((a, b) => a.price - b.price);
    }
    return sorted;
  })();
  const totalDisplayPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
  const items = allItems.slice((displayPage - 1) * ITEMS_PER_PAGE, displayPage * ITEMS_PER_PAGE);

  const refetch = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchMultiplePages(controller);
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
    setPage(1);
  };

  const switchTab = (tab: GameTab) => {
    setGameTab(tab);
    const params: Record<string, string> = {};
    if (tab !== "valorant") params.game = tab;
    setSearchParams(params);
    clearFilters();
    setSortBy("price_desc");
  };

  const isMinecraft = gameTab === "minecraft";
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

  const isValorant = gameTab === "valorant";
  const isFortnite = gameTab === "fortnite";
  const accentColor = isValorant ? "hsl(var(--success))" : isFortnite ? FN_PURPLE : isMinecraft ? MC_GREEN : "hsl(198,100%,45%)";
  const accentClass = isValorant
    ? "text-success border-success bg-success/10"
    : isFortnite
    ? "text-[hsl(265,80%,65%)] border-[hsl(265,80%,65%)] bg-[hsl(265,80%,65%,0.1)]"
    : isMinecraft
    ? "text-[hsl(120,60%,45%)] border-[hsl(120,60%,45%)] bg-[hsl(120,60%,45%,0.1)]"
    : "text-[hsl(198,100%,45%)] border-[hsl(198,100%,45%)] bg-[hsl(198,100%,45%,0.1)]";

  const renderFilterContent = () => (
    <>
      {/* Search */}
      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar contas..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value.slice(0, 100)); setPage(1); }}
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
                  <button key={rank.id} onClick={() => { setSelectedRank(rank.id); setPage(1); }}
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
                  <button key={weapon.id} onClick={() => { setSelectedWeapon(weapon.id); setPage(1); }}
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
                <input type="checkbox" checked={onlyKnife} onChange={(e) => { setOnlyKnife(e.target.checked); setPage(1); }} className="peer sr-only" />
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
            <select value={valRegion} onChange={(e) => { setValRegion(e.target.value); setPage(1); }}
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
                <button key={rank.id} onClick={() => { setLolRank(rank.id); setPage(1); }}
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
            <input type="number" placeholder="Ex: 50" value={lolChampMin} onChange={(e) => { setLolChampMin(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(198,100%,45%,0.5)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-[hsl(198,100%,45%)]" />Mín. Skins LoL
            </p>
            <input type="number" placeholder="Ex: 10" value={lolSkinsMin} onChange={(e) => { setLolSkinsMin(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(198,100%,45%,0.5)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[hsl(198,100%,45%)]" />Região
            </p>
            <select value={lolRegion} onChange={(e) => { setLolRegion(e.target.value); setPage(1); }}
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
            <input type="number" placeholder="Ex: 1000" value={fnVbMin} onChange={(e) => { setFnVbMin(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${FN_PURPLE}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: FN_PURPLE }} />Mín. Skins
            </p>
            <input type="number" placeholder="Ex: 10" value={fnSkinsMin} onChange={(e) => { setFnSkinsMin(e.target.value); setPage(1); }}
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
                <input type="checkbox" checked={mcJava} onChange={(e) => { setMcJava(e.target.checked); setPage(1); }} className="sr-only" />
                <div className="h-3.5 w-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: mcJava ? MC_GREEN : undefined, background: mcJava ? MC_GREEN : "transparent" }}>
                  {mcJava && <span className="text-[8px] font-bold text-white">✓</span>}
                </div>
                <span className="text-xs font-medium" style={{ color: mcJava ? MC_GREEN : undefined }}>Java</span>
              </label>
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 transition-all"
                style={mcBedrock ? { borderColor: MC_GREEN, background: `${MC_GREEN}10` } : {}}>
                <input type="checkbox" checked={mcBedrock} onChange={(e) => { setMcBedrock(e.target.checked); setPage(1); }} className="sr-only" />
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
            <input type="number" placeholder="Ex: 50" value={mcHypixelLvlMin} onChange={(e) => { setMcHypixelLvlMin(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${MC_GREEN}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: MC_GREEN }} />Mín. Capes
            </p>
            <input type="number" placeholder="Ex: 1" value={mcCapesMin} onChange={(e) => { setMcCapesMin(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${MC_GREEN}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input type="checkbox" checked={mcNoBan} onChange={(e) => { setMcNoBan(e.target.checked); setPage(1); }} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full border border-border bg-secondary transition-colors peer-checked:border-[hsl(120,60%,45%)] peer-checked:bg-[hsl(120,60%,45%)]" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 transition-all peer-checked:left-[18px] peer-checked:bg-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">🚫 Sem Ban Hypixel</span>
            </label>
          </div>
        </>
      )}

      {/* Price (shared) */}
      <div className="mt-6">
        <button onClick={() => setPriceOpen(!priceOpen)} className="flex w-full items-center justify-between text-sm font-semibold text-foreground">
          <span className="flex items-center gap-2"><DollarSign className="h-4 w-4" style={{ color: accentColor }} />Faixa de Preço</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${priceOpen ? "rotate-180" : ""}`} />
        </button>
        {priceOpen && (
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <input type="number" placeholder="Mín" value={priceMin} onChange={(e) => { setPriceMin(e.target.value.slice(0, 7)); setPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <span className="text-xs text-muted-foreground">—</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <input type="number" placeholder="Máx" value={priceMax} onChange={(e) => { setPriceMax(e.target.value.slice(0, 7)); setPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
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
              <input type="number" placeholder="Mín" value={invMin} onChange={(e) => { setInvMin(e.target.value.slice(0, 7)); setPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="number" placeholder="Máx" value={invMax} onChange={(e) => { setInvMax(e.target.value.slice(0, 7)); setPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
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
              <input type="number" placeholder="Mín" value={lvlMin} onChange={(e) => { setLvlMin(e.target.value.slice(0, 4)); setPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="number" placeholder="Máx" value={lvlMax} onChange={(e) => { setLvlMax(e.target.value.slice(0, 4)); setPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
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

        {/* ─── Game Tab Switcher ─── */}
        <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-3 mb-6 sm:mb-8">
          <button
            onClick={() => switchTab("valorant")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl border px-2 sm:px-5 py-2.5 sm:py-3 text-[11px] sm:text-sm font-bold transition-all ${
              isValorant
                ? "border-success bg-success/10 text-success shadow-[0_0_16px_hsl(130,99%,41%,0.2)]"
                : "border-border bg-secondary/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z"/></svg>
            <span className="leading-tight">Valorant</span>
          </button>
          <button
            onClick={() => switchTab("lol")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl border px-2 sm:px-5 py-2.5 sm:py-3 text-[11px] sm:text-sm font-bold transition-all ${
              gameTab === "lol"
                ? "border-[hsl(198,100%,45%)] bg-[hsl(198,100%,45%,0.1)] text-[hsl(198,100%,45%)] shadow-[0_0_16px_hsl(198,100%,45%,0.2)]"
                : "border-border bg-secondary/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m1.912 0 1.212 2.474v19.053L1.912 24h14.73l1.337-4.682H8.33V0ZM12 1.516c-.913 0-1.798.112-2.648.312v1.74a9.738 9.738 0 0 1 2.648-.368c5.267 0 9.536 4.184 9.536 9.348a9.203 9.203 0 0 1-2.3 6.086l-.273.954-.602 2.112c2.952-1.993 4.89-5.335 4.89-9.122C23.25 6.468 18.213 1.516 12 1.516Zm0 2.673c-.924 0-1.814.148-2.648.414v13.713h8.817a8.246 8.246 0 0 0 2.36-5.768c0-4.617-3.818-8.359-8.529-8.359zM2.104 7.312A10.858 10.858 0 0 0 .75 12.576c0 1.906.492 3.7 1.355 5.266z"/></svg>
            <span className="leading-tight">LoL</span>
          </button>
          <button
            onClick={() => switchTab("fortnite")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl border px-2 sm:px-5 py-2.5 sm:py-3 text-[11px] sm:text-sm font-bold transition-all ${
              isFortnite
                ? "shadow-[0_0_16px_hsl(265,80%,65%,0.2)]"
                : "border-border bg-secondary/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
            style={isFortnite ? { borderColor: FN_PURPLE, background: `${FN_PURPLE}15`, color: FN_PURPLE } : {}}
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m15.767 14.171.097-5.05H12.4V5.197h3.99L16.872 0H7.128v24l5.271-.985V14.17z"/></svg>
            <span className="leading-tight">Fortnite</span>
          </button>
          <button
            onClick={() => switchTab("minecraft")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl border px-2 sm:px-5 py-2.5 sm:py-3 text-[11px] sm:text-sm font-bold transition-all ${
              isMinecraft
                ? ""
                : "border-border bg-secondary/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
            style={isMinecraft ? { borderColor: MC_GREEN, background: `${MC_GREEN}15`, color: MC_GREEN, boxShadow: `0 0 16px ${MC_GREEN}30` } : {}}
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" id="mdi-minecraft"><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M6,6V10H10V12H8V18H10V16H14V18H16V12H14V10H18V6H14V10H10V6H6Z" /></svg>
            <span className="leading-tight">Minecraft</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em]" style={{ color: accentColor }}>
              {isValorant ? "Valorant" : isFortnite ? "Fortnite" : isMinecraft ? "Minecraft" : "League of Legends"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
              {isValorant ? "CONTAS VALORANT" : isFortnite ? "CONTAS FORTNITE" : isMinecraft ? "CONTAS MINECRAFT" : "CONTAS LOL"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {streamError ? "Erro ao buscar contas" : isLoading ? "Buscando contas..." : isStreaming ? `Carregando... ${allItems.length} contas (página ${currentPage})` : `${allItems.length} contas · Página ${displayPage} de ${totalDisplayPages}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex h-9 w-9 items-center justify-center rounded border border-border text-muted-foreground transition-colors"
              style={{ ['--hover-color' as string]: accentColor }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = accentColor; (e.currentTarget as HTMLElement).style.color = accentColor; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
              title="Atualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setPage(1); }}
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
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
                <p className="mt-3 text-sm text-muted-foreground">Buscando contas...</p>
              </div>
            )}

            {streamError && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                <AlertTriangle className="h-10 w-10 text-warning" />
                <p className="text-lg font-semibold text-foreground">Ops! Algo deu errado</p>
                <p className="mt-1 text-sm text-center max-w-md">{streamError.message}</p>
                <button
                  onClick={() => refetch()}
                  className="mt-4 rounded border border-border px-4 py-2 text-xs font-medium transition-colors"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = accentColor; (e.currentTarget as HTMLElement).style.color = accentColor; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!isLoading && !streamError && (
              <>
                {isStreaming && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5" style={{ borderColor: `${accentColor}30`, background: `${accentColor}08` }}>
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: accentColor }} />
                    <span className="text-xs font-medium" style={{ color: accentColor }}>
                      Carregando contas... {allItems.length} encontradas (página {currentPage}/{MAX_PAGES})
                    </span>
                    <div className="ml-auto flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accentColor, animationDelay: `${i * 200}ms` }} />
                      ))}
                    </div>
                  </div>
                )}

                <motion.div
                  className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3"
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                >
                  {items.map((item) => (
                    <motion.div
                      key={item.item_id}
                      initial={{ opacity: 0, y: 15, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {isValorant ? (
                        <ValorantCard item={item} skinsMap={skinsMap} formatPrice={(p, c) => getDisplayPrice({ price: p, price_currency: c, price_brl: item.price_brl }, "valorant")} />
                      ) : isFortnite ? (
                        <FortniteCard item={item} skinsDb={fnSkinsDb} formatPrice={(p, c) => getDisplayPrice({ price: p, price_currency: c, price_brl: item.price_brl }, "fortnite")} />
                      ) : isMinecraft ? (
                        <MinecraftCard item={item} formatPrice={(p, c) => getDisplayPrice({ price: p, price_currency: c, price_brl: item.price_brl }, "minecraft")} />
                      ) : (
                        <LolCard item={item} champKeyMap={champKeyMap} formatPrice={(p, c) => getDisplayPrice({ price: p, price_currency: c, price_brl: item.price_brl }, "lol")} />
                      )}
                    </motion.div>
                  ))}
                </motion.div>

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
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = accentColor; (e.currentTarget as HTMLElement).style.color = accentColor; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: totalDisplayPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalDisplayPages || Math.abs(p - displayPage) <= 2)
                        .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === 'ellipsis' ? (
                            <span key={`e${i}`} className="flex h-9 w-9 items-center justify-center text-xs text-muted-foreground">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => { setDisplayPage(p as number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className="flex h-9 w-9 items-center justify-center rounded border text-xs font-medium transition-colors"
                              style={displayPage === p ? { borderColor: accentColor, background: `${accentColor}15`, color: accentColor } : {}}
                              onMouseEnter={e => { if (displayPage !== p) { (e.currentTarget as HTMLElement).style.borderColor = accentColor; (e.currentTarget as HTMLElement).style.color = accentColor; } }}
                              onMouseLeave={e => { if (displayPage !== p) { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = ''; } }}
                            >
                              {p}
                            </button>
                          )
                        )}
                      <button
                        onClick={() => { setDisplayPage(p => Math.min(totalDisplayPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={displayPage >= totalDisplayPages}
                        className="flex h-9 w-9 items-center justify-center rounded border border-border text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = accentColor; (e.currentTarget as HTMLElement).style.color = accentColor; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
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
                        disabled={loadingMore}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2 text-xs font-medium text-muted-foreground transition-colors disabled:opacity-50"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = accentColor; (e.currentTarget as HTMLElement).style.color = accentColor; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
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
