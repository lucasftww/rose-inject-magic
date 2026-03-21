import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Star, ArrowRight, Loader2, Zap, Shield, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import bannerInject from "@/assets/banner-inject.webp";
import { useTranslation } from "react-i18next";

// Game card images (accounts)
import valorantCardImg from "@/assets/games/valorant-card.webp";
import fortniteCardImg from "@/assets/games/fortnite-card.webp";
import lolCardImg from "@/assets/games/lol-card.webp";
import minecraftCardImg from "@/assets/games/minecraft-card.webp";

// Software game images
import swValorant from "@/assets/games/sw-valorant.webp";
import swFortnite from "@/assets/games/sw-fortnite.webp";
import swCs2 from "@/assets/games/sw-cs2.webp";
import swApex from "@/assets/games/sw-apex.webp";
import swCod from "@/assets/games/sw-cod.webp";
import swRust from "@/assets/games/sw-rust.webp";
import swOverwatch from "@/assets/games/sw-overwatch2.webp";
import swFivem from "@/assets/games/sw-fivem.webp";
import swPubg from "@/assets/games/sw-pubg.webp";
import swMarvelRivals from "@/assets/games/sw-marvel-rivals.webp";
import swDayz from "@/assets/games/sw-dayz.webp";
import swSquad from "@/assets/games/sw-squad.webp";

// Extracted components
import FloatingWidgets from "@/components/landing/FloatingWidgets";
import StickyMobileCTA from "@/components/landing/StickyMobileCTA";
import Footer from "@/components/landing/Footer";
import ReviewsSection from "@/components/landing/ReviewsSection";
import FaqSection from "@/components/landing/FaqSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import CtaSection from "@/components/landing/CtaSection";
import { fadeUp, staggerContainer, scaleIn, slideInLeft } from "@/components/landing/animations";

// Local images map for software game cards
const softwareImageMap: Record<string, string> = {
  valorant: swValorant,
  fortnite: swFortnite,
  "cs2": swCs2,
  "counter-strike 2": swCs2,
  "counter-strike-2": swCs2,
  "counter strike 2": swCs2,
  "apex legends": swApex,
  "apex": swApex,
  "call of duty": swCod,
  "call-of-duty": swCod,
  "cod": swCod,
  rust: swRust,
  "overwatch 2": swOverwatch,
  overwatch: swOverwatch,
  fivem: swFivem,
  pubg: swPubg,
  "marvel rivals": swMarvelRivals,
  dayz: swDayz,
  squad: swSquad,
};

// Slugs to hide from the landing page software showcase
const HIDDEN_GAME_SLUGS = ["spoofers", "spoofer"];

// Local images map for account game cards
const accountImageMap: Record<string, string> = {
  valorant: valorantCardImg,
  fortnite: fortniteCardImg,
  lol: lolCardImg,
  minecraft: minecraftCardImg,
};

interface GameFromDB {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  sort_order: number | null;
  active: boolean | null;
  products: { id: string; active: boolean | null }[];
}

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
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{t("accounts.subtitle")}</p>
          <h2 className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl" style={{ fontFamily: "'Valorant', sans-serif" }}>{t("accounts.title")}</h2>
        </motion.div>

        <motion.div
          className="mt-6 sm:mt-14 grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-4"
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
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:border-success/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              onClick={() => navigate(`/contas?game=${game.tab}`)}
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <img
                  src={game.image}
                  alt={game.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                
                {game.badge && (
                  <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 rounded-full bg-success px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-xs font-bold uppercase tracking-wider text-success-foreground shadow-lg shadow-success/20">
                    {game.badge}
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
                  <h3 className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
                    {game.name}
                  </h3>
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground leading-tight">{game.tagline}</p>
                  
                  <div className="mt-2.5 sm:mt-4 flex items-center gap-1.5 text-success text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all group-hover:gap-2.5">
                    <span>{t("accounts.exploreAccounts")}</span>
                    <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className="mt-8 sm:mt-12 flex justify-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <Link
            to="/contas"
            className="flex w-full sm:w-auto items-center justify-center gap-2 border-2 border-foreground/20 px-8 sm:px-14 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_30px_hsl(197,100%,50%,0.15)] rounded-xl sm:rounded-lg"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("accounts.exploreAccounts")}
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

const SoftwareSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["landing-games-software"],
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("id, name, slug, image_url, sort_order, active, products:products(id, active)")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      return (data || []) as GameFromDB[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const activeGames = useMemo(
    () => games
      .filter(g => g.products?.some(p => p.active))
      .filter(g => {
        const slug = (g.slug || g.name || "").toLowerCase();
        return !HIDDEN_GAME_SLUGS.includes(slug);
      }),
    [games]
  );

  const handleGameClick = async (game: GameFromDB) => {
    const activeProducts = game.products?.filter(p => p.active) || [];
    if (activeProducts.length === 1) {
      navigate(`/produto/${activeProducts[0].id}`);
    } else {
      navigate(`/produtos?game=${game.slug || game.id}`);
    }
  };

  return (
    <section className="border-t border-border bg-background px-5 sm:px-6 py-14 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft} className="text-center sm:text-left">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{t("products.subtitle")}</p>
          <h2 className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl" style={{ fontFamily: "'Valorant', sans-serif" }}>{t("products.title")}</h2>
        </motion.div>

        {isLoading ? (
          <div className="mt-14 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-success" /></div>
        ) : activeGames.length === 0 ? (
          <div className="mt-14 text-center text-muted-foreground">{t("products.empty")}</div>
        ) : (
          <motion.div
            className="mt-6 sm:mt-14 grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
          >
            {activeGames.map((game, idx) => {
              const slug = (game.slug || game.name || "").toLowerCase();
              const image = softwareImageMap[slug] || game.image_url;
              const productCount = game.products?.filter(p => p.active).length || 0;

              return (
                <motion.div
                  key={game.id}
                  variants={scaleIn}
                  custom={idx}
                  onClick={() => handleGameClick(game)}
                  className="group relative flex flex-col cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:border-success/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden">
                    {image ? (
                      <img
                        src={image}
                        alt={game.name}
                        loading="lazy"
                        className="absolute inset-0 block h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-card">
                        <span className="text-2xl font-bold text-muted-foreground/20">{game.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

                    {/* Product count badge */}
                    {productCount > 0 && (
                      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 rounded-full bg-success/90 px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-xs font-bold text-success-foreground shadow-lg shadow-success/20">
                        {productCount} {productCount === 1 ? "software" : "softwares"}
                      </div>
                    )}

                    {/* Bottom content */}
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
                      <h3 className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
                        {game.name.toUpperCase()}
                      </h3>

                      <div className="mt-2.5 sm:mt-4 flex items-center gap-1.5 text-success text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all group-hover:gap-2.5">
                        <span>{productCount === 1 ? t("products.viewProduct") : t("products.viewProducts", { defaultValue: "Ver softwares" })}</span>
                        <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <motion.div className="mt-8 sm:mt-12 flex justify-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <Link to="/produtos" className="flex w-full sm:w-auto items-center justify-center gap-2 border-2 border-foreground/20 px-8 sm:px-14 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_30px_hsl(197,100%,50%,0.15)] rounded-xl sm:rounded-lg" style={{ fontFamily: "'Valorant', sans-serif" }}>
            {t("products.viewAll")}
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
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
    { icon: Zap, label: t("trust.deliveryLabel"), highlight: t("trust.deliveryHighlight") },
    { icon: Shield, label: t("trust.secureLabel"), highlight: t("trust.secureHighlight") },
    { icon: Clock, label: t("trust.experienceLabel"), highlight: t("trust.experienceHighlight") },
  ];

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* HERO */}
      <main className="relative flex min-h-[92vh] sm:min-h-screen flex-col items-center justify-center px-4 sm:px-6 pt-20 sm:pt-0 pb-8 sm:pb-20 text-center overflow-hidden">
        {/* Grid background */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[400px] sm:h-[600px] w-[500px] sm:w-[1000px] -translate-x-1/2 -translate-y-1/2"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          }}
        />
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[400px] sm:h-[700px] w-[500px] sm:w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_hsl(197,100%,50%,0.15)_0%,_transparent_60%)]" />

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} className="z-10 mb-4 sm:mb-8 flex items-center justify-center gap-1.5 rounded-full border border-success/20 bg-success/[0.06] px-3.5 sm:px-5 py-1.5 sm:py-2">
          <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-success text-success" />
          <span className="text-[10px] sm:text-sm font-semibold tracking-wide text-success">{t("hero.badge")}</span>
        </motion.div>

        {/* Title */}
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }} className="z-10 mx-auto max-w-4xl text-[1.75rem] leading-[1.1] sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl lg:text-8xl px-2">
          {t("hero.titlePre")}{" "}
          <span className="inline-block bg-gradient-to-r from-success via-[hsl(197,100%,70%)] to-success bg-[length:200%_100%] bg-clip-text text-transparent animate-[text-shine_4s_ease-in-out_infinite]" style={{ fontFamily: "'Valorant', sans-serif" }}>
            Royal Store
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }} className="z-10 mt-3 sm:mt-8 mx-auto max-w-2xl text-xs leading-relaxed sm:text-lg text-muted-foreground md:text-xl px-4 sm:px-0">
          <span className="hidden sm:inline">{t("hero.descDesktop")}{" "}
          <span className="text-foreground font-medium">{t("hero.undetectable")}</span>,{" "}
          <span className="text-foreground font-medium">{t("hero.constantUpdates")}</span>{" "}{t("common.and") || "e"}{" "}
          <span className="text-foreground font-medium">{t("hero.dedicatedSupport")}</span>.
          {" "}{t("hero.descDesktopEnd")}</span>
          <span className="sm:hidden">{t("hero.descMobilePre")}{" "}<span className="text-foreground font-medium">{t("hero.instantDelivery")}</span>, <span className="text-foreground font-medium">{t("hero.support247")}</span>{" "}{t("auth.and") || "e"}{" "}<span className="text-foreground font-medium">{t("hero.totalGuarantee")}</span>. {t("hero.descMobileEnd")}</span>
        </motion.p>

        {/* CTAs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }} className="z-10 mt-6 sm:mt-12 flex w-full max-w-xs sm:max-w-none sm:w-auto flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 mx-auto">
          <Link to="/produtos" className="btn-shine group relative flex w-full sm:w-auto items-center justify-center gap-2 bg-success px-6 sm:px-10 py-3 sm:py-4 text-[13px] sm:text-base font-semibold tracking-wide text-success-foreground transition-all hover:shadow-[0_0_40px_hsl(197,100%,50%,0.5)] rounded-xl shadow-[0_4px_24px_hsl(197,100%,50%,0.3)]">
            <span className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_50%,_hsl(197,100%,70%,0.25)_0%,_transparent_60%)]" />
            <span className="relative flex items-center gap-2">
              {t("hero.viewProducts")}
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link to="/contas" className="w-full sm:w-auto border-2 border-success/30 px-6 sm:px-10 py-3 sm:py-4 text-[13px] sm:text-base font-medium text-success transition-all hover:border-success hover:bg-success/[0.06] rounded-xl text-center">
            {t("hero.viewAccounts")}
          </Link>
        </motion.div>

        {/* Trust badges */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1.0 }} className="z-10 mt-8 sm:mt-20 mx-auto grid grid-cols-3 gap-2 sm:gap-10 md:gap-16 w-full max-w-[320px] sm:max-w-2xl">
          {trustBadges.map((item, idx) => (
            <motion.div key={item.highlight} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.0 + idx * 0.15 }} className="flex flex-col items-center gap-1 sm:gap-2 text-center">
              <div className="flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl bg-success/[0.08] border border-success/10">
                <item.icon className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-success" />
              </div>
              <div>
                <span className="text-[9px] sm:text-sm text-muted-foreground block leading-tight">{item.label}</span>
                <p className="text-[9px] sm:text-base font-bold tracking-wide text-foreground leading-tight mt-0.5" style={{ fontFamily: "'Valorant', sans-serif" }}>{item.highlight}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Rating */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.4 }} className="z-10 mt-5 sm:mt-10 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3 w-3 sm:h-4 sm:w-4 fill-success text-success" />
            ))}
          </div>
          <span className="text-[10px] sm:text-sm">{t("hero.ratingText")}</span>
        </motion.div>

        {/* Scroll indicator - desktop only */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.6 }} className="z-10 mt-8 sm:mt-14 hidden sm:flex animate-bounce flex-col items-center gap-1 text-muted-foreground/60">
          <span className="text-[10px] tracking-widest uppercase">{t("hero.explore")}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </motion.div>
      </main>

      {/* Banner */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="absolute inset-0">
          <img src={bannerInject} alt="" className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-background/65 backdrop-blur-sm" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-24 flex items-center justify-center">
          <motion.div className="text-center max-w-2xl mx-auto" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <h2 className="text-lg sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
              CHEATS <span className="text-success">&</span> ACCOUNTS
            </h2>
            <p className="mt-2 sm:mt-5 text-[11px] sm:text-base text-muted-foreground mx-auto px-2 sm:px-0">
              {t("banner.desc")}
            </p>
            <Link to="/produtos" className="mt-5 sm:mt-10 inline-flex items-center gap-2 bg-success px-6 sm:px-10 py-2.5 sm:py-3.5 text-[11px] sm:text-sm font-bold uppercase tracking-[0.2em] text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(197,100%,50%,0.4)] rounded-xl shadow-[0_4px_20px_hsl(197,100%,50%,0.2)]" style={{ fontFamily: "'Valorant', sans-serif" }}>
              {t("hero.viewProducts")}
              <ArrowRight className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <SoftwareSection />
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
