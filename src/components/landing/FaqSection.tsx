import { useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, slideInLeft } from "./animations";
import { useTranslation } from "react-i18next";

const FaqSection = () => {
  const { t } = useTranslation();

  const faqItems = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
    { q: t("faq.q6"), a: t("faq.a6") },
  ];

  return (
    <section id="faq" className="border-t border-border bg-background px-5 sm:px-6 py-12 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={slideInLeft}
          className="text-center"
        >
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{t("faq.subtitle")}</p>
          <h2
            className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("faq.title")}
          </h2>
        </motion.div>

        <motion.div
          className="mt-6 sm:mt-14 space-y-2 sm:space-y-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={staggerContainer}
        >
          {faqItems.map((item, idx) => (
            <FaqItem key={idx} question={item.q} answer={item.a} index={idx} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const FaqItem = ({ question, answer, index }: { question: string; answer: string; index: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={fadeUp} custom={index} className="rounded-2xl border border-border/50 bg-card overflow-hidden transition-all duration-300 hover:border-success/20">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 sm:px-6 py-4 sm:py-5 text-left"
      >
        <span className="text-xs sm:text-base font-semibold text-foreground pr-4">{question}</span>
        <svg
          className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-success transition-transform duration-300 ${open ? "rotate-45" : ""}`}
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}
      >
        <p className="px-4 sm:px-6 pb-4 sm:pb-5 text-[11px] sm:text-sm leading-relaxed text-muted-foreground">{answer}</p>
      </div>
    </motion.div>
  );
};

export default FaqSection;
