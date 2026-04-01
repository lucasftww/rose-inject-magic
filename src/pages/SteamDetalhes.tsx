import { useParams, useNavigate } from "react-router-dom";
import { throwApiError } from "@/lib/apiErrors";
import { useQuery } from "@tanstack/react-query";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import Header from "@/components/Header";
import {
  ArrowLeft, Shield, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, ShoppingCart, Star, X, Zap, Trophy, Globe, History,
  Gamepad2, AlertTriangle, ExternalLink, Swords
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { trackViewContent, trackInitiateCheckout } from "@/lib/metaPixel";
import { checkLztAvailability } from "@/lib/lztAvailability";

const getProxiedImageUrl = (url: string) => {
  if (!url) return "";
  if (url.includes("lzt.market") || url.includes("img.lzt.market") || url.includes("steamstatic.com") || url.includes("akamaihd.net")) {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${projectUrl}/functions/v1/lzt-market?action=image-proxy&url=${encodeURIComponent(url)}`;
  }
  return url;
};

const fetchAccountDetail = async (itemId: string) => {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cthqzetkshrbsjulfytl.supabase.co';
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  try {
    return await safeJsonFetch(
      `${projectUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=steam`,
      { headers: { apikey: anonKey } }
    );
  } catch (err: any) {
    if (err instanceof ApiError) {
      if (err.status === 410) {
        throw new Error("Esta conta já foi vendida ou não está mais disponível.");
      }
      throwApiError(err.status || 500);
    }
    throw err;
  }
};

const SteamDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPrice, getDisplayPrice } = useLztMarkup();
  const { addItem } = useCart();

  const { data, isLoading, error } = useQuery({
    queryKey: ["lzt-account-detail", "steam", id],
    queryFn: () => fetchAccountDetail(id!),
    enabled: !!id,
    staleTime: 1000 * 30,
    retry: false,
  });

  const item = data?.item;
  const raw = item || {};

  // Steam specific data
  const steamGames = useMemo(() => {
    if (Array.isArray(raw.steamGames)) return raw.steamGames;
    if (raw.steam_games_list) return raw.steam_games_list;
    return [];
  }, [raw.steamGames, raw.steam_games_list]);

  const steamLevel = raw.steam_level || 0;
  const hasPrime = raw.steam_prime === "Yes" || raw.steam_prime === true || !!raw.cs2_prime;
  const hasVac = !!raw.steam_vac_ban;
  const steamId = raw.steam_id;
  
  // CS2 Specifics from raw data
  const cs2Elo = raw.premier_elo || raw.cs2_elo || raw.premier_elo_min;
  const cs2Wins = raw.cs2_win || raw.cs2_wins || raw.cs2_win_min;
  const faceitLevel = raw.faceit_lvl || raw.faceit_level || raw.faceit_lvl_min;
  const medalsCount = raw.medals_count || raw.medals || raw.medals_min;

  const cleanedTitle = useMemo(() => {
    let t = item?.title || "";
    // Remove cyrillic
    t = t.replace(/[А-Яа-я]/g, '').trim();
    if (!t || t.toLowerCase() === "kuki" || t.length < 3) {
      const eloPart = cs2Elo ? ` [${cs2Elo} ELO]` : "";
      const medalsPart = medalsCount ? ` [${medalsCount} Medalhas]` : "";
      return `Conta Steam / CS2${eloPart}${medalsPart}`;
    }
    return t;
  }, [item?.title, cs2Elo, medalsCount]);

  useEffect(() => {
    if (item) {
      trackViewContent({
        contentName: cleanedTitle,
        contentIds: [item.item_id],
        value: getPrice(item),
        currency: "BRL"
      });
    }
  }, [item, getPrice, cleanedTitle]);

  const handleAddToCart = async () => {
    if (!item) return;
    
    const isStillAvailable = await checkLztAvailability(item.item_id);
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
      value: getPrice(item),
      currency: "BRL"
    });

    addItem({
      productId: item.item_id,
      productName: cleanedTitle,
      productImage: "",
      planId: "steam-account",
      planName: "Conta Steam / CS2",
      price: getPrice(item),
      type: "lzt-account",
      lztItemId: item.item_id
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
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-2/3 space-y-6">
              <div className="h-64 sm:h-96 w-full rounded-2xl bg-secondary/30 animate-pulse" />
              <div className="space-y-4">
                <div className="h-8 w-3/4 bg-secondary/30 animate-pulse rounded" />
                <div className="h-4 w-1/2 bg-secondary/30 animate-pulse rounded" />
              </div>
            </div>
            <div className="lg:w-1/3">
              <div className="h-80 w-full rounded-2xl bg-secondary/30 animate-pulse" />
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
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-6">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Ops! Algo deu errado</h1>
          <p className="text-muted-foreground mb-8">
            {error instanceof Error ? error.message : "Não conseguimos carregar os detalhes desta conta."}
          </p>
          <button onClick={() => navigate("/contas?game=steam")} className="rounded-xl bg-primary px-8 py-3 font-bold text-white transition-all hover:opacity-90 active:scale-95">
            Voltar para a loja
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="lg:w-2/3 space-y-8">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
              {/* Product Preview Image */}
              <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-secondary/20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(210,100%,50%,0.1),transparent_70%)]" />
                {item.imagePreviewLinks?.direct?.main || item.imagePreviewLinks?.direct?.weapons ? (
                  <img 
                    src={getProxiedImageUrl(item.imagePreviewLinks?.direct?.main || item.imagePreviewLinks?.direct?.weapons)} 
                    alt="Preview" 
                    className="h-full w-full object-contain p-4 drop-shadow-2xl"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center opacity-10">
                    <Globe className="h-32 w-32" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card to-transparent" />
              </div>

              <div className="relative z-10 p-6 sm:p-10 pt-0 -mt-12">
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(210,100%,50%,0.1)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(210,100%,50%)]">
                    <Globe className="h-3 w-3" />
                     CONTA STEAM / CS2
                  </span>
                  {hasPrime && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                      <Zap className="h-3 w-3" />
                      Status Prime
                    </span>
                  )}
                  {hasVac && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Possui Banimento
                    </span>
                  )}
                </div>
                
                <h1 className="text-2xl sm:text-4xl font-black text-foreground mb-4 leading-tight">
                  {cleanedTitle}
                </h1>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
                  <div className="rounded-2xl bg-secondary/40 p-4 border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Nível Steam</p>
                    <p className="text-xl font-black text-foreground">{String(steamLevel)}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/40 p-4 border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Jogos</p>
                    <p className="text-xl font-black text-foreground">{steamGames.length}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/40 p-4 border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Premier ELO</p>
                    <p className="text-xl font-black text-primary">{cs2Elo ? `${cs2Elo}` : "N/A"}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/40 p-4 border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Região</p>
                    <p className="text-sm font-black text-foreground">{item.steam_country === 'Bra' ? 'Brasil' : (item.steam_country || "Global")}</p>
                  </div>
                </div>

                {(cs2Wins || faceitLevel || medalsCount) && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {cs2Wins && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10">
                        <Swords className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold text-foreground">{String(cs2Wins)} Vitórias</span>
                      </div>
                    )}
                    {faceitLevel && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/5 border border-orange-500/10">
                        <Trophy className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-xs font-bold text-foreground">Faceit Level {String(faceitLevel)}</span>
                      </div>
                    )}
                    {medalsCount && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-bold text-foreground">{String(medalsCount)} Medalhas</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Inventory Section */}
            {raw.inventory && Array.isArray(raw.inventory) && raw.inventory.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Inventário e Skins
                  </h2>
                  <span className="text-xs text-muted-foreground font-medium">{raw.inventory.length} itens encontrados</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {raw.inventory.map((invItem: any, idx: number) => (
                    <div key={idx} className="flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all group">
                      <div className="aspect-square relative bg-secondary/10 flex items-center justify-center p-4">
                        <img 
                          src={getProxiedImageUrl(invItem.image)} 
                          alt={invItem.name} 
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute bottom-1 right-1">
                           <span className={invItem.rarity_color ? `h-2 w-2 rounded-full block shadow-[0_0_8px_currentColor]` : ""} style={{ color: invItem.rarity_color }} />
                        </div>
                      </div>
                      <div className="p-2 border-t border-border/50">
                        <p className="text-[10px] font-bold truncate text-foreground leading-tight">{invItem.name}</p>
                        {invItem.type && <p className="text-[8px] text-muted-foreground font-medium truncate mt-0.5">{invItem.type}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Games Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5 text-[hsl(210,100%,50%)]" />
                  Biblioteca de Jogos
                </h2>
                <span className="text-xs text-muted-foreground font-medium">{steamGames.length} títulos encontrados</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {steamGames.length > 0 ? (
                  steamGames.slice(0, 12).map((game: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors group">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground group-hover:text-primary transition-colors">
                        <Gamepad2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate text-foreground">{game.name || game}</p>
                        {game.hours && <p className="text-[10px] text-muted-foreground font-medium">{Math.floor(game.hours / 60)} horas jogadas</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-border rounded-2xl">
                    <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">Nenhum jogo detalhado disponível</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar / Actions */}
          <div className="lg:w-1/3">
            <div className="sticky top-28 space-y-6">
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-primary/5">
                <div className="p-6 sm:p-8">
                  <div className="mb-6">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Preço Promocional</p>
                    <div className="flex items-center gap-3">
                      <h2 className="text-4xl sm:text-5xl font-black text-foreground tracking-tighter">
                        {getDisplayPrice(item)}
                      </h2>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded italic">-35% hoje</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                      <span className="text-muted-foreground font-medium">Entrega</span>
                      <span className="text-emerald-500 font-bold flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 fill-current" /> Instantânea</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                      <span className="text-muted-foreground font-medium">Disponibilidade</span>
                      <span className="text-foreground font-bold flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Em estoque</span>
                    </div>
                    {steamId && (
                      <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                        <span className="text-muted-foreground font-medium">Steam ID</span>
                        <a 
                          href={`https://steamcommunity.com/profiles/${steamId}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-primary hover:underline font-bold flex items-center gap-1"
                        >
                          {String(steamId).slice(0, 10)}... <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
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
                  
                  <div className="mt-6 flex items-center justify-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-emerald-500" /> Garantia Vitalícia</span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" /> Auto-entrega</span>
                  </div>
                </div>
              </div>

              {/* Badges Box */}
              <div className="rounded-2xl border border-border bg-secondary/20 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-card border border-border">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-foreground uppercase tracking-tight">Compra 100% Segura</p>
                    <p className="text-[10px] text-muted-foreground">Sistema de criptografia SSL</p>
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground opacity-80 italic">
                  * Todas as nossas contas Steam acompanham os dados originais (E-mail OG) para sua total segurança.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SteamDetalhes;
