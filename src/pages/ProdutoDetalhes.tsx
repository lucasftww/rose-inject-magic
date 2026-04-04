import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { ArrowLeft, ChevronLeft, ChevronRight, Cpu, Download, Fingerprint, Loader2, Monitor, Package, Play, ShoppingCart, Sparkles, Star, UserCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { safeJsonFetch } from "@/lib/apiUtils";
import type { PixPaymentCreateResult } from "@/lib/edgeFunctionTypes";
import { getUserData } from "@/lib/metaPixel";
import { getYouTubeId, getYouTubeEmbedUrl, getYouTubeThumbnail } from "@/lib/videoUtils";
import { useCart } from "@/hooks/useCart";
import { useReseller } from "@/hooks/useReseller";
import { toast } from "@/hooks/use-toast";
import { trackViewContent, trackInitiateCheckout } from "@/lib/metaPixel";
import { parseStoreProductDetail, type StoreProductDetail } from "@/types/supabaseQueryResults";

interface PublicProductReview {
  id: string;
  created_at: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
}

interface CartItem {
  productId: string;
  productName: string;
  productImage: string | null;
  planId: string;
  planName: string;
  price: number;
}

interface Reseller {
  id: string;
  created_at: string;
  user_id: string;
  products: string[];
  discount_percent: number;
  active: boolean;
}

interface GameInfo {
  id: string;
  name: string;
  slug: string;
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
  username?: string;
}

const ProdutoDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isReseller, isResellerForProduct, getDiscountedPrice, discountPercent } = useReseller();
  const [product, setProduct] = useState<StoreProductDetail | null>(null);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [claimingFree, setClaimingFree] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, image_url, active, sort_order, game_id, created_at, status, status_label, status_updated_at, features_text, robot_game_id, product_plans(*), product_media(*), product_features(*)")
        .eq("id", id)
        .eq("active", true)
        .maybeSingle();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const parsed = parseStoreProductDetail(data);
      if (!parsed) {
        toast({
          variant: "destructive",
          title: "Produto indisponível",
          description: "Os dados do produto estão incompletos. Tente outra página ou atualize.",
        });
        setLoading(false);
        return;
      }
      setProduct(parsed);

      if (data.game_id) {
        const { data: gameData } = await supabase
          .from("games")
          .select("id, name, slug")
          .eq("id", data.game_id)
          .maybeSingle();
        if (gameData) {
          setGame({
            id: gameData.id,
            name: gameData.name,
            slug: gameData.slug ?? "",
          });
        }
      }

      const { data: reviewsData } = await supabase
        .from("public_product_reviews")
        .select("id, rating, comment, created_at, username")
        .eq("product_id", id)
        .order("created_at", { ascending: false });

      if (reviewsData && reviewsData.length > 0) {
        setReviews(
          reviewsData.map((r) => ({
            id: r.id ?? "",
            created_at: r.created_at ?? "",
            product_id: r.product_id ?? "",
            user_id: "",
            rating: r.rating ?? 0,
            comment: r.comment ?? null,
            username: r.username || "Usuário",
          })),
        );
      }

      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const sortedPlans = useMemo(() => {
    if (!product) return [];
    return [...(product.product_plans || [])].filter(p => p.active).sort((a, b) => a.sort_order - b.sort_order);
  }, [product]);

  const sortedFeatures = useMemo(() => {
    if (!product) return [];
    return [...(product.product_features || [])].sort((a, b) => a.sort_order - b.sort_order);
  }, [product]);

  const allMedia = useMemo(() => {
    if (!product) return [];
    const items: { id: string; media_type: "image" | "video"; url: string; sort_order: number }[] = [];
    const media = [...(product.product_media || [])].sort((a, b) => a.sort_order - b.sort_order);
    if (product.image_url && !media.some(m => m.url === product.image_url)) {
      items.push({ id: "main", media_type: "image", url: product.image_url, sort_order: -1 });
    }
    items.push(...media);
    return items;
  }, [product]);

  const selectedMedia = allMedia[selectedMediaIndex] || null;

  useEffect(() => {
    if (sortedPlans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(sortedPlans[0].id);
    }
  }, [sortedPlans, selectedPlanId]);

  const viewTracked = useRef(false);
  useEffect(() => {
    viewTracked.current = false;
  }, [id]);
  useEffect(() => {
    if (product && game && sortedPlans.length > 0 && !viewTracked.current) {
      viewTracked.current = true;
      const plan = sortedPlans[0];
      trackViewContent({
        contentName: product.name,
        contentIds: [product.id],
        value: Number(plan.price),
      });
    }
  }, [product, game, sortedPlans]);

  useEffect(() => {
    if (!product || sortedPlans.length === 0) return;
    const lowestPrice = Math.min(...sortedPlans.map(p => Number(p.price)));
    const highestPrice = Math.max(...sortedPlans.map(p => Number(p.price)));
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description || product.name,
      image: product.image_url || undefined,
      brand: { "@type": "Brand", name: "Royal Store" },
      offers: {
        "@type": sortedPlans.length > 1 ? "AggregateOffer" : "Offer",
        priceCurrency: "BRL",
        ...(sortedPlans.length > 1
          ? { lowPrice: lowestPrice.toFixed(2), highPrice: highestPrice.toFixed(2), offerCount: sortedPlans.length }
          : { price: lowestPrice.toFixed(2) }),
        availability: "https://schema.org/InStock",
        url: window.location.href,
      },
      ...(reviews.length > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
          reviewCount: reviews.length,
        },
      }),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    script.id = "product-jsonld";
    document.head.querySelector("#product-jsonld")?.remove();
    document.head.appendChild(script);
    return () => { document.head.querySelector("#product-jsonld")?.remove(); };
  }, [product, sortedPlans, reviews]);

  const selectedPlan = sortedPlans.find(p => p.id === selectedPlanId);

  const buyNow = async () => {
    if (!product || !selectedPlan || claimingFree) return;
    const hasResellerDiscount = isReseller && isResellerForProduct(product.id);
    const finalItemPrice = hasResellerDiscount
      ? Number(selectedPlan.price) * (1 - discountPercent / 100)
      : Number(selectedPlan.price);
    const isFreeProduct = Number(selectedPlan.price) === 0 || finalItemPrice <= 0;

    if (isFreeProduct) {
      setClaimingFree(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast({
            title: "Entre na sua conta",
            description: "Faça login para obter o download gratuito.",
            variant: "destructive",
          });
          return;
        }
        const res = await safeJsonFetch<PixPaymentCreateResult>(
          `${supabaseUrl}/functions/v1/pix-payment?action=create`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
              apikey: supabaseAnonKey,
            },
            body: JSON.stringify({
              cart_snapshot: [
                {
                  productId: product.id,
                  productName: product.name,
                  productImage: product.image_url,
                  planId: selectedPlan.id,
                  planName: selectedPlan.name,
                  price: 0,
                  quantity: 1,
                },
              ],
              coupon_id: null,
              meta_user_data: getUserData(),
              customer_data: {
                name: String(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Cliente"),
                email: session.user.email || "",
                phone: "",
                document: "",
              },
            }),
          }
        );
        if (!res.success) throw new Error(res.error || "Não foi possível concluir");
        if (res.claimed_free && res.ticket_id) {
          toast({ title: "Pronto!", description: "Abrindo o pedido com o link de download." });
          navigate(`/pedido/${res.ticket_id}`);
        } else if (res.claimed_free) {
          toast({ title: "Pronto!", description: "Veja seus pedidos para o download." });
          navigate("/meus-pedidos");
        } else {
          throw new Error("Resposta inesperada do servidor");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        setClaimingFree(false);
      }
      return;
    }

    trackInitiateCheckout({
      contentName: product.name,
      contentIds: [product.id],
      value: finalItemPrice,
    });

    const added = addItem({
      productId: product.id,
      productName: product.name,
      productImage: product.image_url,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      price: finalItemPrice,
    });
    if (added) navigate("/checkout");
  };

  const prevMedia = () => setSelectedMediaIndex(i => (i > 0 ? i - 1 : allMedia.length - 1));
  const nextMedia = () => setSelectedMediaIndex(i => (i < allMedia.length - 1 ? i + 1 : 0));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-16">
          <Loader2 className="h-8 w-8 animate-spin text-success" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-5xl px-6 pt-4 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">Produto não encontrado</h1>
          <button onClick={() => navigate("/produtos")} className="mt-6 text-sm text-success hover:underline">
            ← Voltar aos produtos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3 sm:pt-4 pb-36 sm:pb-20">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-3 sm:mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-success"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </button>

        {/* Breadcrumb */}
        <div className="mb-4 sm:mb-6 flex items-center gap-2 text-xs text-muted-foreground/70 overflow-x-auto scrollbar-hide">
          <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors shrink-0">Início</button>
          <span className="shrink-0 text-muted-foreground/40">›</span>
          {game && (
            <>
              <button onClick={() => navigate("/produtos")} className="hover:text-foreground transition-colors shrink-0">{game.name}</button>
              <span className="shrink-0 text-muted-foreground/40">›</span>
            </>
          )}
          <span className="text-foreground/80 truncate">{product.name}</span>
        </div>

        <div className="grid gap-6 sm:gap-10 lg:grid-cols-5">
          {/* Left: Media Gallery — 3 cols */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Main media viewer */}
            <div className="relative overflow-hidden rounded-2xl bg-secondary/10 border border-border/40">
              {selectedMedia ? (
                selectedMedia.media_type === "video" ? (
                  (() => {
                    const ytId = getYouTubeId(selectedMedia.url);
                    if (ytId) {
                      return (
                        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                          <iframe
                            src={getYouTubeEmbedUrl(ytId)}
                            title="YouTube video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 h-full w-full rounded-2xl"
                          />
                        </div>
                      );
                    }
                    return (
                      <video src={selectedMedia.url} controls className="w-full rounded-2xl" />
                    );
                  })()
                ) : (
                  <img src={selectedMedia.url} alt={product.name} className="w-full" />
                )
              ) : (
                <div className="flex h-48 w-full items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground/20" />
                </div>
              )}

              {/* Nav arrows */}
              {allMedia.length > 1 && (
                <>
                  <button onClick={prevMedia} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/60 backdrop-blur-sm text-foreground/80 transition-colors hover:text-success">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={nextMedia} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/60 backdrop-blur-sm text-foreground/80 transition-colors hover:text-success">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              {allMedia.length > 1 && (
                <div className="absolute bottom-3 right-3 rounded-lg bg-background/60 backdrop-blur-sm px-2.5 py-1">
                  <span className="text-[11px] text-muted-foreground tabular-nums">{selectedMediaIndex + 1}/{allMedia.length}</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {allMedia.length > 1 && (
              <div className="mt-3 sm:mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {allMedia.map((media, idx) => (
                  <button
                    key={media.id}
                    onClick={() => setSelectedMediaIndex(idx)}
                    className={`relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl transition-all ${
                      idx === selectedMediaIndex
                        ? "ring-2 ring-success ring-offset-2 ring-offset-background"
                        : "opacity-50 hover:opacity-100"
                    }`}
                  >
                    {media.media_type === "video" ? (
                      (() => {
                        const ytId = getYouTubeId(media.url);
                        return (
                          <div className="flex h-full w-full items-center justify-center bg-secondary relative">
                            {ytId ? <img src={getYouTubeThumbnail(ytId)} alt="" className="h-full w-full object-cover" /> : null}
                            <Play className="h-4 w-4 text-foreground/70 absolute" />
                          </div>
                        );
                      })()
                    ) : (
                      <img src={media.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Features text */}
            {product.features_text && (
              <div className="mt-6 sm:mt-8">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-success mb-3">Detalhes</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{product.features_text}</p>
              </div>
            )}

            {/* Features cards */}
            {sortedFeatures.length > 0 && (
              <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-2.5">
                {sortedFeatures.map((feat) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    "GPU": <Sparkles className="h-4 w-4" />,
                    "OS": <Monitor className="h-4 w-4" />,
                    "CPU": <Cpu className="h-4 w-4" />,
                    "HVCI (Core Isolation)": <Fingerprint className="h-4 w-4" />,
                  };
                  const icon = iconMap[feat.label] || <Zap className="h-4 w-4" />;
                  return (
                    <div key={feat.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3.5 sm:p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{feat.label}</p>
                        <p className="text-sm font-bold text-foreground leading-snug">{feat.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reviews — below gallery on desktop too */}
            <div className="mt-8 sm:mt-10">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-success mb-4">Avaliações ({reviews.length})</h2>

              {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-2xl bg-card border border-border/40">
                  <Star className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-3 rounded-2xl bg-card border border-border/40 p-4">
                    <span className="text-3xl font-bold text-foreground">
                      {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                    </span>
                    <div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
                          return <span key={i} className={`text-sm ${i < Math.round(avg) ? "text-warning" : "text-muted-foreground/30"}`}>★</span>;
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{reviews.length} avaliações</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {reviews.map((review) => (
                      <div key={review.id} className="rounded-xl bg-card border border-border/40 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/10 text-[10px] font-bold text-success uppercase">
                              {(review.username || "U")[0]}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-foreground">{review.username}</span>
                              <p className="text-[9px] text-muted-foreground">{new Date(review.created_at).toLocaleDateString("pt-BR")}</p>
                            </div>
                          </div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-[10px] ${i < review.rating ? "text-warning" : "text-muted-foreground/30"}`}>★</span>
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Right: Product Info — 2 cols, sticky on desktop */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
          >
            <div className="lg:sticky lg:top-20 space-y-5">
              {/* Product header card */}
              <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
                {game && (
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-success">{game.name}</p>
                )}
                <h1 className="mt-1.5 text-xl font-bold text-foreground sm:text-2xl leading-tight">{product.name}</h1>

                {product.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground/80">{product.description}</p>
                )}

                {/* Reseller badge */}
                {isReseller && isResellerForProduct(product.id) && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/30 px-4 py-1.5">
                    <UserCheck className="h-4 w-4 text-accent-foreground" />
                    <span className="text-xs font-bold text-accent-foreground">Revendedor · -{discountPercent}%</span>
                  </div>
                )}
              </div>

              {/* Plans selection — purchase card */}
              {sortedPlans.length > 0 && (
                <div className="rounded-2xl border border-success/20 bg-card p-5 sm:p-6 shadow-[0_0_40px_hsl(var(--success)/0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Escolha seu plano</p>

                  <div className="space-y-2">
                    {sortedPlans.map((plan, idx) => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`flex w-full items-center justify-between rounded-xl p-3.5 sm:p-4 text-left transition-all relative ${
                          selectedPlanId === plan.id
                            ? "bg-success/10 ring-1 ring-success/40"
                            : "bg-secondary/20 hover:bg-secondary/30"
                        }`}
                      >
                        {/* Popular badge for best value (last plan usually) */}
                        {idx === sortedPlans.length - 1 && sortedPlans.length > 1 && (
                          <span className="absolute -top-2 right-3 rounded-full bg-success px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-success-foreground">
                            Melhor valor
                          </span>
                        )}
                        <div className="flex items-center gap-3">
                          <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-colors ${
                            selectedPlanId === plan.id ? "border-success" : "border-muted-foreground/30"
                          }`}>
                            {selectedPlanId === plan.id && <div className="h-2 w-2 rounded-full bg-success" />}
                          </div>
                          <span className={`text-sm font-medium ${selectedPlanId === plan.id ? "text-success" : "text-foreground"}`}>
                            {plan.name}
                          </span>
                        </div>
                        <div className="text-right">
                          {isReseller && isResellerForProduct(product.id) ? (
                            <>
                              <span className="text-xs text-muted-foreground line-through mr-2">R$ {Number(plan.price).toFixed(2)}</span>
                              <span className={`text-base font-bold ${selectedPlanId === plan.id ? "text-success" : "text-foreground"}`}>
                                R$ {(Number(plan.price) * (1 - discountPercent / 100)).toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className={`text-base font-bold ${selectedPlanId === plan.id ? "text-success" : "text-foreground"}`}>
                              R$ {Number(plan.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Total + CTA */}
                  {selectedPlan && (
                    <div className="mt-5">
                      {Number(selectedPlan.price) > 0 && (
                        <div className="mb-4 flex items-end justify-between rounded-xl bg-secondary/20 p-4">
                          <span className="text-sm text-muted-foreground">Total</span>
                          {isReseller && isResellerForProduct(product.id) ? (
                            <div className="text-right">
                              <span className="text-sm text-muted-foreground line-through mr-2">R$ {Number(selectedPlan.price).toFixed(2)}</span>
                              <span className="text-2xl font-bold text-success">R$ {(Number(selectedPlan.price) * (1 - discountPercent / 100)).toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="text-2xl font-bold text-success">R$ {Number(selectedPlan.price).toFixed(2)}</span>
                          )}
                        </div>
                      )}
                      {Number(selectedPlan.price) === 0 && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                          <Download className="h-5 w-5 text-emerald-400" />
                          <span className="text-sm text-emerald-300">Software gratuito — acesso instantâneo!</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void buyNow()}
                        disabled={claimingFree}
                        className={`group flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-60 ${
                          Number(selectedPlan.price) === 0
                            ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-[0_0_40px_hsl(160,80%,45%,0.4)]"
                            : "bg-success text-success-foreground hover:shadow-[0_0_40px_hsl(var(--success)/0.4)]"
                        }`}
                        style={{ fontFamily: "'Valorant', sans-serif" }}
                      >
                        {Number(selectedPlan.price) === 0 ? (
                          claimingFree ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> A obter…</>
                          ) : (
                            <><Download className="h-4 w-4" /> OBTER GRÁTIS</>
                          )
                        ) : (
                          <><Zap className="h-4 w-4 group-hover:animate-pulse" /> COMPRAR AGORA</>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Trust signals */}
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-3 px-2">
                      <Zap className="h-4 w-4 text-success" />
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Entrega<br/>Instantânea</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-3 px-2">
                      <ShoppingCart className="h-4 w-4 text-success" />
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Pagamento<br/>Seguro</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/20 py-3 px-2">
                      <Star className="h-4 w-4 text-success" />
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight font-medium">Suporte<br/>24/7</span>
                    </div>
                  </div>

                  {/* Social proof */}
                  {reviews.length > 0 && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary/20 px-4 py-2.5">
                      <div className="flex -space-x-1.5">
                        {reviews.slice(0, 3).map((r, i) => (
                          <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20 border-2 border-card text-[8px] font-bold text-success">
                            {(r.username || "U")[0]}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className="text-[9px] text-warning">★</span>
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{reviews.length} avaliações verificadas</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky mobile bottom bar */}
      {selectedPlan && (
        <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
          <div className="border-t border-border/40 bg-background/95 backdrop-blur-xl px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-3">
              <div className="flex flex-col min-w-0">
                {Number(selectedPlan.price) > 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground/70 leading-none mb-0.5">Total</span>
                    {isReseller && isResellerForProduct(product.id) ? (
                      <>
                        <span className="text-[10px] text-muted-foreground line-through leading-none">R$ {Number(selectedPlan.price).toFixed(2)}</span>
                        <span className="text-lg font-bold text-success leading-tight">
                          R$ {(Number(selectedPlan.price) * (1 - discountPercent / 100)).toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-success leading-tight">
                        R$ {Number(selectedPlan.price).toFixed(2)}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => void buyNow()}
                disabled={claimingFree}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-60 ${
                  Number(selectedPlan.price) === 0
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
                    : "bg-success text-success-foreground"
                }`}
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                {Number(selectedPlan.price) === 0 ? (
                  claimingFree ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> A obter…</>
                  ) : (
                    <><Download className="h-4 w-4" /> Obter Grátis</>
                  )
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> Comprar Agora</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProdutoDetalhes;
