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
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft}>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">{t("howItWorks.subtitle")}</p>
          <h2
            className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("howItWorks.title")}
          </h2>
        </motion.div>

        <motion.div
          className="mt-8 sm:mt-14 grid grid-cols-2 gap-3 sm:gap-8 md:grid-cols-2 lg:grid-cols-4"
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
              className="group relative rounded-xl sm:rounded-lg border border-border bg-card p-4 sm:p-6 transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(197,100%,50%,0.1)]"
            >
              <span
                className="text-2xl sm:text-4xl font-bold text-success/20 transition-colors group-hover:text-success/40"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                {item.step}
              </span>
              <h3 className="mt-2 sm:mt-3 text-sm sm:text-lg font-bold text-foreground">{item.title}</h3>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
