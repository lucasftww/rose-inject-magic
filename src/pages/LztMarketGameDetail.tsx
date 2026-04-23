import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { checkLztAvailability } from "@/lib/lztAvailability";
import { fetchLztAccountDetail, LZT_ACCOUNT_DETAIL_STALE_MS } from "@/lib/lztAccountDetailFetch";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";
import { LztAccountDetailErrorPanel } from "@/components/LztAccountDetailErrorPanel";
import { useLztAccountDetailGoneNotifier } from "@/hooks/useLztAccountDetailGoneNotifier";
import { getListingCardTitle, type LztGameKind } from "@/lib/lztDisplayTitles";
import { getProxiedImageUrl, cleanLztDescription } from "@/lib/lztImageProxy";
import {
  extractLztItemImageUrls,
  extractBrawlBrawlerNames,
  brawlifyAvatarUrl,
} from "@/lib/contasLztVisualAssets";
import { GS_CYAN, HS_VIOLET, ZZZ_AMBER, BRAWL_GOLD } from "@/lib/contasGameAccents";
import type { GameCategory } from "@/hooks/useLztMarkup";

type RouteCfg = {
  gameType: GameCategory;
  gameKind: LztGameKind;
  label: string;
  accent: string;
};

const ROUTE_BY_SEGMENT: Record<string, RouteCfg> = {
  genshin: { gameType: "genshin", gameKind: "genshin", label: "Genshin Impact", accent: GS_CYAN },
  honkai: { gameType: "honkai", gameKind: "honkai", label: "Honkai: Star Rail", accent: HS_VIOLET },
  zzz: { gameType: "zzz", gameKind: "zzz", label: "Zenless Zone Zero", accent: ZZZ_AMBER },
  brawlstars: { gameType: "brawlstars", gameKind: "brawlstars", label: "Brawl Stars", accent: BRAWL_GOLD },
};

function firstPathSegment(pathname: string): string {
  const p = pathname.replace(/^\/+|\/+$/g, "");
  const i = p.indexOf("/");
  return i === -1 ? p : p.slice(0, i);
}

/**
 * Detalhe LZT para Genshin / Honkai / ZZZ / Brawl Stars — mesma edge `lzt-market?action=detail`.
 */
const LztMarketGameDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const seg = firstPathSegment(pathname);
  const cfg = ROUTE_BY_SEGMENT[seg];
  const { getPrice, getDisplayPrice } = useLztMarkup();
  const { addItem } = useCart();
  const queryClient = useQueryClient();
  const [lockedPriceBrl, setLockedPriceBrl] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    setLockedPriceBrl(null);
  }, [id, seg]);

  const { data, isLoading, error } = useQuery({
    queryKey: lztAccountDetailQueryKey(cfg?.gameType ?? "genshin", id ?? ""),
    queryFn: ({ signal }) => fetchLztAccountDetail(cfg!.gameType, id!, signal),
    enabled: !!id && !!cfg,
    staleTime: LZT_ACCOUNT_DETAIL_STALE_MS,
    retry: false,
  });

  useLztAccountDetailGoneNotifier(cfg?.gameType ?? "genshin", id, error);

  const item = data?.item as Record<string, unknown> | undefined;
  const itemId = item?.item_id != null ? String(item.item_id) : "";

  const title = useMemo(() => {
    if (!item || !cfg) return "Conta";
    return getListingCardTitle(item as never, cfg.gameKind);
  }, [item, cfg]);

  useEffect(() => {
    if (item && cfg && lockedPriceBrl === null) {
      setLockedPriceBrl(
        getPrice(
          {
            price: Number(item.price),
            price_currency: String(item.price_currency || "rub"),
            price_brl: typeof item.price_brl === "number" ? item.price_brl : undefined,
          },
          cfg.gameType,
        ),
      );
    }
  }, [item, cfg, getPrice, lockedPriceBrl]);

  const galleryUrls = useMemo(() => {
    if (!item) return [];
    if (cfg?.gameType === "brawlstars") {
      const names = extractBrawlBrawlerNames(item);
      return names
        .map(brawlifyAvatarUrl)
        .filter(Boolean)
        .slice(0, 12)
        .map((u) => getProxiedImageUrl(u));
    }
    return extractLztItemImageUrls(item, 16).map((u) => getProxiedImageUrl(u));
  }, [item, cfg?.gameType]);

  const description = cleanLztDescription(item?.description);

  const handleBuy = async () => {
    if (!item || !cfg || lockedPriceBrl === null) return;
    setCheckingAvailability(true);
    const ok = await checkLztAvailability(itemId, cfg.gameType, { queryClient });
    setCheckingAvailability(false);
    if (!ok) return;

    const added = addItem({
      productId: `lzt-${itemId}`,
      productName: title,
      productImage: galleryUrls[0] ?? null,
      planId: "lzt-account",
      planName: `Conta ${cfg.label}`,
      price: lockedPriceBrl,
      type: "lzt-account",
      lztItemId: itemId,
      lztPrice: Number(item.price),
      lztCurrency: String(item.price_currency || "rub"),
      lztGame: cfg.gameType,
    });
    if (added) navigate("/checkout");
  };

  if (!cfg) {
    return (
      <div className="min-h-dvh bg-background">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted-foreground">
          <p>Rota inválida.</p>
          <Link to="/contas" className="mt-4 inline-block text-primary underline">
            Voltar às contas
          </Link>
        </div>
      </div>
    );
  }

  const accent = cfg.accent;

  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          type="button"
          onClick={() => navigate(`/contas?game=${cfg.gameType}`)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar às contas
        </button>

        {isLoading && (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && error && (
          <LztAccountDetailErrorPanel
            error={error}
            backTo={`/contas?game=${cfg.gameType}`}
            backLabel="Voltar às contas"
          />
        )}

        {!isLoading && !error && item && (
          <>
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground" style={{ color: accent }}>
                {cfg.label}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
              <p className="mt-4 text-3xl font-bold text-positive">
                {getDisplayPrice(
                  {
                    price: Number(item.price),
                    price_currency: String(item.price_currency || "rub"),
                    price_brl: typeof item.price_brl === "number" ? item.price_brl : undefined,
                  },
                  cfg.gameType,
                )}
              </p>

              {galleryUrls.length > 0 && (
                <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {galleryUrls.map((src, i) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-lg border border-border/40 bg-secondary/20">
                      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
              )}

              {description && (
                <div className="mt-8 rounded-xl border border-border/50 bg-secondary/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </div>
              )}

              <button
                type="button"
                disabled={checkingAvailability || lockedPriceBrl === null}
                onClick={() => void handleBuy()}
                className="mt-10 flex w-full min-h-12 items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white transition-opacity disabled:opacity-50"
                style={{ background: accent }}
              >
                {checkingAvailability ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShoppingCart className="h-5 w-5" />
                )}
                Comprar agora
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LztMarketGameDetail;
