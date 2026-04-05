import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const FloatingWidgets = () => {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 flex items-end gap-2 sm:gap-3">
      <div
        className={`mb-1 rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3 shadow-lg transition-all duration-500 hidden sm:block ${
          showTooltip ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <p className="text-sm font-semibold text-foreground">{t("floatingWidget.title")}</p>
        <p className="text-xs text-muted-foreground">{t("floatingWidget.subtitle")}</p>
      </div>
      <a
        href="https://discord.gg/royalstorebr"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#5865F2] text-white shadow-[0_0_20px_rgba(88,101,242,0.4)] transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(88,101,242,0.6)]"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 127.14 96.36">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53.12S36,40.55,42.45,40.55,54,46.24,53.91,53.12,48.85,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53.12s5-12.57,11.44-12.57S96.23,46.24,96.12,53.12,91.06,65.69,84.69,65.69Z"/>
        </svg>
      </a>
    </div>
  );
};

export default FloatingWidgets;
