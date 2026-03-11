import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "./animations";

const CtaSection = () => (
  <section className="border-t border-border bg-background px-4 sm:px-6 py-14 sm:py-32">
    <motion.div
      className="mx-auto max-w-3xl text-center"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={staggerContainer}
    >
      <motion.p variants={fadeUp} className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
        IAE? TA ESPERANDO OQUE?
      </motion.p>
      <motion.h2
        variants={fadeUp}
        custom={1}
        className="mt-4 sm:mt-6 text-2xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground md:text-7xl"
        style={{ fontFamily: "'Valorant', sans-serif" }}
      >
        PROXIMO NIVEL
      </motion.h2>
      <motion.p variants={fadeUp} custom={2} className="mt-4 sm:mt-6 text-sm sm:text-base leading-relaxed text-muted-foreground px-4 sm:px-0">
        Junte-se a centenas de jogadores que já garantiram a deles com total segurança.
      </motion.p>
      <motion.div variants={fadeUp} custom={3} className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 px-4 sm:px-0">
        <Link
          to="/produtos"
          className="flex items-center justify-center gap-2 bg-success px-10 py-4 text-sm font-bold uppercase tracking-[0.2em] text-success-foreground rounded-xl sm:rounded-none shadow-[0_0_20px_hsl(197,100%,50%,0.25)] sm:shadow-none"
          style={{ fontFamily: "'Valorant', sans-serif" }}
        >
          Ver Produtos
          <ArrowRight className="h-5 w-5" />
        </Link>
        <Link
          to="/contas"
          className="flex items-center justify-center gap-2 border-2 border-foreground/30 px-10 py-4 text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success rounded-xl sm:rounded-none"
          style={{ fontFamily: "'Valorant', sans-serif" }}
        >
          Explorar Contas
          <ArrowRight className="h-5 w-5" />
        </Link>
      </motion.div>
    </motion.div>
  </section>
);

export default CtaSection;
