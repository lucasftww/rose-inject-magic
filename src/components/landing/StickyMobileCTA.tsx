import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const StickyMobileCTA = forwardRef<HTMLDivElement>((_, ref) => {
  const { t } = useTranslation();

  return (
    <div ref={ref} className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
      <div className="bg-card/95 backdrop-blur-xl border-t border-border/60 px-4 py-2.5 safe-area-bottom">
        <div className="flex gap-2">
          <Link
            to="/produtos"
            className="btn-shine touch-manipulation flex-1 flex items-center justify-center gap-2 bg-success py-3 text-[13px] font-bold tracking-wide text-success-foreground rounded-xl shadow-[0_4px_20px_hsl(197,100%,50%,0.25)]"
          >
            <span className="relative flex items-center gap-2">
              {t("mobileCta.viewProducts")}
            </span>
          </Link>
          <Link
            to="/contas"
            className="touch-manipulation flex-1 flex items-center justify-center gap-2 border-2 border-success/40 py-3 text-[13px] font-bold tracking-wide text-success rounded-xl"
          >
            {t("mobileCta.viewAccounts")}
          </Link>
        </div>
      </div>
    </div>
  );
});

StickyMobileCTA.displayName = "StickyMobileCTA";

export default StickyMobileCTA;
