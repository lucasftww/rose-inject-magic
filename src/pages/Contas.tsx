import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useDeferredValue,
  type CSSProperties,
  type FocusEvent,
} from "react";
import { useLztMarkup, getLztItemBrlPrice, type GameCategory } from "@/hooks/useLztMarkup";
import Header from "@/components/Header";
import { ChevronLeft, ChevronRight, ChevronDown, Search, SlidersHorizontal, DollarSign, Crosshair, Loader2, RefreshCw, Globe, TrendingUp, Star, Trophy, AlertTriangle, X } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import { throwApiError } from "@/lib/apiErrors";

import {
  rankFerro, rankBronze, rankPrata, rankOuro, rankPlatina,
  rankDiamante, rankAscendente, rankImortal, rankRadianteNew as rankRadiante,
  rankUnranked, fetchAllValorantSkins,
} from "@/lib/valorantData";
import { type FortniteCosmeticDbRow } from "@/lib/fortniteCosmeticSort";
import { fetchFortniteCosmeticsBrMap } from "@/lib/fortniteCosmeticsFetch";
import { fetchLolChampKeyMap } from "@/lib/lolChampKeyMapFetch";
import { setLinkAccentHover, clearLinkAccentHover } from "@/lib/domEventHelpers";
import { errorName } from "@/lib/errorMessage";
import { LZT_ACCOUNT_DETAIL_GONE_EVENT } from "@/lib/lztPrefetch";
import {
  gameTabFromSearchParams,
  type GameTab,
  type LztItem,
  type LztMarketListResponse,
} from "@/lib/contasMarketTypes";
import { fetchAccountsRaw, lztMarketListQuerySignature, waitWithAbort } from "@/lib/contasMarketFetch";
import { isContasPerfDiagEnabled } from "@/lib/contasPerfDiag";
import { isLikelyWrongGameInLolList } from "@/lib/contasLolFilter";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { lolRankFilters } from "@/lib/contasLolRankFilters";
import { FN_PURPLE, FN_BLUE, MC_GREEN } from "@/lib/contasGameAccents";
import {
  ValorantCard,
  LolCard,
  FortniteCard,
  MinecraftCard,
} from "@/components/contas/ContasListingCards";

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

// LoL rank filters: `@/lib/contasLolRankFilters` (cartões + UI de filtro)

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

/** Parâmetro `order_by` enviado à LZT.
 * Para performance, pedimos sempre por data (mais recente) e aplicamos sort de preço no cliente.
 */
function listOrderByForLztApi(uiSort: string): string {
  const normalized = normalizeListSortParam(uiSort);
  if (normalized === "price_to_up" || normalized === "price_to_down") {
    return "pdate_to_down";
  }
  return normalized;
}

function createAttemptSignal(parent: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  parent.addEventListener("abort", onParentAbort, { once: true });
  const timerId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      window.clearTimeout(timerId);
      parent.removeEventListener("abort", onParentAbort);
    },
  };
}

// ─── Data fetchers ───

// RARITY_PRIORITY, SkinEntry, fetchAllValorantSkins imported from @/lib/valorantData

/** Após mostrar lista do prefetch na troca de aba: atrasa o GET de reconciliação para não competir com paint/chunk. */
const CONTAS_RECONCILE_AFTER_PREFETCH_MS = 450;
/** Prefetch de aba adjacente só depois de estabilizar a interação inicial. */
const CONTAS_ADJACENT_PREFETCH_DELAY_MS = 2800;
/** Janela mínima sem mudança de filtros/aba antes de disparar prefetch de aba adjacente. */
const CONTAS_PREFETCH_STABLE_WINDOW_MS = 2000;
/** Se o utilizador trocar de aba logo após prefetch, não reconciliar imediatamente para evitar fetch descartado. */
const CONTAS_RECONCILE_TAB_GUARD_MS = 1000;
/** Modo agressivo: só ativa warmup de abas com `?warm=1` explícito para teste. */
const CONTAS_ENABLE_ADJACENT_PREFETCH =
  typeof window !== "undefined" &&
  (() => {
    try {
      return new URLSearchParams(window.location.search).get("warm") === "1";
    } catch {
      return false;
    }
  })();

/** Funde mudanças de `debouncedParamsKey` no mesmo burst (hidratação, sync URL→estado, debounces curtos). */
const CONTAS_LIST_FETCH_KEY_COALESCE_MS = 450;
const CONTAS_NON_SEARCH_DEBOUNCE_MS = 320;

function listAttemptTimeoutMs(tab: GameTab, light: boolean): number {
  // Mantém UX responsiva: falha mais rápido e deixa cache/fallback assumirem.
  if (tab === "minecraft") return light ? 11000 : 13000;
  return light ? 7000 : 9500;
}

const Contas = () => {
  const queryClient = useQueryClient();
  const { getDisplayPrice } = useLztMarkup();
  const [searchParams, setSearchParams] = useSearchParams();
  const [gameTab, setGameTab] = useState<GameTab>(() => gameTabFromSearchParams(searchParams));

  // URL → estado antes do fetch da lista: layout effects antes do GET; `listFetchKey` coalesce (~340ms)
  // absorve rajadas de `debouncedParamsKey` (hidratação/sync) e reduz `lzt-market` cancelado na rede.
  useLayoutEffect(() => {
    const tab = gameTabFromSearchParams(searchParams);
    setGameTab((prev) => (prev === tab ? prev : tab));
  }, [searchParams]);

  // Aba Steam removida: links antigos ?game=steam → Valorant (preserva outros query params)
  useLayoutEffect(() => {
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

  // Meta Pixel: conversões personalizadas "IC - Contas - *" dependem de trackCustom (IC_SECTION_CONTAS + IC_CATEGORY_*).
  useEffect(() => {
    void import("@/lib/metaPixel").then(({ trackContasSectionCustomEvent }) => {
      trackContasSectionCustomEvent();
    });
  }, []);

  useEffect(() => {
    void import("@/lib/metaPixel").then(({ trackContasCategoryCustomEvent }) => {
      trackContasCategoryCustomEvent(gameTab);
    });
  }, [gameTab]);

  // Console: localhost sempre; produção com `?perf=1` (ex.: medir chunk vs lzt-market em royalstorebr.com).
  useEffect(() => {
    if (!isContasPerfDiagEnabled()) return;
    const id = requestAnimationFrame(() => {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      for (const e of entries) {
        if (e.initiatorType !== "script") continue;
        if (!/contas/i.test(e.name)) continue;
        let tail = e.name;
        try {
          const d = decodeURIComponent(e.name);
          const i = d.lastIndexOf("/");
          tail = i >= 0 ? d.slice(Math.max(0, i - 24)) : d;
        } catch {
          /* keep raw */
        }
        console.info("[Contas perf] chunk (resource)", `${Math.round(e.duration)} ms`, tail);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [searchParams]);

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
  /** Preço na API: debounce para não disparar 1 fetch LZT por dígito em pmin/pmax. */
  const [debouncedPriceMin, setDebouncedPriceMin] = useState(() => qp("pmin"));
  const [debouncedPriceMax, setDebouncedPriceMax] = useState(() => qp("pmax"));
  const [sortBy, setSortBy] = useState<string>(() => normalizeListSortParam(qp("sort", "pdate_to_down")));

  const flushPriceDebounceToApi = useCallback(() => {
    setDebouncedPriceMin(priceMin);
    setDebouncedPriceMax(priceMax);
  }, [priceMin, priceMax]);

  useEffect(() => {
    if (priceMin === debouncedPriceMin && priceMax === debouncedPriceMax) return;
    const id = window.setTimeout(() => {
      setDebouncedPriceMin(priceMin);
      setDebouncedPriceMax(priceMax);
    }, 280);
    return () => window.clearTimeout(id);
  }, [priceMin, priceMax, debouncedPriceMin, debouncedPriceMax]);

  const priceFieldBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = "";
      flushPriceDebounceToApi();
    },
    [flushPriceDebounceToApi],
  );

  // ?sort= na URL: voltar/avançar e links com valor inválido.
  // Só reagir a `searchParams` (não incluir `sortBy`): com `sortBy` nas deps, ao clicar num filtro o
  // URL ainda não tinha `sort=…` e `normalizeListSortParam(null)` virava `pdate_to_down`, repor o
  // estado e anulava o clique.
  useLayoutEffect(() => {
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

  const [coarsePointer, setCoarsePointer] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarsePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const navConn =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
      : undefined;
  const saveData = Boolean(navConn?.saveData);
  const slowNetwork =
    saveData || navConn?.effectiveType === "2g" || navConn?.effectiveType === "slow-2g";
  const lightDevice = coarsePointer || slowNetwork;
  const listSearchDebounceMs = lightDevice ? 480 : 280;
  const urlSearchDebounceMs = lightDevice ? 520 : 320;
  const searchQueryForUrl = useDebouncedValue(searchQuery, urlSearchDebounceMs);
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
  useLayoutEffect(() => {
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
      set("q", searchQueryForUrl);
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
    gameTab, searchQueryForUrl, sortBy, priceMin, priceMax,
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
  /** Reconciliação pós-prefetch (agendada): limpar ao mudar filtros/aba ou ao desmontar. */
  const prefetchReconcileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** GET de reconciliação separado do `abortRef` da lista — evita partilhar o mesmo signal que o efeito principal aborta. */
  const prefetchReconcileAbortRef = useRef<AbortController | null>(null);
  const clearPrefetchReconcileSchedule = useCallback(() => {
    if (prefetchReconcileTimeoutRef.current !== null) {
      clearTimeout(prefetchReconcileTimeoutRef.current);
      prefetchReconcileTimeoutRef.current = null;
    }
    prefetchReconcileAbortRef.current?.abort();
    prefetchReconcileAbortRef.current = null;
  }, []);
  /** Número de requests lzt-market em voo (lista/reconciliação/prefetch). */
  const listMarketInFlightRef = useRef(0);
  /** Última interação que altera filtros/aba/lista (para estabilidade antes de prefetch). */
  const lastUserListInteractionAtRef = useRef(Date.now());
  const lastGameTabChangeAtRef = useRef(Date.now());
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

  // ─── Asset maps (por aba): arranca em paralelo ao 1º GET `lzt-market` — mesma ideia LoL/DDragon (HTTP/2 multiplex).
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
    queryFn: fetchFortniteCosmeticsBrMap,
    staleTime: 1000 * 60 * 60 * 6,
    enabled: gameTab === "fortnite",
  });

  const buildParams = useCallback((pageNum: number = 1): Record<string, string | string[]> => {
    const params: Record<string, string | string[]> = {};
    params.page = String(pageNum);
    // Ordenação LZT: preço reordenado no edge com price_brl; custo-benefício → pdate (sort só no cliente).
    params.order_by = lztListOrderBy;
    if (searchQuery) params.title = searchQuery;

    // Send price filters to API (debounced — evita rajada de pedidos ao digitar a faixa)
    if (debouncedPriceMin && Number(debouncedPriceMin) > 0) params.pmin = debouncedPriceMin;
    if (debouncedPriceMax && Number(debouncedPriceMax) > 0) params.pmax = debouncedPriceMax;

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
  }, [searchQuery, onlyKnife, selectedRank, selectedWeapon, debouncedInvMin, debouncedInvMax, lvlMin, lvlMax, gameTab, lolRank, lolChampMin, lolSkinsMin, fnVbMin, fnSkinsMin, mcJava, mcBedrock, mcHypixelLvlMin, mcCapesMin, mcNoBan, lolRegion, valRegion, lztListOrderBy, debouncedPriceMin, debouncedPriceMax]);

  const paramsKey = `${lztMarketListQuerySignature(buildParams(1))}\0${gameTab}`;
  useEffect(() => {
    lastUserListInteractionAtRef.current = Date.now();
  }, [paramsKey]);
  useEffect(() => {
    lastGameTabChangeAtRef.current = Date.now();
  }, [gameTab]);

  const fetchAccountsRawTracked = useCallback(
    async (
      params: Record<string, string | string[]>,
      signal?: AbortSignal,
    ): Promise<LztMarketListResponse> => {
      listMarketInFlightRef.current += 1;
      try {
        return await fetchAccountsRaw(params, signal);
      } finally {
        listMarketInFlightRef.current = Math.max(0, listMarketInFlightRef.current - 1);
      }
    },
    [],
  );

  // Debounce: busca por título (280ms desktop / ~480ms touch ou rede lenta), inventário Valorant (420ms), faixa de preço. Resto dispara fetch na hora.
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
        pmin: debouncedPriceMin,
        pmax: debouncedPriceMax,
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
      debouncedPriceMin,
      debouncedPriceMax,
      debouncedInvMin,
      debouncedInvMax,
      lvlMin,
      lvlMax,
      fnVbMin,
      fnSkinsMin,
    ],
  );
  const [debouncedParamsKey, setDebouncedParamsKey] = useState(paramsKey);
  /** Chave usada para cache + GET da lista — atrás de um debounce curto para absorver rajadas. */
  const [listFetchKey, setListFetchKey] = useState(paramsKey);
  const listFetchKeyCommittedRef = useRef(paramsKey);
  const listFetchKeyCoalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debouncedParamsKey === listFetchKeyCommittedRef.current) return;
    if (listFetchKeyCoalesceTimerRef.current) {
      clearTimeout(listFetchKeyCoalesceTimerRef.current);
      listFetchKeyCoalesceTimerRef.current = null;
    }
    listFetchKeyCoalesceTimerRef.current = setTimeout(() => {
      listFetchKeyCoalesceTimerRef.current = null;
      listFetchKeyCommittedRef.current = debouncedParamsKey;
      setListFetchKey(debouncedParamsKey);
    }, CONTAS_LIST_FETCH_KEY_COALESCE_MS);
    return () => {
      if (listFetchKeyCoalesceTimerRef.current) {
        clearTimeout(listFetchKeyCoalesceTimerRef.current);
        listFetchKeyCoalesceTimerRef.current = null;
      }
    };
  }, [debouncedParamsKey]);

  const prevNonSearchRef = useRef(nonSearchParamsKey);
  const prevSearchTrimRef = useRef(searchQuery.trim());
  const nonSearchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Non-search filter changes: short debounce to absorb hydration/sync bursts and cut canceled requests.
    if (prevNonSearchRef.current !== nonSearchParamsKey) {
      prevNonSearchRef.current = nonSearchParamsKey;
      if (nonSearchDebounceTimerRef.current) {
        clearTimeout(nonSearchDebounceTimerRef.current);
        nonSearchDebounceTimerRef.current = null;
      }
      nonSearchDebounceTimerRef.current = setTimeout(() => {
        nonSearchDebounceTimerRef.current = null;
        setDebouncedParamsKey(paramsKey);
      }, CONTAS_NON_SEARCH_DEBOUNCE_MS);
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
    // Search text changed: debounce (maior no touch/rede lenta — menos pedidos LZT e menos abort/retry)
    const handler = setTimeout(() => setDebouncedParamsKey(paramsKey), listSearchDebounceMs);
    return () => {
      clearTimeout(handler);
      if (nonSearchDebounceTimerRef.current) {
        clearTimeout(nonSearchDebounceTimerRef.current);
        nonSearchDebounceTimerRef.current = null;
      }
    };
  }, [paramsKey, nonSearchParamsKey, searchQuery, debouncedParamsKey, listSearchDebounceMs]);

  const fetchWithRetry = useCallback(
    async (
      params: Record<string, string | string[]>,
      controller: AbortController,
      retries = lightDevice ? 0 : 1
    ): Promise<LztMarketListResponse> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (controller.signal.aborted) throw new Error("aborted");
      const timeoutMs = listAttemptTimeoutMs(gameTab, lightDevice);
      const attemptSignal = createAttemptSignal(controller.signal, timeoutMs);
      try {
        return await fetchAccountsRawTracked(params, attemptSignal.signal);
      } catch (err: unknown) {
        const errName = errorName(err);
        const parentAborted = controller.signal.aborted;
        const attemptTimedOut = attemptSignal.didTimeout();
        if (parentAborted || (errName === "AbortError" && !attemptTimedOut)) throw err;

        if (err instanceof ApiError) {
          const retryable =
            err.status === 429 || (err.status >= 502 && err.status <= 504) || err.status === 524;
          if (retryable && attempt < retries) {
            const delay =
              err.status === 429 ? 1200 + 900 * attempt : 400 * Math.pow(2, attempt);
            await waitWithAbort(delay, controller.signal);
            continue;
          }
          if (err.status === 404) {
            throw new Error("O serviço de mercado não foi encontrado. Verifique a configuração da Supabase.");
          }
          throwApiError(err.status || 500);
        }

        if (attempt >= retries) throw err;
        await waitWithAbort(400 * Math.pow(2, attempt), controller.signal);
      } finally {
        attemptSignal.cleanup();
      }
    }
    throw new Error("fetchWithRetry: retries exhausted");
  },
    [lightDevice, fetchAccountsRawTracked, gameTab],
  );

  const fetchMultiplePages = useCallback(async (controller: AbortController) => {
    const cacheKey = listFetchKey;
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

      // LZT API in maintenance — show friendly error instead of empty list
      if (data?.fallback) {
        setStreamError(new Error("O marketplace de contas está em manutenção temporária. Tente novamente em alguns minutos."));
        setStreamingDone(true);
        return;
      }

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
  }, [buildParams, listFetchKey, fetchWithRetry, cacheSet, gameTab]);

  // Prefetch only the next game tab (ring order) to cut background egress; dedupe per tab per session.
  const prefetchRef = useRef(new Set<string>());
  const prefetchTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prefetchRunIdRef = useRef(0);

  const canRunAdjacentPrefetch = useMemo(() => {
    if (!CONTAS_ENABLE_ADJACENT_PREFETCH) return false;
    if (lightDevice) return false;
    if (searchQuery.trim() !== "") return false;
    if (sortBy !== "pdate_to_down") return false;
    if (priceMin || priceMax || invMin || invMax || lvlMin || lvlMax) return false;

    if (gameTab === "valorant") {
      return selectedRank === "todos" && selectedWeapon === "todos" && !onlyKnife && valRegion === "br";
    }
    if (gameTab === "lol") {
      return lolRank === "todos" && lolRegion === "BR1" && !lolChampMin && !lolSkinsMin;
    }
    if (gameTab === "fortnite") {
      return !fnVbMin && !fnSkinsMin && !fnLevelMin && !fnHasBattlePass;
    }
    if (gameTab === "minecraft") {
      return !mcJava && !mcBedrock && !mcHypixelLvlMin && !mcCapesMin && !mcNoBan;
    }
    return true;
  }, [
    lightDevice,
    searchQuery,
    sortBy,
    priceMin,
    priceMax,
    invMin,
    invMax,
    lvlMin,
    lvlMax,
    gameTab,
    selectedRank,
    selectedWeapon,
    onlyKnife,
    valRegion,
    lolRank,
    lolRegion,
    lolChampMin,
    lolSkinsMin,
    fnVbMin,
    fnSkinsMin,
    fnLevelMin,
    fnHasBattlePass,
    mcJava,
    mcBedrock,
    mcHypixelLvlMin,
    mcCapesMin,
    mcNoBan,
  ]);

  const clearPrefetchTimeouts = useCallback(() => {
    prefetchTimeoutsRef.current.forEach(clearTimeout);
    prefetchTimeoutsRef.current = [];
  }, []);

  const prefetchAdjacentTabs = useCallback(() => {
    clearPrefetchTimeouts();
    prefetchRunIdRef.current += 1;
    const runId = prefetchRunIdRef.current;

    if (!canRunAdjacentPrefetch) return;
    if (listMarketInFlightRef.current > 0) return;
    if (Date.now() - lastUserListInteractionAtRef.current < CONTAS_PREFETCH_STABLE_WINDOW_MS) return;

    // Only prefetch the *next* tab in fixed order (cuts ~3× background list egress vs warming all three).
    const tabOrder: GameTab[] = ["valorant", "lol", "fortnite", "minecraft"];
    const idx = tabOrder.indexOf(gameTab);
    if (idx < 0) return;
    const tab = tabOrder[(idx + 1) % tabOrder.length];

    if (prefetchRef.current.has(tab)) return;
    prefetchRef.current.add(tab);

    const gameTypeMap: Record<GameTab, string> = { valorant: "riot", lol: "lol", fortnite: "fortnite", minecraft: "minecraft" };
    const listParams: Record<string, string | string[]> = {
      page: "1",
      order_by: "pdate_to_down",
      game_type: gameTypeMap[tab],
    };
    if (tab === "fortnite") listParams.smin = "10";
    if (tab === "valorant") listParams["country[]"] = ["Bra"];
    if (tab === "lol") listParams["lol_region[]"] = ["BR1"];

    const timeoutId = setTimeout(() => {
      if (runId !== prefetchRunIdRef.current) return;
      if (listMarketInFlightRef.current > 0) return;
      if (Date.now() - lastUserListInteractionAtRef.current < CONTAS_PREFETCH_STABLE_WINDOW_MS) return;
      void (async () => {
        try {
          const data = await fetchAccountsRawTracked(listParams);
          if (runId !== prefetchRunIdRef.current) return;
          const items: LztItem[] = data?.items ?? [];
          const hasMore = data?.hasNextPage ?? items.length >= 15;
          cacheSet(`__prefetch__${tab}`, { items, hasNextPage: hasMore, currentPage: 1, timestamp: Date.now() });
        } catch { /* silent */ }
      })();
    }, 0);
    prefetchTimeoutsRef.current.push(timeoutId);
  }, [gameTab, cacheSet, clearPrefetchTimeouts, canRunAdjacentPrefetch, fetchAccountsRawTracked]);

  useEffect(() => () => clearPrefetchTimeouts(), [clearPrefetchTimeouts]);

  // Enhanced fetchMultiplePages: check prefetch cache on tab switch
  const fetchMultiplePagesWithPrefetch = useCallback(async (controller: AbortController) => {
    // Check if we have a prefetched result for this game tab
    const prefetchKey = `__prefetch__${gameTab}`;
    const prefetched = fetchCacheRef.current.get(prefetchKey);
    const cacheKey = listFetchKey;
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
      clearPrefetchReconcileSchedule();
      prefetchReconcileTimeoutRef.current = setTimeout(() => {
        prefetchReconcileTimeoutRef.current = null;
        void (async () => {
          prefetchReconcileAbortRef.current?.abort();
          const reconcileController = new AbortController();
          prefetchReconcileAbortRef.current = reconcileController;
          try {
            if (Date.now() - lastGameTabChangeAtRef.current < CONTAS_RECONCILE_TAB_GUARD_MS) return;
            const data = await fetchWithRetry(paramsSnapshot, reconcileController);
            if (reconcileController.signal.aborted) return;
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
          } finally {
            if (prefetchReconcileAbortRef.current === reconcileController) {
              prefetchReconcileAbortRef.current = null;
            }
          }
        })();
      }, CONTAS_RECONCILE_AFTER_PREFETCH_MS);
      return;
    }

    // Fallback to original logic
    await fetchMultiplePages(controller);
  }, [buildParams, listFetchKey, fetchMultiplePages, fetchWithRetry, gameTab, cacheSet, clearPrefetchReconcileSchedule]);

  useEffect(() => {
    abortRef.current?.abort();
    clearPrefetchReconcileSchedule();
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchMultiplePagesWithPrefetch(controller);
    return () => {
      controller.abort();
      loadMoreControllerRef.current?.abort();
      clearPrefetchReconcileSchedule();
    };
  }, [listFetchKey, clearPrefetchReconcileSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger prefetch after initial load completes (delayed so quick bounces do not pull extra list JSON)
  useEffect(() => {
    if (firstPageLoaded && streamedItems.length > 0) {
      const timer = setTimeout(prefetchAdjacentTabs, CONTAS_ADJACENT_PREFETCH_DELAY_MS);
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
      const cacheKey = listFetchKey;
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

  /** Filtra preço com valor adiado — ao digitar pmin/pmax não reprocessa milhares de linhas a cada tecla. */
  const deferredPriceMinList = useDeferredValue(priceMin);
  const deferredPriceMaxList = useDeferredValue(priceMax);

  const allItems = useMemo(() => {
    const fnLvlMin = gameTab === "fortnite" ? Number(fnLevelMin) || 0 : 0;
    const fnBp = gameTab === "fortnite" && fnHasBattlePass;
    const minBrl = Number(deferredPriceMinList);
    const maxBrl = Number(deferredPriceMaxList);
    const hasPriceBand = (Number.isFinite(minBrl) && minBrl > 0) || (Number.isFinite(maxBrl) && maxBrl > 0);
    const needsClientSort = sortBy === "price_to_up" || sortBy === "price_to_down";
    const needsLolStrip = gameTab === "lol";

    if (!needsLolStrip && fnLvlMin <= 0 && !fnBp && !hasPriceBand && !needsClientSort) {
      return streamedItems;
    }

    let filtered = [...streamedItems];
    if (needsLolStrip) {
      filtered = filtered.filter((item) => !isLikelyWrongGameInLolList(item));
    }
    // Fortnite client-side filters (level & battle pass not available as API params)
    if (gameTab === "fortnite") {
      if (fnLvlMin > 0) {
        filtered = filtered.filter((item) => (item.fortnite_level ?? 0) >= fnLvlMin);
      }
      if (fnBp) {
        filtered = filtered.filter((item) => {
          const seasons = item.fortnitePastSeasons;
          return Array.isArray(seasons) && seasons.some((s: Record<string, unknown>) => s.purchasedVIP === true);
        });
      }
    }

    // Region filter is done server-side via country[] / lol_region[].
    // Price filter/sort: compute BRL price once per item to avoid repeated conversion work.
    if (hasPriceBand || needsClientSort) {
      let withPrice = filtered.map((item) => ({ item, brlPrice: getBrlPrice(item) }));
      if (Number.isFinite(minBrl) && minBrl > 0) {
        withPrice = withPrice.filter((row) => row.brlPrice >= minBrl);
      }
      if (Number.isFinite(maxBrl) && maxBrl > 0) {
        withPrice = withPrice.filter((row) => row.brlPrice <= maxBrl);
      }
      if (sortBy === "price_to_up") {
        withPrice.sort((a, b) => a.brlPrice - b.brlPrice);
      } else if (sortBy === "price_to_down") {
        withPrice.sort((a, b) => b.brlPrice - a.brlPrice);
      }
      return withPrice.map((row) => row.item);
    }

    // Default sort (pdate_to_down = "Mais Recentes"): preserve API date order for ALL games.
    // The API already returns items sorted by publication date descending.
    return filtered;
  }, [
    streamedItems,
    sortBy,
    gameTab,
    getBrlPrice,
    fnLevelMin,
    fnHasBattlePass,
    deferredPriceMinList,
    deferredPriceMaxList,
  ]);
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
    clearPrefetchReconcileSchedule();
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
    setDebouncedPriceMin(""); setDebouncedPriceMax("");
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
          name="contas-search"
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
                <input name="contas-only-knife" type="checkbox" checked={onlyKnife} onChange={(e) => { setOnlyKnife(e.target.checked); setDisplayPage(1); }} className="peer sr-only" />
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
            <select name="contas-valorant-region" value={valRegion} onChange={(e) => { setValRegion(e.target.value); setDisplayPage(1); }}
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
            <input name="contas-lol-champ-min" type="number" min="0" placeholder="Ex: 50" value={lolChampMin} onChange={(e) => { setLolChampMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(198,100%,45%,0.5)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-[hsl(198,100%,45%)]" />Mín. Skins LoL
            </p>
            <input name="contas-lol-skins-min" type="number" min="0" placeholder="Ex: 10" value={lolSkinsMin} onChange={(e) => { setLolSkinsMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(198,100%,45%,0.5)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[hsl(198,100%,45%)]" />Região
            </p>
            <select name="contas-lol-region" value={lolRegion} onChange={(e) => { setLolRegion(e.target.value); setDisplayPage(1); }}
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
            <input name="contas-fn-vbucks-min" type="number" min="0" placeholder="Ex: 1000" value={fnVbMin} onChange={(e) => { setFnVbMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${FN_PURPLE}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: FN_PURPLE }} />Mín. Skins
            </p>
            <input name="contas-fn-skins-min" type="number" min="10" placeholder="Mín: 10" value={fnSkinsMin} onChange={(e) => { setFnSkinsMin(e.target.value); setDisplayPage(1); }}
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
            <input name="contas-fn-level-min" type="number" min="0" placeholder="Ex: 100" value={fnLevelMin} onChange={(e) => { setFnLevelMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${FN_PURPLE}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-5">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-3 transition-all"
              style={fnHasBattlePass ? { borderColor: FN_PURPLE, background: `${FN_PURPLE}10` } : {}}>
              <input name="contas-fn-battle-pass" type="checkbox" checked={fnHasBattlePass} onChange={(e) => { setFnHasBattlePass(e.target.checked); setDisplayPage(1); }} className="sr-only" />
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
                <input name="contas-mc-java" type="checkbox" checked={mcJava} onChange={(e) => { setMcJava(e.target.checked); setDisplayPage(1); }} className="sr-only" />
                <div className="h-3.5 w-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: mcJava ? MC_GREEN : undefined, background: mcJava ? MC_GREEN : "transparent" }}>
                  {mcJava && <span className="text-[8px] font-bold text-white">✓</span>}
                </div>
                <span className="text-xs font-medium" style={{ color: mcJava ? MC_GREEN : undefined }}>Java</span>
              </label>
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 transition-all"
                style={mcBedrock ? { borderColor: MC_GREEN, background: `${MC_GREEN}10` } : {}}>
                <input name="contas-mc-bedrock" type="checkbox" checked={mcBedrock} onChange={(e) => { setMcBedrock(e.target.checked); setDisplayPage(1); }} className="sr-only" />
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
            <input name="contas-mc-hypixel-min" type="number" min="0" placeholder="Ex: 50" value={mcHypixelLvlMin} onChange={(e) => { setMcHypixelLvlMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${MC_GREEN}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: MC_GREEN }} />Mín. Capes
            </p>
            <input name="contas-mc-capes-min" type="number" min="0" placeholder="Ex: 1" value={mcCapesMin} onChange={(e) => { setMcCapesMin(e.target.value); setDisplayPage(1); }}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={e => (e.currentTarget.style.borderColor = `${MC_GREEN}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="mt-4">
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input name="contas-mc-no-ban" type="checkbox" checked={mcNoBan} onChange={(e) => { setMcNoBan(e.target.checked); setDisplayPage(1); }} className="peer sr-only" />
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
              <input name="contas-price-min" type="number" min="0" placeholder="Mín" value={priceMin} onChange={(e) => { setPriceMin(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={priceFieldBlur} className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <span className="text-xs text-muted-foreground">—</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <input name="contas-price-max" type="number" min="0" placeholder="Máx" value={priceMax} onChange={(e) => { setPriceMax(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={priceFieldBlur} className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
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
              <input name="contas-inv-min" type="number" min="0" placeholder="Mín" value={invMin} onChange={(e) => { setInvMin(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input name="contas-inv-max" type="number" min="0" placeholder="Máx" value={invMax} onChange={(e) => { setInvMax(e.target.value.slice(0, 7)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
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
              <input name="contas-level-min" type="number" min="0" placeholder="Mín" value={lvlMin} onChange={(e) => { setLvlMin(e.target.value.slice(0, 4)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input name="contas-level-max" type="number" min="0" placeholder="Máx" value={lvlMax} onChange={(e) => { setLvlMax(e.target.value.slice(0, 4)); setDisplayPage(1); }} onFocus={e => (e.currentTarget.style.borderColor = `${accentColor}80`)} onBlur={e => (e.currentTarget.style.borderColor = '')} className="w-full flex-1 rounded-lg border border-border bg-secondary/50 py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-dvh bg-background">
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
            <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto space-y-4 scrollbar-hide">
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
