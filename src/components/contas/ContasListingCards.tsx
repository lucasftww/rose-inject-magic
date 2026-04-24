import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
  forwardRef,
  type CSSProperties,
  type ImgHTMLAttributes,
  type MouseEvent,
  type TouchEvent,
} from "react";
import { Link } from "react-router-dom";
import type { QueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Globe,
  TrendingUp,
  Trophy,
  Shield,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { translateRegion } from "@/lib/regionTranslation";
import { rankUnranked, rankMap, type SkinEntry } from "@/lib/valorantData";
import { getListingCardTitle } from "@/lib/lztDisplayTitles";
import { compareFortniteCardRows, type FortniteCosmeticDbRow } from "@/lib/fortniteCosmeticSort";
import {
  hideImgOnError,
  setBorderAndBoxShadow,
  clearBorderAndBoxShadow,
} from "@/lib/domEventHelpers";
import { isRecord } from "@/types/ticketChat";
import { prefetchAccountDetail } from "@/lib/lztPrefetch";
import { getProxiedImageUrl } from "@/lib/lztImageProxy";
import type { LztItem } from "@/lib/contasMarketTypes";
import { brawlersCountFromLztItem, brawlLevelFromLztItem, brawlTrophiesFromLztItem } from "@/lib/lztBrawlStats";
import {
  extractBrawlBrawlerNames,
  brawlifyAvatarUrl,
  extractLztItemImageUrls,
  extractMihoyoCardPreviews,
  type MihoyoCardVariant,
} from "@/lib/contasLztVisualAssets";
import { lolRankFilters, lolRankToFilterId } from "@/lib/contasLolRankFilters";
import { FN_PURPLE, FN_BLUE, MC_GREEN, GS_CYAN, HS_VIOLET, ZZZ_AMBER } from "@/lib/contasGameAccents";

/** Data Dragon champion keys from champion.json are already valid (e.g. LeeSin); do not sentence-case them. */
const ddragonChampionId = (internalNameFromMap: string) => internalNameFromMap;

// Smooth-loading image: defers src until card is near viewport via Intersection Observer,
// then fades in on load. Avoids DNS/connection overhead for off-screen images.
const likelySlowDevice =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches === true ||
    (() => {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      return Boolean(conn?.saveData) || conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g";
    })());
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
        // Desktop: margem mais pequena → menos miniaturas DDragon/Fortnite em paralelo fora do ecrã.
        { rootMargin: likelySlowDevice ? "120px 0px" : "140px 0px" },
      )
    : null;

const SmoothImg = memo(forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(({ src, alt, className, ...props }, _ref) => {
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
      fetchPriority="low"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}));
SmoothImg.displayName = "SmoothImg";

export const ValorantCard = memo(({ item, skinsMap, priceLabel, queryClient }: { item: LztItem; skinsMap: Map<string, SkinEntry>; priceLabel: string; queryClient: QueryClient }) => {
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

  const prevSkin = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSkinIdx(i => (i - 1 + skinPreviews.length) % skinPreviews.length);
  }, [skinPreviews.length]);

  const nextSkin = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSkinIdx(i => (i + 1) % skinPreviews.length);
  }, [skinPreviews.length]);

  // Touch swipe for skin carousel
  const touchRef = useRef<{ startX: number; startY: number; swiped: boolean } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (skinPreviews.length <= 1) return;
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiped: false };
  }, [skinPreviews.length]);

  const onTouchMove = useCallback((e: TouchEvent) => {
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
      <div
        ref={carouselRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20"
      >
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

/** Máx. miniaturas no card da lista — cada uma é 1 GET ao DDragon; 4 costuma bastar para leitura rápida. */
const LOL_LISTING_PREVIEW_CAP = 4;
/** Mesma ideia: menos pedidos à fortnite-api no cartão da grelha. */
const FORTNITE_LISTING_PREVIEW_CAP = 4;

// ─── LoL Card ───
export const LolCard = memo(({ item, champKeyMap, priceLabel, queryClient }: { item: LztItem; champKeyMap: Map<number, string>; priceLabel: string; queryClient: QueryClient }) => {
  const rankText = item.riot_lol_rank || "Unranked";
  const rankFilterId = lolRankToFilterId(rankText);
  const rankFilterData = lolRankFilters.find(r => r.id === rankFilterId);
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
      if (results.length >= LOL_LISTING_PREVIEW_CAP) break;
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
        if (results.length >= LOL_LISTING_PREVIEW_CAP) break;
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
        ) : hasLolInventoryData && !champKeyMapReady ? (
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0 w-full h-full">
            {Array.from({ length: 4 }).map((_, i) => (
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
export const FortniteCard = memo(({ item, skinsDb, priceLabel, queryClient }: { item: LztItem; skinsDb: Map<string, FortniteCosmeticDbRow>; priceLabel: string; queryClient: QueryClient }) => {
  const vbucks = (item.fortnite_balance || item.fortnite_vbucks) ?? 0;
  const skinCount = item.fortnite_skin_count ?? 0;
  const level = item.fortnite_level ?? 0;

  const cleanedTitle = getListingCardTitle(item, "fortnite");

  // fortniteSkins: ordem LZT → reordenamos por raridade + temporada (OG) antes de mostrar miniaturas no card
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
    return rows.slice(0, FORTNITE_LISTING_PREVIEW_CAP);
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
        ) : skinsDb.size === 0 && skinCount > 0 ? (
          /* Skeleton while Fortnite API loads */
          <div className="relative z-[1] grid grid-cols-2 grid-rows-2 gap-0.5 sm:gap-1 p-1.5 sm:p-2 w-full h-full place-items-center">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-full h-full rounded bg-secondary/50 animate-pulse" />
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
export const MinecraftCard = memo(({ item, priceLabel, queryClient }: { item: LztItem; priceLabel: string; queryClient: QueryClient }) => {
  const nickname = item.minecraft_nickname;
  const hasJava = (item.minecraft_java ?? 0) > 0;
  const hasBedrock = (item.minecraft_bedrock ?? 0) > 0;
  const hypixelRank = item.minecraft_hypixel_rank;
  const hypixelLevel = item.minecraft_hypixel_level ?? 0;
  const capes = item.minecraft_capes_count ?? 0;
  const banned = (item.minecraft_hypixel_ban ?? 0) > 0;

  const cleanedTitle = getListingCardTitle(item, "minecraft");

  // mineskin.eu avatar (head render): much lighter than body/120 while still identifiable.
  // Use direct mineskin URL to avoid extra lzt-market image-proxy roundtrips/failures on Minecraft cards.
  const skinUrl = nickname
    ? `https://mineskin.eu/helm/${encodeURIComponent(nickname)}/64.png`
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
          <div className="relative z-[1] flex items-end justify-center h-full w-full pt-2 pb-1">
            <SmoothImg
              src={skinUrl}
              alt={nickname || "Skin"}
              className="h-full w-auto object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105"
              onError={hideImgOnError}
            />
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

// ─── Brawl Stars (Supercell / LZT) ───
const BRAWL_CARD_ACCENT = "hsl(32,96%,52%)";

export const BrawlStarsCard = memo(({ item, priceLabel, queryClient }: { item: LztItem; priceLabel: string; queryClient: QueryClient }) => {
  const raw = item as unknown as Record<string, unknown>;
  const br = brawlersCountFromLztItem(raw);
  const cups = brawlTrophiesFromLztItem(raw);
  const lvl = brawlLevelFromLztItem(raw);
  const cleanedTitle = getListingCardTitle(
    {
      ...item,
      brawlers_count: br,
      brawl_cups: cups,
      brawl_level: lvl,
    },
    "brawlstars",
  );

  const brawlPreview = useMemo(() => {
    const brawlers = extractBrawlBrawlerNames(raw);
    const cells: { src: string; alt: string }[] = [];
    for (const n of brawlers) {
      const u = brawlifyAvatarUrl(n);
      if (u) cells.push({ src: getProxiedImageUrl(u), alt: n });
      if (cells.length >= 6) break;
    }
    if (cells.length === 0) {
      for (const u of extractLztItemImageUrls(raw, 6)) {
        cells.push({ src: getProxiedImageUrl(u), alt: "Brawl Stars" });
      }
    }
    return cells;
  }, [raw]);

  return (
    <Link
      to={`/brawlstars/${item.item_id}`}
      onPointerEnter={() => prefetchAccountDetail(queryClient, "brawlstars", item.item_id)}
      className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-200 flex flex-col h-full no-underline text-inherit"
      style={{ "--hover-shadow": `0 0 24px ${BRAWL_CARD_ACCENT}18` } as CSSProperties}
      onMouseEnter={(e) => setBorderAndBoxShadow(e, `${BRAWL_CARD_ACCENT}80`, `0 4px 24px ${BRAWL_CARD_ACCENT}15`)}
      onMouseLeave={clearBorderAndBoxShadow}
    >
      <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${BRAWL_CARD_ACCENT}12, transparent 70%)` }} />
        {brawlPreview.length === 0 ? (
          <div className="relative z-[1] flex flex-col items-center justify-center gap-1 px-2 text-center">
            <Trophy className="h-10 w-10 opacity-25" style={{ color: BRAWL_CARD_ACCENT }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BRAWL_CARD_ACCENT }}>
              Brawl Stars
            </span>
          </div>
        ) : brawlPreview.length === 1 ? (
          <div className="relative z-[1] flex h-full w-full items-center justify-center p-1">
            <SmoothImg
              src={brawlPreview[0].src}
              alt={brawlPreview[0].alt}
              className="h-full w-full object-contain"
              onError={hideImgOnError}
            />
          </div>
        ) : brawlPreview.length === 2 ? (
          <div className="relative z-[1] grid h-full w-full grid-cols-2 gap-0">
            {brawlPreview.map((c, i) => (
              <div key={i} className="relative overflow-hidden">
                <SmoothImg src={c.src} alt={c.alt} className="h-full w-full object-cover object-center" onError={hideImgOnError} />
              </div>
            ))}
          </div>
        ) : brawlPreview.length <= 4 ? (
          <div className="relative z-[1] grid h-full w-full grid-cols-2 grid-rows-2 gap-0">
            {brawlPreview.map((c, i) => (
              <div key={i} className="relative overflow-hidden">
                <SmoothImg src={c.src} alt={c.alt} className="h-full w-full object-cover object-center" onError={hideImgOnError} />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative z-[1] grid h-full w-full grid-cols-3 grid-rows-2 gap-0">
            {brawlPreview.map((c, i) => (
              <div key={i} className="relative overflow-hidden">
                <SmoothImg src={c.src} alt={c.alt} className="h-full w-full object-cover object-center" onError={hideImgOnError} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/40 border-b border-border/20">
        <div className="flex flex-wrap items-center gap-1">
          {lvl > 0 && (
            <span
              className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white"
              style={{ background: BRAWL_CARD_ACCENT }}
            >
              Nv.{lvl}
            </span>
          )}
          {cups > 0 && (
            <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold bg-secondary text-foreground">
              {cups.toLocaleString("pt-BR")} troféus
            </span>
          )}
        </div>
        <span className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground">{br} brawlers</span>
      </div>
      <div className="p-2.5 sm:p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: `${BRAWL_CARD_ACCENT}14`, border: `1px solid ${BRAWL_CARD_ACCENT}33` }}>
          <svg className="h-3 w-3 flex-shrink-0 text-positive" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <span className="text-[9px] sm:text-[11px] font-semibold text-positive">Full Acesso · Entrega Automática</span>
        </div>
        <div className="mt-auto pt-1.5 border-t border-border/30">
          <h3 className="text-[11px] sm:text-xs font-semibold text-foreground line-clamp-2 text-balance leading-snug tracking-tight mb-1">
            {cleanedTitle}
          </h3>
          <p className="text-sm sm:text-base font-bold text-positive tracking-tight">{priceLabel}</p>
          <span className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg bg-foreground py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-background">
            Explorar detalhes <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </Link>
  );
});
BrawlStarsCard.displayName = "BrawlStarsCard";

// ─── miHoYo (Genshin / Honkai / ZZZ) — listagem Contas ───
const MIHOYO_ACCENT: Record<MihoyoCardVariant, string> = {
  genshin: GS_CYAN,
  honkai: HS_VIOLET,
  zzz: ZZZ_AMBER,
};

const MIHOYO_ROUTE: Record<MihoyoCardVariant, string> = {
  genshin: "genshin",
  honkai: "honkai",
  zzz: "zzz",
};

const MIHOYO_LABEL: Record<MihoyoCardVariant, string> = {
  genshin: "Genshin",
  honkai: "Honkai",
  zzz: "ZZZ",
};

export const MihoyoListingCard = memo(
  ({
    item,
    variant,
    priceLabel,
    queryClient,
  }: {
    item: LztItem;
    variant: MihoyoCardVariant;
    priceLabel: string;
    queryClient: QueryClient;
  }) => {
    const raw = item as unknown as Record<string, unknown>;
    const accent = MIHOYO_ACCENT[variant];
    const routeSeg = MIHOYO_ROUTE[variant];
    const cleanedTitle = getListingCardTitle(item, variant);

    const previews = useMemo(() => {
      return extractMihoyoCardPreviews(raw, variant).slice(0, 6).map((u) => getProxiedImageUrl(u));
    }, [raw, variant]);

    const shortLabel = MIHOYO_LABEL[variant];

    return (
      <Link
        to={`/${routeSeg}/${item.item_id}`}
        onPointerEnter={() => prefetchAccountDetail(queryClient, variant, item.item_id)}
        className="group touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-200 flex flex-col h-full no-underline text-inherit"
        style={{ "--hover-shadow": `0 0 24px ${accent}18` } as CSSProperties}
        onMouseEnter={(e) => setBorderAndBoxShadow(e, `${accent}80`, `0 4px 24px ${accent}15`)}
        onMouseLeave={clearBorderAndBoxShadow}
      >
        <div className="relative flex h-28 sm:h-36 items-center justify-center overflow-hidden bg-secondary/20">
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${accent}14, transparent 70%)` }} />
          {previews.length === 0 ? (
            <div className="relative z-[1] flex flex-col items-center justify-center gap-1 px-2 text-center">
              <Sparkles className="h-10 w-10 opacity-25" style={{ color: accent }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                {shortLabel}
              </span>
            </div>
          ) : previews.length === 1 ? (
            <div className="relative z-[1] flex h-full w-full items-center justify-center p-1">
              <SmoothImg
                src={previews[0]}
                alt=""
                className="h-full w-full object-contain"
                onError={hideImgOnError}
              />
            </div>
          ) : previews.length === 2 ? (
            <div className="relative z-[1] grid h-full w-full grid-cols-2 gap-0">
              {previews.map((src, i) => (
                <div key={i} className="relative overflow-hidden">
                  <SmoothImg src={src} alt="" className="h-full w-full object-cover object-center" onError={hideImgOnError} />
                </div>
              ))}
            </div>
          ) : previews.length <= 4 ? (
            <div className="relative z-[1] grid h-full w-full grid-cols-2 grid-rows-2 gap-0">
              {previews.map((src, i) => (
                <div key={i} className="relative overflow-hidden">
                  <SmoothImg src={src} alt="" className="h-full w-full object-cover object-center" onError={hideImgOnError} />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative z-[1] grid h-full w-full grid-cols-3 grid-rows-2 gap-0">
              {previews.map((src, i) => (
                <div key={i} className="relative overflow-hidden">
                  <SmoothImg src={src} alt="" className="h-full w-full object-cover object-center" onError={hideImgOnError} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/40 border-b border-border/20">
          <span className="rounded px-1 py-0.5 text-[8px] sm:text-[10px] font-bold text-white" style={{ background: accent }}>
            {shortLabel}
          </span>
          <span className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground">HoYoverse</span>
        </div>
        <div className="p-2.5 sm:p-3 flex flex-col flex-1 gap-1.5">
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: `${accent}14`, border: `1px solid ${accent}33` }}>
            <svg className="h-3 w-3 flex-shrink-0 text-positive" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-[9px] sm:text-[11px] font-semibold text-positive">Full Acesso · Entrega Automática</span>
          </div>
          <div className="mt-auto pt-1.5 border-t border-border/30">
            <h3 className="text-[11px] sm:text-xs font-semibold text-foreground line-clamp-2 text-balance leading-snug tracking-tight mb-1">
              {cleanedTitle}
            </h3>
            <p className="text-sm sm:text-base font-bold text-positive tracking-tight">{priceLabel}</p>
            <span className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-lg bg-foreground py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-background">
              Explorar detalhes <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </Link>
    );
  },
);
MihoyoListingCard.displayName = "MihoyoListingCard";

