import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <motion.footer
      className="border-t border-border bg-background px-5 sm:px-6 py-10 sm:py-16 pb-28 sm:pb-16"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-6 sm:gap-12 md:grid-cols-4">
          <div className="col-span-2 sm:col-span-1 md:col-span-1">
            <h3
              className="text-lg sm:text-2xl font-bold text-foreground"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              <span className="text-success">ROYAL</span> STORE
            </h3>
            <p className="mt-2 sm:mt-3 text-[11px] sm:text-sm leading-relaxed text-muted-foreground">
              {t("footer.desc")}
            </p>
            <div className="mt-3 sm:mt-4 flex gap-2 sm:gap-3">
              <a href="https://discord.gg/royalstorebr" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_12px_hsl(197,100%,50%,0.15)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019"/>
                </svg>
              </a>
              <a href="https://www.instagram.com/royalstorebr.ofc/" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_12px_hsl(197,100%,50%,0.15)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0ZM8 1.442c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm0 2.452a4.108 4.108 0 1 0 0 8.215 4.108 4.108 0 0 0 0-8.215Zm0 6.775a2.667 2.667 0 1 1 0-5.334 2.667 2.667 0 0 1 0 5.334Zm5.23-6.937a.96.96 0 1 1-1.92 0 .96.96 0 0 1 1.92 0Z"/>
                </svg>
              </a>
              <a className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_12px_hsl(197,100%,50%,0.15)] cursor-default">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] sm:text-sm font-bold uppercase tracking-wider text-foreground">{t("footer.productsTitle")}</h4>
            <ul className="mt-2.5 sm:mt-4 space-y-1.5 sm:space-y-2">
              <li><Link to="/produtos" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("footer.softwareLink")}</Link></li>
              <li><Link to="/contas" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("footer.valorantAccounts")}</Link></li>
              <li><Link to="/produtos" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("footer.premiumSkins")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] sm:text-sm font-bold uppercase tracking-wider text-foreground">{t("footer.supportTitle")}</h4>
            <ul className="mt-2.5 sm:mt-4 space-y-1.5 sm:space-y-2">
              <li><Link to="/ajuda" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("footer.helpCenter")}</Link></li>
              <li><a href="https://discord.gg/royalstorebr" target="_blank" rel="noopener noreferrer" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">Discord</a></li>
              <li><Link to="/garantia" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("footer.warranty")}</Link></li>
              <li><Link to="/status" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("nav.status")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] sm:text-sm font-bold uppercase tracking-wider text-foreground">{t("footer.legalTitle")}</h4>
            <ul className="mt-2.5 sm:mt-4 space-y-1.5 sm:space-y-2">
              <li><Link to="/termos" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("footer.termsOfUse")}</Link></li>
              <li><Link to="/privacidade" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("footer.privacy")}</Link></li>
              <li><Link to="/reembolso" className="text-[11px] sm:text-sm text-muted-foreground transition-colors hover:text-success">{t("footer.refund")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 sm:mt-14 flex flex-col items-center justify-between gap-2 border-t border-border/50 pt-5 sm:pt-8 md:flex-row">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {t("footer.copyright")}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {t("footer.madeWith")}
          </p>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
