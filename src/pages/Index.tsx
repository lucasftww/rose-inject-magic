import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Star, ArrowRight, Loader2, Zap, Shield, Clock, Users, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

// Character overlay images
import bgCardCod from "@/assets/games/bg-card-cod.png";
import codNormal from "@/assets/games/cod-normal.png";
import codHover from "@/assets/games/cod-hover.png";
import bgCardPubg from "@/assets/games/bg-card-pubg.png";
import pubgNormal from "@/assets/games/pubg-normal.png";
import pubgHover from "@/assets/games/pubg-hover.png";
import bgCardFortnite from "@/assets/games/bg-card-fortnite.png";
import fortniteNormal from "@/assets/games/fortnite-normal.png";
import fortniteHover from "@/assets/games/fortnite-hover.png";

// Extracted components
import FloatingWidgets from "@/components/landing/FloatingWidgets";
import StickyMobileCTA from "@/components/landing/StickyMobileCTA";
import Footer from "@/components/landing/Footer";
import ReviewsSection from "@/components/landing/ReviewsSection";
import FaqSection from "@/components/landing/FaqSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
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

// Character overlay data for featured games
const characterOverlayMap: Record<string, { bg: string; character: string; characterHover: string }> = {
  "call of duty": { bg: bgCardCod, character: codNormal, characterHover: codHover },
  "call-of-duty": { bg: bgCardCod, character: codNormal, characterHover: codHover },
  cod: { bg: bgCardCod, character: codNormal, characterHover: codHover },
  pubg: { bg: bgCardPubg, character: pubgNormal, characterHover: pubgHover },
  fortnite: { bg: bgCardFortnite, character: fortniteNormal, characterHover: fortniteHover },
};

// Slugs to hide from the landing page software showcase
const HIDDEN_GAME_SLUGS = ["spoofers", "spoofer"];

interface GameFromDB {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  sort_order: number | null;
  active: boolean | null;
  products: { id: string; active: boolean | null }[];
}

// ─── Game Categories for Accounts ───────────────────────────────────────────
const GAME_CATEGORIES = [
  { name: "VALORANT", image: valorantCardImg, tab: "valorant", tagline: "Contas rankeadas e full acesso", badge: "Popular" },
  { name: "FORTNITE", image: fortniteCardImg, tab: "fortnite", tagline: "Skins raras e V-Bucks inclusos", badge: "Novo" },
  { name: "LOL", image: lolCardImg, tab: "lol", tagline: "Campeões, skins e ranks", badge: null },
  { name: "MINECRAFT", image: minecraftCardImg, tab: "minecraft", tagline: "Java & Bedrock Edition", badge: null },
];

// ─── Shared Section Header ──────────────────────────────────────────────────
const SectionHeader = ({ subtitle, title }: { subtitle: string; title: string }) => (
  <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft} className="text-center sm:text-left">
    <p className="text-[10px] sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{subtitle}</p>
    <h2 className="mt-1.5 sm:mt-3 text-xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
      {title}
    </h2>
  </motion.div>
);

// ─── Accounts Section ───────────────────────────────────────────────────────
const ContasSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeader subtitle={t("accounts.subtitle")} title={t("accounts.title")} />

        <motion.div
          className="mt-5 sm:mt-12 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer}
        >
          {GAME_CATEGORIES.map((game, idx) => (
            <motion.div
              key={game.tab}
              variants={fadeUp}
              custom={idx}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/40 bg-card transition-all duration-300 hover:border-success/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              onClick={() => navigate(`/contas?game=${game.tab}`)}
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <img src={game.image} alt={game.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

                {game.badge && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 rounded-full bg-success px-2 sm:px-2.5 py-0.5 text-[7px] sm:text-[10px] font-bold uppercase tracking-wider text-success-foreground shadow-lg shadow-success/20">
                    {game.badge}
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
                  <h3 className="text-sm sm:text-xl lg:text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
                    {game.name}
                  </h3>
                  <p className="mt-0.5 text-[8px] sm:text-[11px] text-muted-foreground leading-tight line-clamp-1">{game.tagline}</p>
                  <div className="mt-2 sm:mt-3 flex items-center gap-1 text-success text-[8px] sm:text-[11px] font-semibold uppercase tracking-wider group-hover:gap-2 transition-all">
                    <span>{t("accounts.exploreAccounts")}</span>
                    <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className="mt-6 sm:mt-10 flex justify-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <Link
            to="/contas"
            className="flex w-full sm:w-auto items-center justify-center gap-2 border border-foreground/15 px-6 sm:px-12 py-2.5 sm:py-3.5 text-[10px] sm:text-sm font-bold uppercase tracking-[0.2em] text-foreground/80 transition-all hover:border-success hover:text-success rounded-xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("accounts.exploreAccounts")}
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Software Section ───────────────────────────────────────────────────────
const SoftwareSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["landing-games-software"],
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("id, name, slug, image_url, sort_order, active, products:public_products(id, active)")
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
    <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeader subtitle={t("products.subtitle")} title={t("products.title")} />

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-success" /></div>
        ) : activeGames.length === 0 ? (
          <div className="mt-10 text-center text-muted-foreground text-sm">{t("products.empty")}</div>
        ) : (
          <motion.div
            className="mt-5 sm:mt-12 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4"
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={staggerContainer}
          >
            {activeGames.slice(0, 8).map((game, idx) => {
              const slug = (game.slug || game.name || "").toLowerCase();
              const image = softwareImageMap[slug] || game.image_url;
              const productCount = game.products?.filter(p => p.active).length || 0;
              const overlay = characterOverlayMap[slug];

              return (
                <SoftwareCard
                  key={game.id}
                  game={game}
                  image={overlay?.bg || image}
                  character={overlay?.character}
                  characterHover={overlay?.characterHover}
                  productCount={productCount}
                  index={idx}
                  onClick={() => handleGameClick(game)}
                  t={t}
                />
              );
            })}
          </motion.div>
        )}

        <motion.div className="mt-6 sm:mt-10 flex justify-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <Link
            to="/produtos"
            className="flex w-full sm:w-auto items-center justify-center gap-2 border border-foreground/15 px-6 sm:px-12 py-2.5 sm:py-3.5 text-[10px] sm:text-sm font-bold uppercase tracking-[0.2em] text-foreground/80 transition-all hover:border-success hover:text-success rounded-xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("products.viewAll")}
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
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

  const stats = [
    { value: "5.000+", label: t("hero.ratingText") || "Clientes satisfeitos", icon: Users },
    { value: "24/7", label: t("hero.support247") || "Suporte", icon: CheckCircle },
  ];

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* ═══ HERO ═══ */}
      <main className="relative flex min-h-[90vh] sm:min-h-screen flex-col items-center justify-center px-4 sm:px-6 pt-16 sm:pt-0 pb-6 sm:pb-16 text-center overflow-hidden">
        {/* Grid background */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[350px] sm:h-[600px] w-[450px] sm:w-[900px] -translate-x-1/2 -translate-y-1/2"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
            maskImage: "radial-gradient(ellipse at center, black 15%, transparent 65%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 15%, transparent 65%)",
          }}
        />
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[350px] sm:h-[600px] w-[450px] sm:w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_hsl(197,100%,50%,0.12)_0%,_transparent_55%)]" />

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="z-10 mb-4 sm:mb-6 flex items-center gap-1.5 rounded-full border border-success/20 bg-success/[0.06] px-3 sm:px-4 py-1 sm:py-1.5">
          <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-success text-success" />
          <span className="text-[9px] sm:text-xs font-semibold tracking-wide text-success">{t("hero.badge")}</span>
        </motion.div>

        {/* Title */}
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }} className="z-10 mx-auto max-w-3xl text-[1.6rem] leading-[1.08] sm:text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
          {t("hero.titlePre")}{" "}
          <span className="inline-block bg-gradient-to-r from-success via-[hsl(197,100%,70%)] to-success bg-[length:200%_100%] bg-clip-text text-transparent animate-[text-shine_4s_ease-in-out_infinite]" style={{ fontFamily: "'Valorant', sans-serif" }}>
            Royal Store
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }} className="z-10 mt-3 sm:mt-6 mx-auto max-w-xl text-[11px] leading-relaxed sm:text-base text-muted-foreground md:text-lg px-2 sm:px-0">
          <span className="hidden sm:inline">{t("hero.descDesktop")}{" "}
          <span className="text-foreground font-medium">{t("hero.undetectable")}</span>,{" "}
          <span className="text-foreground font-medium">{t("hero.constantUpdates")}</span>{" "}{t("common.and") || "e"}{" "}
          <span className="text-foreground font-medium">{t("hero.dedicatedSupport")}</span>.
          {" "}{t("hero.descDesktopEnd")}</span>
          <span className="sm:hidden">{t("hero.descMobilePre")}{" "}<span className="text-foreground font-medium">{t("hero.instantDelivery")}</span>, <span className="text-foreground font-medium">{t("hero.support247")}</span>{" "}{t("auth.and") || "e"}{" "}<span className="text-foreground font-medium">{t("hero.totalGuarantee")}</span>. {t("hero.descMobileEnd")}</span>
        </motion.p>

        {/* CTAs */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.65 }} className="z-10 mt-5 sm:mt-10 flex w-full max-w-xs sm:max-w-md flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 mx-auto">
          <Link to="/produtos" className="btn-shine group relative flex w-full sm:w-auto items-center justify-center gap-2 bg-success px-6 sm:px-8 py-3 sm:py-3.5 text-[12px] sm:text-sm font-semibold tracking-wide text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(197,100%,50%,0.4)] rounded-xl shadow-[0_4px_20px_hsl(197,100%,50%,0.25)]">
            <span className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_50%,_hsl(197,100%,70%,0.2)_0%,_transparent_60%)]" />
            <span className="relative flex items-center gap-2">
              {t("hero.viewProducts")}
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link to="/contas" className="w-full sm:w-auto border border-success/30 px-6 sm:px-8 py-3 sm:py-3.5 text-[12px] sm:text-sm font-medium text-success transition-all hover:border-success hover:bg-success/[0.06] rounded-xl text-center">
            {t("hero.viewAccounts")}
          </Link>
        </motion.div>

        {/* Trust badges — compact row */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.85 }} className="z-10 mt-8 sm:mt-14 mx-auto flex items-center justify-center gap-4 sm:gap-8">
          {trustBadges.map((item, idx) => (
            <motion.div key={item.highlight} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.85 + idx * 0.1 }} className="flex items-center gap-1.5 sm:gap-2.5">
              <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-success/[0.08] border border-success/10">
                <item.icon className="h-3 w-3 sm:h-4 sm:w-4 text-success" />
              </div>
              <div className="text-left">
                <p className="text-[8px] sm:text-[11px] font-bold tracking-wide text-foreground leading-tight" style={{ fontFamily: "'Valorant', sans-serif" }}>{item.highlight}</p>
                <span className="text-[7px] sm:text-[10px] text-muted-foreground leading-tight">{item.label}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Rating row */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.1 }} className="z-10 mt-4 sm:mt-8 flex items-center gap-1.5 text-muted-foreground">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 fill-success text-success" />
            ))}
          </div>
          <span className="text-[9px] sm:text-xs">{t("hero.ratingText")}</span>
        </motion.div>

        {/* Scroll indicator — desktop only */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.3 }} className="z-10 mt-6 sm:mt-10 hidden sm:flex animate-bounce flex-col items-center gap-1 text-muted-foreground/40">
          <span className="text-[9px] tracking-widest uppercase">{t("hero.explore")}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </motion.div>
      </main>

      {/* ═══ SECTIONS ═══ */}
      <SoftwareSection />
      <ContasSection />
      <ReviewsSection />
      <HowItWorksSection />
      <FaqSection />
      <Footer />
      <FloatingWidgets />
      <StickyMobileCTA />
    </div>
  );
};

export default Index;
