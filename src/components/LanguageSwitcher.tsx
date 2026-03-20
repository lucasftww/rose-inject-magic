import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const languages = [
  { code: "pt", label: "PT", flag: "🇧🇷" },
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "es", label: "ES", flag: "🇪🇸" },
];

interface Props {
  variant?: "desktop" | "mobile";
}

const LanguageSwitcher = ({ variant = "desktop" }: Props) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => i18n.language?.startsWith(l.code)) || languages[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchLang = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  if (variant === "mobile") {
    return (
      <div className="flex gap-1.5 px-4 py-2">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => switchLang(lang.code)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.95] ${
              current.code === lang.code
                ? "bg-success/10 text-success border border-success/30"
                : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04]"
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-widest select-none text-foreground/30 hover:text-foreground/60 transition-colors active:scale-[0.95]"
        style={{ background: "hsla(0,0%,100%,0.03)" }}
      >
        <Globe className="w-3 h-3" />
        {current.flag} {current.label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 rounded-lg overflow-hidden z-50"
            style={{
              background: "hsla(0,0%,8%,0.97)",
              border: "1px solid hsla(0,0%,100%,0.08)",
              backdropFilter: "blur(16px)",
              minWidth: "110px",
            }}
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => switchLang(lang.code)}
                className={`flex items-center gap-2 w-full px-3.5 py-2.5 text-[12px] font-medium tracking-wide transition-colors ${
                  current.code === lang.code
                    ? "text-success bg-success/[0.08]"
                    : "text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04]"
                }`}
              >
                <span className="text-sm">{lang.flag}</span>
                {lang.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;
