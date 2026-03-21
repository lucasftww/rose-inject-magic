import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Star, ArrowRight, Package, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import bannerInject from "@/assets/banner-inject.webp";
import { useTranslation } from "react-i18next";

// Game card images
import valorantCardImg from "@/assets/games/valorant-card.webp";
import fortniteCardImg from "@/assets/games/fortnite-card.webp";
import lolCardImg from "@/assets/games/lol-card.webp";
import minecraftCardImg from "@/assets/games/minecraft-card.webp";

// Extracted components
import FloatingWidgets from "@/components/landing/FloatingWidgets";
import StickyMobileCTA from "@/components/landing/StickyMobileCTA";
import Footer from "@/components/landing/Footer";
import ReviewsSection from "@/components/landing/ReviewsSection";
import FaqSection from "@/components/landing/FaqSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import CtaSection from "@/components/landing/CtaSection";
import { fadeUp, staggerContainer, scaleIn, slideInLeft } from "@/components/landing/animations";


interface ProductFromDB {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  product_plans: { id: string; name: string; price: number; active: boolean }[];
}

// ─── Icons ──────────────────────────────────────────────────────────────────

const CartHeartIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 20C9 21.1 8.1 22 7 22S5 21.1 5 20 5.9 18 7 18 9 18.9 9 20M17 18C15.9 18 15 18.9 15 20S15.9 22 17 22 19 21.1 19 20 18.1 18 17 18M7.2 14.8V14.7L8.1 13H15.5C16.2 13 16.9 12.6 17.2 12L21.1 5L19.4 4L15.5 11H8.5L4.3 2H1V4H3L6.6 11.6L5.2 14C5.1 14.3 5 14.6 5 15C5 16.1 5.9 17 7 17H19V15H7.4C7.3 15 7.2 14.9 7.2 14.8M12 9.3L11.4 8.8C9.4 6.9 8 5.7 8 4.2C8 3 9 2 10.2 2C10.9 2 11.6 2.3 12 2.8C12.4 2.3 13.1 2 13.8 2C15 2 16 2.9 16 4.2C16 5.7 14.6 6.9 12.6 8.8L12 9.3Z" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/>
  </svg>
);

const StarHalfIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor">
    <path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.4,16.4,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65A8,8,0,0,0,128,181.1V32c.24,0,.27.08.35.26L153,91.86a8,8,0,0,0,6.75,4.92l63.91,5.16c.16,0,.25,0,.34.29S224,102.63,223.84,102.73Z"/>
  </svg>
);

// ─── Sections ───────────────────────────────────────────────────────────────

const GAME_CATEGORIES = [
  { name: "VALORANT", image: valorantCardImg, tab: "valorant", tagline: "Contas rankeadas e full acesso", badge: "Popular" },
  { name: "FORTNITE", image: fortniteCardImg, tab: "fortnite", tagline: "Skins raras e V-Bucks inclusos", badge: "Novo" },
  { name: "LOL", image: lolCardImg, tab: "lol", tagline: "Campeões, skins e ranks", badge: null },
  { name: "MINECRAFT", image: minecraftCardImg, tab: "minecraft", tagline: "Java & Bedrock Edition", badge: null },
];

const ContasSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="border-t border-border bg-background px-5 sm:px-6 py-14 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft} className="text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">{t("accounts.subtitle")}</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl" style={{ fontFamily: "'Valorant', sans-serif" }}>{t("accounts.title")}</h2>
        </motion.div>

        <motion.div
          className="mt-8 sm:mt-14 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={staggerContainer}
        >
          {GAME_CATEGORIES.map((game, idx) => (
            <motion.div
              key={game.tab}
              variants={fadeUp}
              custom={idx}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/40 bg-card transition-all duration-300 hover:border-success/60 hover:shadow-[0_0_40px_hsl(197,100%,50%,0.15)]"
              onClick={() => navigate(`/contas?game=${game.tab}`)}
            >
              {/* Image */}
              <div className="relative aspect-[3/4] overflow-hidden">
                <img
                  src={game.image}
                  alt={game.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                
                {/* Badge */}
                {game.badge && (
                  <div className="absolute top-3 right-3 rounded-full bg-success px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-success-foreground shadow-lg">
                    {game.badge}
                  </div>
                )}

                {/* Bottom content */}
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
                    {game.name}
                  </h3>
                  <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground leading-tight">{game.tagline}</p>
                  
                  <div className="mt-3 sm:mt-4 flex items-center gap-1.5 text-success text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all group-hover:gap-2.5">
                    <span>{t("accounts.exploreAccounts")}</span>
                    <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className="mt-10 sm:mt-12 flex justify-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <Link
            to="/contas"
            className="flex w-full sm:w-auto items-center justify-center gap-2 border-2 border-foreground/30 px-8 sm:px-14 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_30px_hsl(197,100%,50%,0.2)] rounded-lg sm:rounded-none"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("accounts.exploreAccounts")}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

const ProductsSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: dbProducts = [], isLoading } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, description, image_url, active, sort_order, game_id, created_at, status, status_label, status_updated_at, features_text, product_plans(*)")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .limit(6);
      return (data || []) as ProductFromDB[];
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <section className="border-t border-border bg-background px-5 sm:px-6 py-14 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft} className="text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">{t("products.subtitle")}</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl" style={{ fontFamily: "'Valorant', sans-serif" }}>{t("products.title")}</h2>
        </motion.div>

        {isLoading ? (
          <div className="mt-14 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-success" /></div>
        ) : dbProducts.length === 0 ? (
          <div className="mt-14 text-center text-muted-foreground">{t("products.empty")}</div>
        ) : (
          <motion.div
            className="mt-8 sm:mt-14 grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
          >
            {dbProducts.map((product, idx) => {
              const activePlans = product.product_plans?.filter(p => p.active) || [];
              const lowestPrice = activePlans.length > 0 ? Math.min(...activePlans.map(p => Number(p.price))) : null;
              return (
                <motion.div
                  key={product.id}
                  variants={scaleIn}
                  custom={idx}
                  onClick={() => navigate(`/produto/${product.id}`)}
                  className="group flex flex-col cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(197,100%,50%,0.1)]"
                >
                  <div className="relative aspect-square w-full overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        className="absolute inset-0 block h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-card">
                        <Package className="h-6 w-6 sm:h-10 sm:w-10 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-between p-2.5 sm:p-4 flex-1">
                    <h3 className="text-[11px] sm:text-sm font-bold text-foreground line-clamp-1">{product.name}</h3>
                    {product.description && (
                      <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground line-clamp-2 hidden sm:block">{product.description}</p>
                    )}
                    {lowestPrice !== null && (
                      <div className="mt-1.5 sm:mt-3 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[8px] sm:text-[10px] text-muted-foreground">{t("products.startingFrom")}</p>
                          <p className="text-sm sm:text-lg font-bold text-success">R$ {lowestPrice.toFixed(2)}</p>
                        </div>
                        <span className="hidden sm:flex items-center gap-1 rounded border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors group-hover:border-success group-hover:text-success">
                          {t("products.viewProduct")}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <motion.div className="mt-10 sm:mt-12 flex justify-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <Link to="/produtos" className="flex w-full sm:w-auto items-center justify-center gap-2 border-2 border-foreground/30 px-8 sm:px-14 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_30px_hsl(197,100%,50%,0.2)] rounded-lg sm:rounded-none" style={{ fontFamily: "'Valorant', sans-serif" }}>
            {t("products.viewAll")}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

const Index = () => {
  const { t } = useTranslation();

  const trustBadges = [
    { icon: CartHeartIcon, label: t("trust.deliveryLabel"), highlight: t("trust.deliveryHighlight") },
    { icon: ShieldIcon, label: t("trust.secureLabel"), highlight: t("trust.secureHighlight") },
    { icon: StarHalfIcon, label: t("trust.experienceLabel"), highlight: t("trust.experienceHighlight") },
  ];

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* HERO */}
      <main className="relative flex min-h-[85vh] sm:min-h-screen flex-col items-center justify-center px-5 sm:px-6 pt-8 sm:pt-0 pb-10 sm:pb-20 text-center overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[400px] sm:h-[550px] w-[600px] sm:w-[900px] -translate-x-1/2 -translate-y-1/2"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--border) / 0.8) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.8) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            filter: "blur(0.5px)",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[400px] sm:h-[600px] w-[600px] sm:w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_hsl(197,100%,50%,0.15)_0%,_transparent_65%)]" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} className="z-10 mb-6 sm:mb-10 flex items-center justify-center gap-2.5 rounded-full border border-success/20 bg-success/5 px-5 py-2">
          <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-success text-success" />
          <span className="text-xs sm:text-sm font-semibold tracking-wide text-success">{t("hero.badge")}</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }} className="z-10 mx-auto max-w-4xl text-[2rem] leading-[1.1] sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl lg:text-8xl">
          {t("hero.titlePre")}{" "}
          <span className="inline-block bg-gradient-to-r from-success via-[hsl(197,100%,70%)] to-success bg-[length:200%_100%] bg-clip-text text-transparent" style={{ fontFamily: "'Valorant', sans-serif" }}>
            Royal Store
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }} className="z-10 mt-5 sm:mt-8 mx-auto max-w-2xl text-[13px] leading-relaxed sm:text-lg text-muted-foreground md:text-xl px-4 sm:px-0">
          <span className="hidden sm:inline">{t("hero.descDesktop")}{" "}
          <span className="text-foreground font-medium">{t("hero.undetectable")}</span>,{" "}
          <span className="text-foreground font-medium">{t("hero.constantUpdates")}</span>{" "}{t("common.and") || "e"}{" "}
          <span className="text-foreground font-medium">{t("hero.dedicatedSupport")}</span>.
          {" "}{t("hero.descDesktopEnd")}</span>
          <span className="sm:hidden">{t("hero.descMobilePre")}{" "}<span className="text-foreground font-medium">{t("hero.instantDelivery")}</span>, <span className="text-foreground font-medium">{t("hero.support247")}</span>{" "}{t("auth.and") || "e"}{" "}<span className="text-foreground font-medium">{t("hero.totalGuarantee")}</span>. {t("hero.descMobileEnd")}</span>
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }} className="z-10 mt-8 sm:mt-12 flex w-full max-w-sm sm:max-w-none sm:w-auto flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 mx-auto px-2 sm:px-0">
          <Link to="/produtos" className="btn-shine group relative flex w-full sm:w-auto items-center justify-center gap-2 bg-success px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base font-semibold tracking-wide text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(197,100%,50%,0.5)] rounded-xl sm:rounded-none shadow-[0_0_20px_hsl(197,100%,50%,0.25)]">
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_hsl(197,100%,70%,0.3)_0%,_transparent_60%)]" />
            <span className="relative flex items-center gap-2">
              {t("hero.viewProducts")}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link to="/contas" className="w-full sm:w-auto border-2 border-success/40 px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-success transition-colors hover:border-foreground hover:text-foreground rounded-xl sm:rounded-none text-center">
            {t("hero.viewAccounts")}
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1.0 }} className="z-10 mt-10 sm:mt-20 mx-auto grid grid-cols-3 gap-4 sm:gap-10 md:gap-16 w-full max-w-sm sm:max-w-2xl px-2 sm:px-0">
          {trustBadges.map((item, idx) => (
            <motion.div key={item.highlight} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.0 + idx * 0.15 }} className="flex flex-col items-center gap-1.5 text-center">
              <item.icon className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
              <div>
                <span className="text-[10px] sm:text-sm text-muted-foreground block leading-tight">{item.label}</span>
                <p className="text-[11px] sm:text-base font-bold tracking-wide text-foreground leading-tight" style={{ fontFamily: "'Valorant', sans-serif" }}>{item.highlight}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.4 }} className="z-10 mt-8 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-success text-success" />
            ))}
          </div>
          <span className="text-center">{t("hero.ratingText")}</span>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.6 }} className="z-10 mt-10 sm:mt-16 hidden sm:flex animate-bounce flex-col items-center gap-1 text-muted-foreground">
          <span className="text-xs tracking-widest uppercase">{t("hero.explore")}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </motion.div>
      </main>

      {/* Banner */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="absolute inset-0">
          <img src={bannerInject} alt="" className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 py-12 sm:py-24 flex items-center justify-center">
          <motion.div className="text-center max-w-2xl mx-auto" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <h2 className="text-xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
              CHEATS <span className="text-success">&</span> ACCOUNTS
            </h2>
            <p className="mt-4 sm:mt-5 text-sm sm:text-base text-muted-foreground mx-auto px-4 sm:px-0">
              {t("banner.desc")}
            </p>
            <Link to="/produtos" className="mt-7 sm:mt-10 inline-flex items-center gap-2 bg-success px-8 sm:px-10 py-3 sm:py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(197,100%,50%,0.4)] rounded-xl sm:rounded-none" style={{ fontFamily: "'Valorant', sans-serif" }}>
              {t("hero.viewProducts")}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <ProductsSection />
      <ContasSection />
      <ReviewsSection />
      <HowItWorksSection />
      <CtaSection />
      <FaqSection />
      <Footer />
      <FloatingWidgets />
      <StickyMobileCTA />
    </div>
  );
};

export default Index;
