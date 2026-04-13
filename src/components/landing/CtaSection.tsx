import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const CtaSection = forwardRef<HTMLElement>(function CtaSection(_, ref) {
  const { t } = useTranslation();

  return (
    <section ref={ref} className="border-t border-border bg-background px-5 sm:px-6 py-14 sm:py-32 relative overflow-hidden">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px] sm:h-[400px] sm:w-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,_hsl(197,100%,50%,0.06)_0%,_transparent_70%)]" />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          {t("cta.subtitle")}
        </p>
        <h2
          className="mt-3 sm:mt-6 text-2xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground md:text-7xl"
          style={{ fontFamily: "'Valorant', sans-serif" }}
        >
          {t("cta.title")}
        </h2>
        <p className="mt-3 sm:mt-6 text-xs sm:text-base leading-relaxed text-muted-foreground px-2 sm:px-0">
          {t("cta.desc")}
        </p>
        <div className="mt-7 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 px-2 sm:px-0">
          <Link
            to="/contas"
            className="touch-manipulation flex items-center justify-center gap-2 bg-foreground px-8 sm:px-10 py-3.5 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-background rounded-2xl sm:rounded-xl shadow-[0_4px_16px_rgba(255,255,255,0.1)]"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("cta.exploreAccounts")}
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
          <Link
            to="/produtos"
            className="touch-manipulation flex items-center justify-center gap-2 bg-foreground/10 border border-foreground/15 px-8 sm:px-10 py-3.5 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-foreground transition-all hover:bg-foreground/15 rounded-2xl sm:rounded-xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("cta.viewProducts")}
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
});

export default CtaSection;
