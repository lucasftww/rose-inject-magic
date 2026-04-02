import { useParams, useNavigate } from "react-router-dom";
import { throwApiError } from "@/lib/apiErrors";
import { useQuery } from "@tanstack/react-query";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import Header from "@/components/Header";
import {
  ArrowLeft,
  Shield,
  ShoppingCart,
  CheckCircle2,
  Zap,
  Trophy,
  Globe,
  History,
  Gamepad2,
  AlertTriangle,
  ExternalLink,
  Swords,
  Search,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { trackViewContent, trackInitiateCheckout } from "@/lib/metaPixel";
import { checkLztAvailability } from "@/lib/lztAvailability";
import {
  formatSteamPlaytime,
  normalizeSteamGamesFromRaw,
  resolveSteamHeroImage,
  type SteamLibGame,
} from "@/lib/steamLzt";

const PROJECT_FALLBACK = "https://cthqzetkshrbsjulfytl.supabase.co";

const getProxiedImageUrl = (url: string) => {
  if (!url) return "";
  if (
    url.includes("lzt.market") ||
    url.includes("img.lzt.market") ||
    url.includes("steamstatic.com") ||
    url.includes("akamaihd.net") ||
    url.includes("capes.dev")
  ) {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL || PROJECT_FALLBACK;
    return `${projectUrl}/functions/v1/lzt-market?action=image-proxy&url=${encodeURIComponent(url)}`;
  }
  return url;
};

const fetchAccountDetail = async (itemId: string) => {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || PROJECT_FALLBACK;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    return await safeJsonFetch(
      `${projectUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=steam`,
      { headers: { apikey: anonKey } },
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

type InvRow = { image?: string; name?: string; type?: string; rarity_color?: string };

const LIBRARY_PAGE = 36;

const SteamDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPrice, getDisplayPrice } = useLztMarkup();
  const { addItem } = useCart();
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryVisible, setLibraryVisible] = useState(LIBRARY_PAGE);

  const { data, isLoading, error } = useQuery({
    queryKey: ["lzt-account-detail", "steam", id],
    queryFn: () => fetchAccountDetail(id!),
    enabled: !!id,
    staleTime: 1000 * 30,
    retry: false,
  });

  const item = data?.item;
  const raw = (item || {}) as Record<string, unknown>;

  const steamGames: SteamLibGame[] = useMemo(
    () => normalizeSteamGamesFromRaw((item || {}) as Record<string, unknown>),
    [item],
  );

  const heroImageUrl = useMemo(
    () => resolveSteamHeroImage((item || {}) as Record<string, unknown>),
    [item],
  );

  const gameCountListed = useMemo(() => {
    const r = (item || {}) as Record<string, unknown>;
    const n = Number(r.steam_games_count ?? r.games_count ?? r.total_games);
    if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 99999);
    return steamGames.length;
  }, [item, steamGames.length]);

  useEffect(() => {
    setLibraryQuery("");
    setLibraryVisible(LIBRARY_PAGE);
  }, [id]);

  const steamLevel = Number(raw.steam_level || 0);
  const hasPrime = raw.steam_prime === "Yes" || raw.steam_prime === true || !!raw.cs2_prime;
  const hasVac = !!raw.steam_vac_ban;
  const hasCommunityBan = !!raw.steam_community_ban;
  const steamId = raw.steam_id;
  const invCount = Number(raw.steam_inventory_items_count || 0);

  const cs2Elo = raw.premier_elo || raw.cs2_elo || raw.premier_elo_min;
  const cs2Wins = raw.cs2_win || raw.cs2_wins || raw.cs2_win_min;
  const faceitLevel = raw.faceit_lvl || raw.faceit_level || raw.faceit_lvl_min;
  const medalsCount = raw.medals_count || raw.medals || raw.medals_min;

  const hasCs2Stats = !!(cs2Elo || cs2Wins || faceitLevel || medalsCount || hasPrime);

  const cleanedTitle = useMemo(() => {
    let t = String(item?.title || "");
    t = t.replace(/[А-Яа-я]/g, "").trim();
    if (!t || t.toLowerCase() === "kuki" || t.length < 3) {
      const parts = ["Conta Steam"];
      if (steamLevel > 0) parts.push(`Nv.${steamLevel}`);
      if (gameCountListed > 0) parts.push(`${gameCountListed} jogos`);
      if (cs2Elo) parts.push(`CS2 ${cs2Elo} ELO`);
      else if (invCount > 0) parts.push(`${invCount} itens inv.`);
      return parts.join(" · ");
    }
    return t;
  }, [item?.title, steamLevel, gameCountListed, cs2Elo, invCount]);

  const filteredGames = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return steamGames;
    return steamGames.filter((g) => (g.name || "").toLowerCase().includes(q) || String(g.appid || "").includes(q));
  }, [steamGames, libraryQuery]);

  const viewTracked = useRef(false);
  useEffect(() => {
    viewTracked.current = false;
  }, [id]);
  useEffect(() => {
    if (item && !viewTracked.current) {
      viewTracked.current = true;
      trackViewContent({
        contentName: cleanedTitle,
        contentIds: [String(item.item_id)],
        value: getPrice(item, "steam"),
        currency: "BRL",
      });
    }
  }, [item, getPrice, cleanedTitle]);

  const handleAddToCart = async () => {
    if (!item) return;

    const isStillAvailable = await checkLztAvailability(String(item.item_id), "steam");
    if (!isStillAvailable) {
      toast({
        title: "Conta indisponível",
        description: "Infelizmente esta conta acabou de ser vendida no mercado.",
        variant: "destructive",
      });
      return;
    }

    trackInitiateCheckout({
      contentName: cleanedTitle,
      contentIds: [item.item_id],
      value: getPrice(item, "steam"),
      currency: "BRL",
    });

    addItem({
      productId: item.item_id,
      productName: cleanedTitle,
      productImage: "",
      planId: "steam-account",
      planName: "Conta Steam",
      price: getPrice(item, "steam"),
      type: "lzt-account",
      lztItemId: item.item_id,
    });

    toast({
      title: "Adicionado ao carrinho",
      description: "A conta Steam foi adicionada com sucesso.",
    });
    navigate("/checkout");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="space-y-6 lg:w-2/3">
              <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary/30 sm:h-96" />
              <div className="space-y-4">
                <div className="h-8 w-3/4 animate-pulse rounded bg-secondary/30" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-secondary/30" />
              </div>
            </div>
            <div className="lg:w-1/3">
              <div className="h-80 w-full animate-pulse rounded-2xl bg-secondary/30" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-32 text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Ops! Algo deu errado</h1>
          <p className="mb-8 text-muted-foreground">
            {error instanceof Error ? error.message : "Não conseguimos carregar os detalhes desta conta."}
          </p>
          <button
            onClick={() => navigate("/contas?game=steam")}
            className="rounded-xl bg-primary px-8 py-3 font-bold text-white transition-all hover:opacity-90 active:scale-95"
          >
            Voltar para a loja
          </button>
        </div>
      </div>
    );
  }

  const inventory = Array.isArray(raw.inventory) ? (raw.inventory as InvRow[]) : [];

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-12">
      <Header />

      <div className="container mx-auto px-4 pt-24 pb-12">
        <button
          onClick={() => navigate(-1)}
          className="group mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Voltar para listagem
        </button>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="space-y-8 lg:w-2/3">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
              <div className="relative h-64 w-full overflow-hidden bg-secondary/20 sm:h-80">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(210,100%,50%,0.1),transparent_70%)]" />
                {heroImageUrl ? (
                  <img
                    key={heroImageUrl}
                    src={getProxiedImageUrl(heroImageUrl)}
                    alt=""
                    className="h-full w-full object-cover sm:object-contain p-0 sm:p-4 drop-shadow-2xl"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center opacity-10">
                    <Globe className="h-32 w-32" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card to-transparent" />
              </div>

              <div className="relative z-10 -mt-12 p-6 pt-0 sm:p-10">
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(210,100%,50%,0.1)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(210,100%,50%)]">
                    <Globe className="h-3 w-3" />
                    Conta Steam
                  </span>
                  {hasPrime && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                      <Zap className="h-3 w-3" />
                      Prime
                    </span>
                  )}
                  {hasVac && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      VAC
                    </span>
                  )}
                  {hasCommunityBan && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Ban comunidade
                    </span>
                  )}
                </div>

                <h1 className="mb-2 text-2xl font-black leading-tight text-foreground sm:text-4xl">{cleanedTitle}</h1>
                <p className="text-sm text-muted-foreground">
                  Biblioteca e estatísticas conforme dados públicos agregados pelo LZT. CS2 aparece quando a conta tem stats
                  de Counter-Strike 2.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl border border-border/50 bg-secondary/40 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nível Steam</p>
                    <p className="text-xl font-black text-foreground">{String(steamLevel)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-secondary/40 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jogos</p>
                    <p className="text-xl font-black text-foreground">{gameCountListed}</p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-secondary/40 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Itens inv. CS</p>
                    <p className="text-xl font-black text-foreground">{invCount > 0 ? String(invCount) : "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-secondary/40 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Região</p>
                    <p className="text-sm font-black text-foreground">
                      {item.steam_country === "Bra" ? "Brasil" : item.steam_country || "—"}
                    </p>
                  </div>
                </div>

                {hasCs2Stats && (
                  <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                      <Swords className="h-4 w-4 text-primary" />
                      Counter-Strike 2
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {cs2Elo != null && cs2Elo !== "" && (
                        <span className="rounded-lg bg-card px-3 py-1.5 text-xs font-bold border border-border">
                          Premier ELO: {String(cs2Elo)}
                        </span>
                      )}
                      {cs2Wins != null && cs2Wins !== "" && (
                        <span className="rounded-lg bg-card px-3 py-1.5 text-xs font-bold border border-border">
                          Vitórias: {String(cs2Wins)}
                        </span>
                      )}
                      {faceitLevel != null && faceitLevel !== "" && (
                        <span className="rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-300 border border-orange-500/20">
                          Faceit: {String(faceitLevel)}
                        </span>
                      )}
                      {medalsCount != null && medalsCount !== "" && (
                        <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold border border-amber-500/20">
                          Medalhas: {String(medalsCount)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {inventory.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-bold">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Inventário CS2 (skins / itens)
                  </h2>
                  <span className="text-xs font-medium text-muted-foreground">{inventory.length} itens</span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {inventory.map((invItem, idx) => (
                    <div
                      key={`${invItem.name || "i"}-${idx}`}
                      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30"
                    >
                      <div className="relative flex aspect-square items-center justify-center bg-secondary/10 p-4">
                        {invItem.image ? (
                          <img
                            src={getProxiedImageUrl(invItem.image)}
                            alt={invItem.name || ""}
                            className="h-full w-full object-contain transition-transform group-hover:scale-110"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <Gamepad2 className="h-8 w-8 text-muted-foreground/40" />
                        )}
                        {invItem.rarity_color ? (
                          <div
                            className="absolute bottom-1 right-1 h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]"
                            style={{ backgroundColor: String(invItem.rarity_color) }}
                          />
                        ) : null}
                      </div>
                      <div className="border-t border-border/50 p-2">
                        <p className="truncate text-[10px] font-bold leading-tight text-foreground">{invItem.name || "Item"}</p>
                        {invItem.type ? (
                          <p className="mt-0.5 truncate text-[8px] font-medium text-muted-foreground">{invItem.type}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <Gamepad2 className="h-5 w-5 text-[hsl(210,100%,50%)]" />
                  Biblioteca de jogos
                </h2>
                <span className="text-xs font-medium text-muted-foreground">
                  {filteredGames.length} de {steamGames.length} listados
                </span>
              </div>

              {steamGames.length > 0 ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      placeholder="Buscar jogo ou appid…"
                      value={libraryQuery}
                      onChange={(e) => {
                        setLibraryQuery(e.target.value);
                        setLibraryVisible(LIBRARY_PAGE);
                      }}
                      className="w-full rounded-xl border border-border bg-secondary/30 py-2.5 pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredGames.slice(0, libraryVisible).map((game, idx) => (
                      <div
                        key={`${game.appid ?? "g"}-${game.name ?? idx}-${idx}`}
                        className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30"
                      >
                        <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/50 text-muted-foreground transition-colors group-hover:text-primary">
                          {game.appid ? (
                            <img
                              src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`}
                              alt={game.name || "Game"}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <Gamepad2 className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-foreground">{game.name || `App ${game.appid ?? "?"}`}</p>
                          {game.appid ? (
                            <p className="text-[10px] text-muted-foreground">appid {game.appid}</p>
                          ) : null}
                          {formatSteamPlaytime(game.playtimeMinutes) ? (
                            <p className="text-[10px] font-medium text-muted-foreground">
                              {formatSteamPlaytime(game.playtimeMinutes)} jogadas
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredGames.length > libraryVisible ? (
                    <button
                      type="button"
                      onClick={() => setLibraryVisible((v) => v + LIBRARY_PAGE)}
                      className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/50"
                    >
                      Carregar mais ({filteredGames.length - libraryVisible} restantes)
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-border py-12 text-center">
                  <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Nenhum jogo detalhado nesta resposta. O anúncio ainda pode incluir jogos — dados vêm do snapshot LZT.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-1/3">
            <div className="sticky top-28 space-y-6">
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-primary/5">
                <div className="p-6 sm:p-8">
                  <div className="mb-6">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Preço</p>
                    <h2 className="text-4xl font-black tracking-tighter text-foreground sm:text-5xl">
                      {getDisplayPrice(item, "steam")}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
                      <span className="font-medium text-muted-foreground">Entrega</span>
                      <span className="flex items-center gap-1.5 font-bold text-emerald-500">
                        <Zap className="h-3.5 w-3.5 fill-current" /> Instantânea
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
                      <span className="font-medium text-muted-foreground">Disponibilidade</span>
                      <span className="flex items-center gap-1.5 font-bold text-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Em estoque
                      </span>
                    </div>
                    {steamId ? (
                      <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
                        <span className="font-medium text-muted-foreground">Steam ID</span>
                        <a
                          href={`https://steamcommunity.com/profiles/${steamId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 font-bold text-primary hover:underline"
                        >
                          {String(steamId).slice(0, 10)}… <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={handleAddToCart}
                    className="group relative mt-8 w-full overflow-hidden rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/40 active:scale-[0.98]"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-3">
                      <ShoppingCart className="h-5 w-5" />
                      Comprar agora
                    </div>
                  </button>

                  <div className="mt-6 flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-emerald-500" /> Garantia
                    </span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-500" /> Auto-entrega
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-secondary/20 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight text-foreground">Compra segura</p>
                    <p className="text-[10px] text-muted-foreground">Checkout criptografado</p>
                  </div>
                </div>
                <p className="text-[10px] italic leading-relaxed text-muted-foreground opacity-80">
                  Contas Steam com dados de entrega após a compra. Verifique VAC / ban antes de comprar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {item ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
          <div className="safe-area-bottom border-t border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="min-w-0 text-lg font-bold leading-tight text-primary">{getDisplayPrice(item, "steam")}</span>
              <button
                onClick={handleAddToCart}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold uppercase tracking-wider text-white transition-all active:scale-[0.98]"
              >
                <ShoppingCart className="h-4 w-4" />
                Comprar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SteamDetalhes;
