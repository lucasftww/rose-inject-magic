import { useState } from "react";
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
    <section id="faq" className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-[10px] sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{t("faq.subtitle")}</p>
          <h2 className="mt-1.5 sm:mt-3 text-xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
            {t("faq.title")}
          </h2>
        </div>

        <div className="mt-5 sm:mt-12 space-y-2">
          {faqItems.map((item, idx) => (
            <FaqItem key={idx} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
};

const FaqItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden transition-all duration-300 hover:border-success/20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="touch-manipulation flex w-full items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 text-left"
      >
        <span className="text-[11px] sm:text-sm font-semibold text-foreground pr-4">{question}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-success transition-transform duration-300 ${open ? "rotate-45" : ""}`}
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}>
        <p className="px-4 sm:px-5 pb-3.5 sm:pb-4 text-[10px] sm:text-sm leading-relaxed text-muted-foreground">{answer}</p>
      </div>
    </div>
  );
};

export default FaqSection;
