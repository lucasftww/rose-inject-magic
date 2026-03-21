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
    <section className="border-t border-border bg-background px-5 sm:px-6 py-12 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft} className="text-center sm:text-left">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{t("howItWorks.subtitle")}</p>
          <h2
            className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("howItWorks.title")}
          </h2>
        </motion.div>

        <motion.div
          className="mt-6 sm:mt-14 grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={staggerContainer}
        >
          {steps.map((item, idx) => (
            <motion.div
              key={idx}
              variants={fadeUp}
              custom={idx}
              className="group relative rounded-2xl border border-border/50 bg-card p-4 sm:p-6 transition-all duration-300 hover:border-success/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            >
              <span
                className="text-2xl sm:text-4xl font-bold text-success/15 transition-colors group-hover:text-success/30"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                {item.step}
              </span>
              <h3 className="mt-2 sm:mt-3 text-xs sm:text-lg font-bold text-foreground">{item.title}</h3>
              <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
