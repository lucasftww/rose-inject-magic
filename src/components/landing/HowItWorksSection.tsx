import { motion } from "framer-motion";
import { fadeUp, staggerContainer, slideInLeft } from "./animations";
import { useTranslation } from "react-i18next";

const HowItWorksSection = () => {
  const { t } = useTranslation();

  const steps = [
    { step: "01", title: t("howItWorks.step1Title"), desc: t("howItWorks.step1Desc") },
    { step: "02", title: t("howItWorks.step2Title"), desc: t("howItWorks.step2Desc") },
    { step: "03", title: t("howItWorks.step3Title"), desc: t("howItWorks.step3Desc") },
    { step: "04", title: t("howItWorks.step4Title"), desc: t("howItWorks.step4Desc") },
  ];

  return (
    <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft} className="text-center sm:text-left">
          <p className="text-[10px] sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{t("howItWorks.subtitle")}</p>
          <h2 className="mt-1.5 sm:mt-3 text-xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
            {t("howItWorks.title")}
          </h2>
        </motion.div>

        <motion.div
          className="mt-5 sm:mt-12 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={staggerContainer}
        >
          {steps.map((item, idx) => (
            <motion.div
              key={idx}
              variants={fadeUp}
              custom={idx}
              className="group relative rounded-xl border border-border/40 bg-card p-3.5 sm:p-5 transition-all duration-300 hover:border-success/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            >
              <span className="text-xl sm:text-3xl font-bold text-success/15 group-hover:text-success/30 transition-colors" style={{ fontFamily: "'Valorant', sans-serif" }}>
                {item.step}
              </span>
              <h3 className="mt-1.5 sm:mt-2.5 text-[11px] sm:text-base font-bold text-foreground leading-tight">{item.title}</h3>
              <p className="mt-1 sm:mt-2 text-[9px] sm:text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
