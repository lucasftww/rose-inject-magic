import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "./animations";
import { useTranslation } from "react-i18next";

const CtaSection = () => {
  const { t } = useTranslation();

  return (
    <section className="border-t border-border bg-background px-5 sm:px-6 py-14 sm:py-32 relative overflow-hidden">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px] sm:h-[400px] sm:w-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,_hsl(197,100%,50%,0.06)_0%,_transparent_70%)]" />
      
      <motion.div
        className="relative mx-auto max-w-3xl text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        <motion.p variants={fadeUp} className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          {t("cta.subtitle")}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          custom={1}
          className="mt-3 sm:mt-6 text-2xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground md:text-7xl"
          style={{ fontFamily: "'Valorant', sans-serif" }}
        >
          {t("cta.title")}
        </motion.h2>
        <motion.p variants={fadeUp} custom={2} className="mt-3 sm:mt-6 text-xs sm:text-base leading-relaxed text-muted-foreground px-2 sm:px-0">
          {t("cta.desc")}
        </motion.p>
        <motion.div variants={fadeUp} custom={3} className="mt-7 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 px-2 sm:px-0">
          <Link
            to="/produtos"
            className="flex items-center justify-center gap-2 bg-success px-8 sm:px-10 py-3.5 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-success-foreground rounded-2xl sm:rounded-xl shadow-[0_4px_24px_hsl(197,100%,50%,0.25)]"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("cta.viewProducts")}
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
          <Link
            to="/contas"
            className="flex items-center justify-center gap-2 border-2 border-foreground/20 px-8 sm:px-10 py-3.5 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success rounded-2xl sm:rounded-xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("cta.exploreAccounts")}
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default CtaSection;
