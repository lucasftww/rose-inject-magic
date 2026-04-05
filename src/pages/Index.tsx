import { lazy, Suspense } from "react";
import heroBg from "@/assets/hero-bg.jpg";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Star, ArrowRight, Loader2, Zap, Shield, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

const IndexGameShowcase = lazy(() => import("@/pages/landing/IndexGameShowcase"));
const ReviewsSection = lazy(() => import("@/components/landing/ReviewsSection"));
const HowItWorksSection = lazy(() => import("@/components/landing/HowItWorksSection"));
const FaqSection = lazy(() => import("@/components/landing/FaqSection"));
const CtaSection = lazy(() => import("@/components/landing/CtaSection"));
const Footer = lazy(() => import("@/components/landing/Footer"));
const FloatingWidgets = lazy(() => import("@/components/landing/FloatingWidgets"));
const StickyMobileCTA = lazy(() => import("@/components/landing/StickyMobileCTA"));

const GameShowcaseFallback = () => (
  <div
    className="border-t border-border bg-background px-4 sm:px-6 py-16 sm:py-24 flex justify-center items-center min-h-[280px]"
    aria-busy="true"
  >
    <Loader2 className="h-8 w-8 animate-spin text-success" />
  </div>
);

const LandingBelowFoldFallback = () => (
  <div className="min-h-[72px] w-full max-w-6xl mx-auto my-10 rounded-xl bg-muted/10 animate-pulse" aria-hidden />
);

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

      {/* ═══ HERO ═══ */}
      <main className="relative flex min-h-[90vh] sm:min-h-screen flex-col items-center justify-center px-4 sm:px-6 pt-16 sm:pt-0 pb-6 sm:pb-16 text-center overflow-hidden">
        {/* Hero background image */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src={heroBg}
            alt=""
            width={1920}
            height={1080}
            className="h-full w-full object-cover object-center scale-110"
            style={{ filter: 'blur(2px) brightness(0.45) saturate(1.3)' }}
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent" />
        </div>
        {/* Glow accent */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[350px] sm:h-[600px] w-[450px] sm:w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_hsl(197,100%,50%,0.1)_0%,_transparent_55%)]" />

        {/* Badge */}
        <div className="z-10 mb-4 sm:mb-6 flex items-center gap-1.5 rounded-full border border-success/20 bg-success/[0.06] px-3 sm:px-4 py-1 sm:py-1.5">
          <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-success text-success" />
          <span className="text-[9px] sm:text-xs font-semibold tracking-wide text-success">{t("hero.badge")}</span>
        </div>

        {/* Title */}
        <h1 className="z-10 mx-auto max-w-3xl text-[1.6rem] leading-[1.08] sm:text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
          {t("hero.titlePre")}{" "}
          <span className="inline-block bg-gradient-to-r from-success via-[hsl(197,100%,70%)] to-success bg-[length:200%_100%] bg-clip-text text-transparent animate-[text-shine_4s_ease-in-out_infinite] motion-reduce:animate-none" style={{ fontFamily: "'Valorant', sans-serif" }}>
            Royal Store
          </span>
        </h1>

        {/* Subtitle */}
        <p className="z-10 mt-3 sm:mt-6 mx-auto max-w-xl text-[11px] leading-relaxed sm:text-base text-muted-foreground md:text-lg px-2 sm:px-0">
          <span className="hidden sm:inline">{t("hero.descDesktop")}{" "}
          <span className="text-foreground font-medium">{t("hero.undetectable")}</span>,{" "}
          <span className="text-foreground font-medium">{t("hero.constantUpdates")}</span>{" "}{t("common.and")}{" "}
          <span className="text-foreground font-medium">{t("hero.dedicatedSupport")}</span>.
          {" "}{t("hero.descDesktopEnd")}</span>
          <span className="sm:hidden">{t("hero.descMobilePre")}{" "}<span className="text-foreground font-medium">{t("hero.instantDelivery")}</span>, <span className="text-foreground font-medium">{t("hero.support247")}</span>{" "}{t("common.and")}{" "}<span className="text-foreground font-medium">{t("hero.totalGuarantee")}</span>. {t("hero.descMobileEnd")}</span>
        </p>

        {/* CTAs */}
        <div className="z-10 mt-5 sm:mt-10 flex w-full max-w-xs sm:max-w-md flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 mx-auto">
          <Link to="/produtos" className="btn-shine touch-manipulation group relative flex w-full sm:w-auto items-center justify-center gap-2 bg-success px-6 sm:px-8 py-3 sm:py-3.5 text-[12px] sm:text-sm font-semibold tracking-wide text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(197,100%,50%,0.4)] rounded-xl shadow-[0_4px_20px_hsl(197,100%,50%,0.25)]">
            <span className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_50%,_hsl(197,100%,70%,0.2)_0%,_transparent_60%)]" />
            <span className="relative flex items-center gap-2">
              {t("hero.viewProducts")}
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link to="/contas" className="touch-manipulation w-full sm:w-auto border border-success/30 px-6 sm:px-8 py-3 sm:py-3.5 text-[12px] sm:text-sm font-medium text-success transition-all hover:border-success hover:bg-success/[0.06] rounded-xl text-center">
            {t("hero.viewAccounts")}
          </Link>
        </div>

        {/* Trust badges — compact row */}
        <div className="z-10 mt-8 sm:mt-14 mx-auto flex items-center justify-center gap-4 sm:gap-8">
          {trustBadges.map((item) => (
            <div key={item.highlight} className="flex items-center gap-1.5 sm:gap-2.5">
              <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-success/[0.08] border border-success/10">
                <item.icon className="h-3 w-3 sm:h-4 sm:w-4 text-success" />
              </div>
              <div className="text-left">
                <p className="text-[8px] sm:text-[11px] font-bold tracking-wide text-foreground leading-tight" style={{ fontFamily: "'Valorant', sans-serif" }}>{item.highlight}</p>
                <span className="text-[7px] sm:text-[10px] text-muted-foreground leading-tight">{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Rating row */}
        <div className="z-10 mt-4 sm:mt-8 flex items-center gap-1.5 text-muted-foreground">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 fill-success text-success" />
            ))}
          </div>
          <span className="text-[9px] sm:text-xs">{t("hero.ratingText")}</span>
        </div>

        {/* Scroll indicator — desktop only */}
        <div className="z-10 mt-6 sm:mt-10 hidden sm:flex motion-reduce:animate-none animate-bounce flex-col items-center gap-1 text-muted-foreground/40">
          <span className="text-[9px] tracking-widest uppercase">{t("hero.explore")}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </div>
      </main>

      {/* ═══ SECTIONS ═══ */}
      <Suspense fallback={<GameShowcaseFallback />}>
        <IndexGameShowcase />
      </Suspense>
      <Suspense fallback={<LandingBelowFoldFallback />}>
        <ReviewsSection />
        <HowItWorksSection />
        <FaqSection />
        <CtaSection />
        <Footer />
        <FloatingWidgets />
        <StickyMobileCTA />
      </Suspense>
    </div>
  );
};

export default Index;
