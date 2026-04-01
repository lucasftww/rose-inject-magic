import { useParams, useNavigate } from "react-router-dom";
import { throwApiError } from "@/lib/apiErrors";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { ArrowLeft, Loader2, ChevronRight, CheckCircle2, Shield, ShoppingCart, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useCart } from "@/hooks/useCart";
import { toast } from "@/hooks/use-toast";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import { trackViewContent, trackInitiateCheckout } from "@/lib/metaPixel";
import { checkLztAvailability } from "@/lib/lztAvailability";

const getProxiedImageUrl = (url: string) => {
  if (!url) return "";
  if (url.includes("lzt.market") || url.includes("img.lzt.market") || url.includes("mineskin.eu") || url.includes("capes.dev")) {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${projectUrl}/functions/v1/lzt-market?action=image-proxy&url=${encodeURIComponent(url)}`;
  }
  return url;
};

const MC_GREEN = "hsl(120,60%,45%)";

type CapeEntry = {
  type: string;
  exists: boolean;
  imageUrl: string | null;
  frontImageUrl: string | null;
  stillImageUrl: string | null;
  msg: string;
};

const fetchCapes = async (username: string): Promise<Record<string, CapeEntry>> => {
  const res = await fetch(`https://api.capes.dev/load/${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error("Cape API error");
  return res.json();
};

const fetchAccountDetail = async (itemId: string) => {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(
    `${projectUrl}/functions/v1/lzt-market?action=detail&item_id=${encodeURIComponent(itemId)}&game_type=minecraft`,
    { headers: { "Content-Type": "application/json", apikey: anonKey } }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 410) {
      throw new Error(body?.error === "Account already sold" ? "Esta conta já foi vendida." : "Esta conta não está mais disponível.");
    }
    throwApiError(res.status);
  }
  return res.json();
};

const MinecraftDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPrice, getDisplayPrice } = useLztMarkup();
  const { addItem } = useCart();

  const { data, isLoading, error } = useQuery({
    queryKey: ["lzt-account-detail", "minecraft", id],
    queryFn: () => fetchAccountDetail(id!),
    enabled: !!id,
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });

  const item = data?.item;
  const raw = item as any;
  const nickname = raw?.minecraft_nickname;

  const { data: capesData } = useQuery({
    queryKey: ["mc-capes", nickname],
    queryFn: () => fetchCapes(nickname!),
    enabled: !!nickname,
  });



  const hasJava = (raw?.minecraft_java ?? 0) > 0;
  const hasBedrock = (raw?.minecraft_bedrock ?? 0) > 0;
  const hypixelRank = raw?.minecraft_hypixel_rank;
  const hypixelLevel = raw?.minecraft_hypixel_level ?? 0;
  const hypixelAchievement = raw?.minecraft_hypixel_achievement ?? 0;
  const capes = raw?.minecraft_capes_count ?? 0;
  const capesList: string[] = Array.isArray(raw?.minecraft_capes)
    ? raw.minecraft_capes.map((c: any) => typeof c === "string" ? c : (c?.name || c?.rendered || "Cape"))
    : [];
  const banned = (raw?.minecraft_hypixel_ban ?? 0) > 0;
  const banReason = raw?.minecraft_hypixel_ban_reason;
  const hasDungeons = (raw?.minecraft_dungeons ?? 0) > 0;
  const hasLegends = (raw?.minecraft_legends ?? 0) > 0;
  const minecoins = raw?.minecraft_minecoins ?? 0;
  const skyblockLevel = raw?.minecraft_hypixel_skyblock_level ?? 0;

  const bodyUrl = nickname ? `https://mineskin.eu/body/${encodeURIComponent(nickname)}/200.png` : null;
  const headUrl = nickname ? `https://mineskin.eu/helm/${encodeURIComponent(nickname)}/100.png` : null;

  // ViewContent tracking
  const viewTracked = useRef(false);
  useEffect(() => {
    if (item && !viewTracked.current) {
      viewTracked.current = true;
      const priceBRL = getPrice(item, "minecraft");
      trackViewContent({
        contentName: `Conta Minecraft${nickname ? ` · ${nickname}` : ""}`,
        contentIds: [`lzt-mc-${item.item_id}`],
        value: priceBRL,
      });
    }
  }, [item, nickname, getPrice]);

  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const handleBuyNow = async () => {
    if (!item || checkingAvailability) return;
    setCheckingAvailability(true);
    const available = await checkLztAvailability(String(item.item_id), "minecraft");
    setCheckingAvailability(false);
    if (!available) return;
    const title = `Conta Minecraft${nickname ? ` · ${nickname}` : ""}${hasJava ? " · Java" : ""}${hasBedrock ? " · Bedrock" : ""}`;
    const priceBRL = getPrice(item, "minecraft");

    trackInitiateCheckout({
      contentName: title,
      contentIds: [`lzt-mc-${item.item_id}`],
      value: priceBRL,
    });

    const added = addItem({
      productId: `lzt-mc-${item.item_id}`,
      productName: title,
      productImage: headUrl,
      planId: "lzt-mc-account",
      planName: "Conta Minecraft",
      price: priceBRL,
      type: "lzt-account",
      lztItemId: String(item.item_id),
      lztPrice: item.price,
      lztCurrency: item.price_currency || "rub",
      lztGame: "minecraft",
    });
    if (added) navigate("/checkout");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-28 sm:pb-20">
        <button
          onClick={() => navigate("/contas?game=minecraft")}
          className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-all hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Contas Minecraft
        </button>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: MC_GREEN }} />
            <p className="mt-3 text-sm text-muted-foreground">Carregando conta...</p>
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
              <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Início</button>
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => navigate("/contas")} className="hover:text-foreground transition-colors">Contas</button>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: MC_GREEN }} className="font-medium">Minecraft #{item.item_id}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* LEFT: Skin visual */}
              <div className="lg:col-span-3 space-y-4">
                <div className="rounded-lg border border-border bg-card overflow-hidden aspect-video relative" style={{ borderColor: `${MC_GREEN}30` }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(120,30%,8%), hsl(30,20%,12%))" }} />
                  <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 50%, ${MC_GREEN}15, transparent 60%)` }} />

                  {/* Grid texture overlay */}
                  <div className="absolute inset-0 opacity-5" style={{
                    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 31px, hsl(0,0%,50%) 31px, hsl(0,0%,50%) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, hsl(0,0%,50%) 31px, hsl(0,0%,50%) 32px)"
                  }} />

                  {bodyUrl ? (
                    <div className="relative z-[1] flex items-end justify-center h-full py-4 gap-10">
                      <img
                        src={getProxiedImageUrl(bodyUrl)}
                        alt={nickname || "Skin"}
                        className="h-full w-auto object-contain drop-shadow-2xl"
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                      />
                    </div>
                  ) : (
                    <div className="relative z-[1] flex items-center justify-center h-full">
                      <p className="text-muted-foreground text-sm">Sem skin disponível</p>
                    </div>
                  )}

                  {/* Nickname badge */}
                  {nickname && (
                    <div className="absolute top-3 left-3 z-[2] rounded-lg bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5 flex items-center gap-2">
                      {headUrl && <img src={getProxiedImageUrl(headUrl)} alt="head" className="h-7 w-7 rounded object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                      <div>
                        <p className="text-xs font-bold text-foreground">{nickname}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {hasJava && hasBedrock ? "Java + Bedrock" : hasJava ? "Java Edition" : hasBedrock ? "Bedrock Edition" : "Conta Minecraft"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Ban warning */}
                  {banned && (
                    <div className="absolute top-3 right-3 z-[2] rounded-lg bg-destructive/90 border border-destructive px-2.5 py-1.5">
                      <p className="text-xs font-bold text-destructive-foreground">⚠️ Ban Hypixel</p>
                      {banReason && <p className="text-[10px] text-destructive-foreground/80">{banReason}</p>}
                    </div>
                  )}
                </div>

                {/* Stats card */}
                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Informações da Conta</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {hasJava && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Edição</p>
                        <p className="text-sm font-bold" style={{ color: MC_GREEN }}>Java</p>
                      </div>
                    )}
                    {hasBedrock && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Edição</p>
                        <p className="text-sm font-bold text-foreground">Bedrock</p>
                      </div>
                    )}
                    {hypixelLevel > 0 && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Nível Hypixel</p>
                        <p className="text-sm font-bold" style={{ color: MC_GREEN }}>{hypixelLevel}</p>
                      </div>
                    )}
                    {hypixelRank && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Rank Hypixel</p>
                        <p className="text-sm font-bold" style={{ color: "hsl(40,80%,55%)" }}>{hypixelRank}</p>
                      </div>
                    )}
                    {hypixelAchievement > 0 && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Conquistas</p>
                        <p className="text-sm font-bold text-foreground">{hypixelAchievement.toLocaleString()}</p>
                      </div>
                    )}
                    {capes > 0 && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Capes</p>
                        <p className="text-sm font-bold" style={{ color: MC_GREEN }}>{capes}</p>
                      </div>
                    )}
                    {minecoins > 0 && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Minecoins</p>
                        <p className="text-sm font-bold" style={{ color: MC_GREEN }}>{minecoins.toLocaleString()}</p>
                      </div>
                    )}
                    {skyblockLevel > 0 && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Skyblock Nível</p>
                        <p className="text-sm font-bold text-foreground">{skyblockLevel}</p>
                      </div>
                    )}
                    {hasDungeons && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Dungeons</p>
                        <p className="text-sm font-bold" style={{ color: MC_GREEN }}>✓</p>
                      </div>
                    )}
                    {hasLegends && (
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Legends</p>
                        <p className="text-sm font-bold" style={{ color: MC_GREEN }}>✓</p>
                      </div>
                    )}
                  </div>

                  {/* Capes with images from capes.dev */}
                  {(capes > 0 || capesData) && (
                    <div className="rounded-lg border border-border bg-card overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0" fill={MC_GREEN}><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M6,6V10H10V12H8V18H10V16H14V18H16V12H14V10H18V6H14V10H10V6H6Z" /></svg>
                        <p className="text-xs font-semibold text-foreground">Capes do jogador</p>
                        {capes > 0 && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${MC_GREEN}20`, color: MC_GREEN }}>{capes} cape{capes > 1 ? "s" : ""}</span>}
                      </div>
                      <div className="p-4">
                        {capesData ? (
                          (() => {
                            const found = Object.entries(capesData).filter(([, v]) => v.exists && v.frontImageUrl);
                            return found.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {found.map(([type, v]) => (
                                  <div key={type} className="group relative flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/20 p-3 hover:border-opacity-60 transition-all" style={{ borderColor: `${MC_GREEN}25` }}>
                                    <div className="relative flex items-center justify-center rounded-lg overflow-hidden w-full" style={{ background: "radial-gradient(ellipse at center, hsl(120,20%,12%), hsl(0,0%,8%))", minHeight: 120 }}>
                                      <img
                                        src={getProxiedImageUrl(v.frontImageUrl!)}
                                        alt={type}
                                        className="object-contain transition-transform group-hover:scale-105"
                                        style={{ maxHeight: 110, maxWidth: "100%", imageRendering: "pixelated" }}
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-semibold capitalize" style={{ color: MC_GREEN }}>{type}</span>
                                  </div>
                                ))}
                              </div>
                            ) : capesList.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {capesList.map((cape, i) => (
                                  <span key={i} className="rounded border border-border bg-secondary/30 px-2 py-0.5 text-[11px] text-foreground">{cape}</span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma cape encontrada</p>
                            );
                          })()
                        ) : capesList.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {capesList.map((cape, i) => (
                              <span key={i} className="rounded border border-border bg-secondary/30 px-2 py-0.5 text-[11px] text-foreground">{cape}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Purchase card */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-lg border bg-card p-5 space-y-3.5" style={{ borderColor: `${MC_GREEN}40` }}>
                  <h1 className="text-lg font-bold text-foreground leading-snug">
                    Conta Minecraft{nickname ? ` · ${nickname}` : ""}{hasJava && hasBedrock ? " · Java + Bedrock" : hasJava ? " · Java" : hasBedrock ? " · Bedrock" : ""}
                  </h1>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: MC_GREEN, borderColor: `${MC_GREEN}40`, background: `${MC_GREEN}15` }}>
                      <CheckCircle2 className="h-3 w-3" />
                      FULL ACESSO
                    </span>
                    {hasJava && (
                      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: MC_GREEN, borderColor: `${MC_GREEN}30`, background: `${MC_GREEN}10` }}>
                        Java Edition
                      </span>
                    )}
                    {hasBedrock && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Bedrock Edition
                      </span>
                    )}
                    {hypixelRank && (
                      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: "hsl(40,80%,40%)", borderColor: "hsl(40,80%,50%)" }}>
                        {hypixelRank}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      Conta verificável
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2"><span className="font-bold" style={{ color: MC_GREEN }}>✓</span> Entrega automática</p>
                    <p className="flex items-center gap-2"><span className="font-bold" style={{ color: MC_GREEN }}>✓</span> Email e senha inclusos</p>
                    <p className="flex items-center gap-2"><span className="font-bold" style={{ color: MC_GREEN }}>✓</span> Liberação instantânea</p>
                  </div>

                  <div className="rounded-lg bg-card border border-border p-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Por</p>
                      <p className="text-2xl font-bold" style={{ color: MC_GREEN }}>{getDisplayPrice(item, "minecraft")}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleBuyNow}
                    disabled={checkingAvailability}
                    className="group relative flex w-full items-center justify-center gap-2 border-2 px-5 py-3 text-xs font-bold uppercase tracking-[0.25em] rounded-lg transition-all hover:shadow-lg disabled:opacity-60"
                    style={{
                      borderColor: "rgba(255,255,255,0.2)",
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {checkingAvailability ? "VERIFICANDO..." : "COMPRAR AGORA"}
                  </button>

                  {item.item_id && (
                    <p className="text-[10px] text-muted-foreground/50 text-center break-all">Código: {item.item_id}</p>
                  )}

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg overflow-hidden">
                    {[
                      { label: "Edição", value: hasJava && hasBedrock ? "Java+BE" : hasJava ? "Java" : hasBedrock ? "Bedrock" : "—" },
                      { label: "Hypixel", value: hypixelLevel > 0 ? `Nv.${hypixelLevel}` : "—" },
                      { label: "Capes", value: capes > 0 ? capes : "—" },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col items-center py-2 px-1">
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        <p className="text-sm font-bold" style={{ color: MC_GREEN }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Access info */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill={MC_GREEN}><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M6,6V10H10V12H8V18H10V16H14V18H16V12H14V10H18V6H14V10H10V6H6Z" /></svg>
                    <h3 className="text-sm font-bold text-foreground">O que está incluso</h3>
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {[
                      "Login (email + senha) da conta Microsoft/Mojang",
                      "Acesso completo para trocar email e senha",
                      hasJava ? "Minecraft Java Edition licenciado" : null,
                      hasBedrock ? "Minecraft Bedrock Edition" : null,
                      hasDungeons ? "Minecraft Dungeons incluso" : null,
                      hasLegends ? "Minecraft Legends incluso" : null,
                      minecoins > 0 ? `${minecoins} Minecoins` : null,
                      capes > 0 ? `${capes} cape(s): ${capesList.join(", ")}` : null,
                    ].filter(Boolean).map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 font-bold flex-shrink-0" style={{ color: MC_GREEN }}>✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Sticky mobile bottom bar */}
      {item && (
        <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
          <div className="border-t border-border bg-card/95 backdrop-blur-xl px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-lg font-bold leading-tight" style={{ color: MC_GREEN }}>
                  {getDisplayPrice(item, "minecraft")}
                </span>
              </div>
              <button
                onClick={handleBuyNow}
                disabled={checkingAvailability}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider text-white transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: MC_GREEN, fontFamily: "'Valorant', sans-serif" }}
              >
                {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                {checkingAvailability ? "Verificando..." : "Comprar Agora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MinecraftDetalhes;
