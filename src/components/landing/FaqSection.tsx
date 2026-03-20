import { useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, slideInLeft } from "./animations";

const faqItems = [
  {
    q: "Como funciona a entrega dos produtos?",
    a: "Após a confirmação do pagamento, a entrega é feita de forma instantânea. Você receberá os dados de acesso diretamente no seu e-mail e também poderá acessá-los pelo painel da sua conta.",
  },
  {
    q: "Os softwares são seguros e indetectáveis?",
    a: "Sim! Nossos softwares utilizam tecnologia de ponta com atualizações constantes para garantir total segurança. Trabalhamos com sistemas anti-detecção avançados que são atualizados diariamente.",
  },
  {
    q: "Quais formas de pagamento são aceitas?",
    a: "Aceitamos PIX, cartão de crédito, boleto bancário e criptomoedas. O PIX é processado instantaneamente, enquanto outras formas podem levar até 24 horas para confirmação.",
  },
  {
    q: "As contas Valorant possuem garantia?",
    a: "Sim! Todas as contas possuem garantia de 7 dias. Caso ocorra qualquer problema com a conta adquirida dentro desse período, realizamos a troca ou reembolso integral.",
  },
  {
    q: "Como entro em contato com o suporte?",
    a: "Nosso suporte está disponível 24/7 pelo Discord. Basta entrar no nosso servidor e abrir um ticket. O tempo médio de resposta é de até 15 minutos.",
  },
  {
    q: "Posso usar os produtos em qualquer região?",
    a: "Sim, nossos softwares funcionam em todas as regiões. As contas Valorant são específicas por região (BR, NA, EU), e você pode escolher a região desejada na hora da compra.",
  },
];

const FaqItem = ({ question, answer, index }: { question: string; answer: string; index: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={fadeUp} custom={index} className="rounded-lg border border-border bg-card overflow-hidden transition-colors hover:border-success/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="text-base font-semibold text-foreground pr-4">{question}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-success transition-transform duration-300 ${open ? "rotate-45" : ""}`}
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden min-h-0">
          <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{answer}</p>
        </div>
      </div>
    </motion.div>
  );
};

const FaqSection = () => (
  <section id="faq" className="border-t border-border bg-background px-5 sm:px-6 py-12 sm:py-24">
    <div className="mx-auto max-w-3xl">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={slideInLeft}
        className="text-center"
      >
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">Dúvidas Frequentes</p>
        <h2
          className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl"
          style={{ fontFamily: "'Valorant', sans-serif" }}
        >
          FAQ
        </h2>
      </motion.div>

      <motion.div
        className="mt-8 sm:mt-14 space-y-3 sm:space-y-4"
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

export default FaqSection;
