import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { ArrowLeft, ChevronLeft, ChevronRight, Cpu, Fingerprint, Loader2, Monitor, Package, Play, Sparkles, Star, UserCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getYouTubeId, getYouTubeEmbedUrl, getYouTubeThumbnail } from "@/lib/videoUtils";
import { useCart } from "@/hooks/useCart";
import { useReseller } from "@/hooks/useReseller";
import { toast } from "@/hooks/use-toast";
import { trackViewContent, trackInitiateCheckout, resolveCategory } from "@/lib/metaPixel";

interface ProductPlan {
  id: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
}

interface MediaItem {
  id: string;
  media_type: "image" | "video";
  url: string;
  sort_order: number;
}

interface FeatureItem {
  id: string;
  label: string;
  value: string;
  sort_order: number;
}

interface ProductDetail {
  id: string;
  game_id: string;
  name: string;
  description: string | null;
  features_text: string | null;
  image_url: string | null;
  active: boolean;
  product_plans: ProductPlan[];
  product_media: MediaItem[];
  product_features: FeatureItem[];
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
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("products")
        .select("*, product_plans(*), product_media(*), product_features(*)")
        .eq("id", id)
        .eq("active", true)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      setProduct(data as any);

      // Fetch game info
      const { data: gameData } = await supabase
        .from("games")
        .select("id, name, slug")
        .eq("id", data.game_id)
        .single();
      if (gameData) setGame(gameData);

      // Fetch reviews
      const { data: reviewsData } = await supabase
        .from("product_reviews")
        .select("id, rating, comment, created_at, user_id")
        .eq("product_id", id)
        .order("created_at", { ascending: false });

      if (reviewsData && reviewsData.length > 0) {
        // Fetch usernames for reviewers
        const userIds = [...new Set(reviewsData.map((r: any) => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", userIds);

        const usernameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.username]));
        setReviews(reviewsData.map((r: any) => ({
          ...r,
          username: usernameMap.get(r.user_id) || "Usuário",
        })));
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
    // Only add main image if it's not already in product_media
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

  // ViewContent tracking
  const viewTracked = useRef(false);
  useEffect(() => {
    if (product && game && sortedPlans.length > 0 && !viewTracked.current) {
      viewTracked.current = true;
      const plan = sortedPlans[0];
      trackViewContent({
        contentName: product.name,
        contentCategory: resolveCategory(game.name),
        contentIds: [product.id],
        value: Number(plan.price),
      });
    }
  }, [product, game, sortedPlans]);

  // JSON-LD Structured Data for SEO
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

  const buyNow = () => {
    if (!product || !selectedPlan) return;
    const hasResellerDiscount = isReseller && isResellerForProduct(product.id);
    const finalItemPrice = hasResellerDiscount
      ? Number(selectedPlan.price) * (1 - discountPercent / 100)
      : Number(selectedPlan.price);

    // InitiateCheckout tracking
    trackInitiateCheckout({
      contentName: product.name,
      contentCategory: resolveCategory(game?.name),
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-20">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 sm:mb-6 flex items-center gap-2 rounded-lg border border-border px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-success hover:text-success"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        {/* Breadcrumb */}
        <div className="mb-6 sm:mb-8 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground overflow-x-auto scrollbar-hide">
          <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors shrink-0">Início</button>
          <span className="shrink-0">›</span>
          {game && (
            <>
              <button onClick={() => navigate("/produtos")} className="hover:text-foreground transition-colors shrink-0">{game.name}</button>
              <span className="shrink-0">›</span>
            </>
          )}
          <span className="text-foreground truncate">{product.name}</span>
        </div>

        <div className="grid gap-6 sm:gap-10 lg:grid-cols-2">
          {/* Left: Media Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Main media viewer */}
            <div className="relative overflow-hidden rounded-xl">
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
                            className="absolute inset-0 h-full w-full rounded-xl"
                          />
                        </div>
                      );
                    }
                    return (
                      <video
                        src={selectedMedia.url}
                        controls
                        className="w-full rounded-xl"
                      />
                    );
                  })()
                ) : (
                  <img
                    src={selectedMedia.url}
                    alt={product.name}
                    className="w-full"
                  />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground/20" />
                </div>
              )}

              {/* Nav arrows */}
              {allMedia.length > 1 && (
                <>
                  <button
                    onClick={prevMedia}
                    className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/80 border border-border text-foreground backdrop-blur-sm transition-colors hover:border-success hover:text-success"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextMedia}
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background/80 border border-border text-foreground backdrop-blur-sm transition-colors hover:border-success hover:text-success"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {allMedia.length > 1 && (
              <div className="mt-3 sm:mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {allMedia.map((media, idx) => (
                  <button
                    key={media.id}
                    onClick={() => setSelectedMediaIndex(idx)}
                    className={`relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      idx === selectedMediaIndex
                        ? "border-success shadow-[0_0_10px_hsl(130,99%,41%,0.3)]"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    {media.media_type === "video" ? (
                      (() => {
                        const ytId = getYouTubeId(media.url);
                        return (
                          <div className="flex h-full w-full items-center justify-center bg-secondary relative">
                            {ytId ? (
                              <img src={getYouTubeThumbnail(ytId)} alt="" className="h-full w-full object-cover" />
                            ) : null}
                            <Play className="h-4 w-4 text-muted-foreground absolute" />
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
              <div className="mt-5 sm:mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-success/50 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-success">Detalhes</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-success/50 to-transparent" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{product.features_text}</p>
              </div>
            )}

            {/* Features cards */}
            {sortedFeatures.length > 0 && (
              <div className="mt-5 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedFeatures.map((feat) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    "GPU": <Sparkles className="h-5 w-5" />,
                    "OS": <Monitor className="h-5 w-5" />,
                    "CPU": <Cpu className="h-5 w-5" />,
                    "HVCI (Core Isolation)": <Fingerprint className="h-5 w-5" />,
                  };
                  const icon = iconMap[feat.label] || <Zap className="h-5 w-5" />;

                  return (
                    <div
                      key={feat.id}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 transition-all hover:border-success/40 hover:shadow-[0_0_15px_hsl(130,99%,41%,0.08)]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success transition-colors group-hover:bg-success/20">
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{feat.label}</p>
                        <p className="mt-0.5 text-sm font-bold text-foreground">{feat.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Right: Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Game badge */}
            {game && (
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-success">{game.name}</p>
            )}

            <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">{product.name}</h1>

            {product.description && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            )}

            {/* Reseller badge */}
            {isReseller && isResellerForProduct(product.id) && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/30 px-4 py-1.5">
                <UserCheck className="h-4 w-4 text-accent-foreground" />
                <span className="text-xs font-bold text-accent-foreground">Revendedor · -{discountPercent}%</span>
              </div>
            )}


            {/* Plans selection */}
            {sortedPlans.length > 0 && (
              <div className="mt-8 rounded-xl border border-border bg-card p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Escolha seu plano</p>

                <div className="space-y-2">
                  {sortedPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all ${
                        selectedPlanId === plan.id
                          ? "border-success bg-success/10 shadow-[0_0_15px_hsl(130,99%,41%,0.15)]"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selectedPlanId === plan.id ? "border-success" : "border-muted-foreground/40"
                        }`}>
                          {selectedPlanId === plan.id && (
                            <div className="h-2.5 w-2.5 rounded-full bg-success" />
                          )}
                        </div>
                        <span className={`text-sm font-semibold ${selectedPlanId === plan.id ? "text-success" : "text-foreground"}`}>
                          {plan.name}
                        </span>
                      </div>
                      <div className="text-right">
                        {isReseller && isResellerForProduct(product.id) ? (
                          <>
                            <span className="text-xs text-muted-foreground line-through mr-2">R$ {Number(plan.price).toFixed(2)}</span>
                            <span className={`text-lg font-bold ${selectedPlanId === plan.id ? "text-success" : "text-foreground"}`}>
                              R$ {(Number(plan.price) * (1 - discountPercent / 100)).toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span className={`text-lg font-bold ${selectedPlanId === plan.id ? "text-success" : "text-foreground"}`}>
                            R$ {Number(plan.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Buttons */}
                {selectedPlan && (
                  <div className="mt-6">
                    <div className="mb-4 flex items-end justify-between">
                      <span className="text-xs text-muted-foreground">Total</span>
                      {isReseller && isResellerForProduct(product.id) ? (
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground line-through mr-2">R$ {Number(selectedPlan.price).toFixed(2)}</span>
                          <span className="text-2xl font-bold text-success">R$ {(Number(selectedPlan.price) * (1 - discountPercent / 100)).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-success">R$ {Number(selectedPlan.price).toFixed(2)}</span>
                      )}
                    </div>
                    <button
                      onClick={buyNow}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-success py-3.5 text-sm font-bold uppercase tracking-wider text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(130,99%,41%,0.4)]"
                      style={{ fontFamily: "'Valorant', sans-serif" }}>
                      <Zap className="h-4 w-4" />
                      COMPRAR AGORA
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Customer Reviews */}
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-success/50 to-transparent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-success">Avaliações ({reviews.length})</span>
                <div className="h-px flex-1 bg-gradient-to-l from-success/50 to-transparent" />
              </div>

              {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Star className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-lg border border-border bg-secondary/30 p-3 transition-all hover:border-success/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{review.username}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={`text-[10px] ${i < review.rating ? "text-warning" : "text-muted-foreground/30"}`}>★</span>
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ProdutoDetalhes;
