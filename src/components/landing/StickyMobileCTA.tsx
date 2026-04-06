import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const StickyMobileCTA = forwardRef<HTMLDivElement>((_, ref) => {
  const { t } = useTranslation();

  return (
    <div ref={ref} className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
      <div className="bg-card border-t border-border/60 px-4 py-2.5 safe-area-bottom">
        <div className="flex gap-2">
          <Link
            to="/contas"
            className="touch-manipulation flex-1 flex items-center justify-center gap-2 bg-foreground py-3 text-[13px] font-bold tracking-wide text-background rounded-xl shadow-[0_4px_16px_rgba(255,255,255,0.1)]"
          >
            <span className="relative flex items-center gap-2">
              {t("mobileCta.viewAccounts")}
            </span>
          </Link>
          <Link
            to="/produtos"
            className="touch-manipulation flex-1 flex items-center justify-center gap-2 border border-foreground/20 bg-foreground/[0.06] py-3 text-[13px] font-bold tracking-wide text-foreground/80 rounded-xl"
          >
            {t("mobileCta.viewProducts")}
          </Link>
        </div>
      </div>
    </div>
  );
});

StickyMobileCTA.displayName = "StickyMobileCTA";

export default StickyMobileCTA;
