import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-background px-4 sm:px-6 py-10 sm:py-14 pb-28 sm:pb-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-6 sm:gap-10 md:grid-cols-4">
          <div className="col-span-2 sm:col-span-1 md:col-span-1">
            <h3 className="text-base sm:text-xl font-bold text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
              <span className="text-success">ROYAL</span> STORE
            </h3>
            <p className="mt-2 text-[10px] sm:text-xs leading-relaxed text-muted-foreground">
              {t("footer.desc")}
            </p>
            <div className="mt-3 flex gap-2">
              <a href="https://discord.gg/royalstorebr" target="_blank" rel="noopener noreferrer" className="touch-manipulation flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-all hover:border-success hover:text-success">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019"/>
                </svg>
              </a>
              <a href="https://www.instagram.com/royalstorebr.ofc/" target="_blank" rel="noopener noreferrer" className="touch-manipulation flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-all hover:border-success hover:text-success">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0ZM8 1.442c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm0 2.452a4.108 4.108 0 1 0 0 8.215 4.108 4.108 0 0 0 0-8.215Zm0 6.775a2.667 2.667 0 1 1 0-5.334 2.667 2.667 0 0 1 0 5.334Zm5.23-6.937a.96.96 0 1 1-1.92 0 .96.96 0 0 1 1.92 0Z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-foreground">{t("footer.productsTitle")}</h4>
            <ul className="mt-2 sm:mt-3 space-y-1.5">
              <li><Link to="/produtos" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("footer.softwareLink")}</Link></li>
              <li><Link to="/contas" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("footer.valorantAccounts")}</Link></li>
              <li><Link to="/produtos" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("footer.premiumSkins")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-foreground">{t("footer.supportTitle")}</h4>
            <ul className="mt-2 sm:mt-3 space-y-1.5">
              <li><Link to="/ajuda" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("footer.helpCenter")}</Link></li>
              <li><a href="https://discord.gg/royalstorebr" target="_blank" rel="noopener noreferrer" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">Discord</a></li>
              <li><Link to="/garantia" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("footer.warranty")}</Link></li>
              <li><Link to="/status" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("nav.status")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-foreground">{t("footer.legalTitle")}</h4>
            <ul className="mt-2 sm:mt-3 space-y-1.5">
              <li><Link to="/termos" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("footer.termsOfUse")}</Link></li>
              <li><Link to="/privacidade" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("footer.privacy")}</Link></li>
              <li><Link to="/reembolso" className="touch-manipulation text-[10px] sm:text-xs text-muted-foreground transition-colors hover:text-success">{t("footer.refund")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 sm:mt-10 flex flex-col items-center justify-between gap-1.5 border-t border-border/40 pt-5 sm:pt-6 md:flex-row">
          <p className="text-[9px] sm:text-[11px] text-muted-foreground/60">{t("footer.copyright")}</p>
          <p className="text-[9px] sm:text-[11px] text-muted-foreground/60">{t("footer.madeWith")}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
