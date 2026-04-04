import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";

const languages = [
  { code: "pt", label: "Português", short: "PT", flag: "🇧🇷" },
  { code: "en", label: "English", short: "EN", flag: "🇺🇸" },
  { code: "es", label: "Español", short: "ES", flag: "🇪🇸" },
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
      const t = e.target;
      if (ref.current && t instanceof Node && !ref.current.contains(t)) setOpen(false);
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
      <div className="flex items-center gap-2 px-4 py-2">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => switchLang(lang.code)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.95] ${
              current.code === lang.code
                ? "bg-success/10 text-success ring-1 ring-success/30"
                : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05]"
            }`}
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span>{lang.short}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium select-none text-foreground/50 hover:text-foreground/80 transition-all active:scale-[0.97]"
        style={{ background: "hsla(0,0%,100%,0.04)" }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="uppercase tracking-wider font-semibold">{current.short}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50 shadow-xl animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150"
          style={{
            background: "hsla(0,0%,8%,0.98)",
            border: "1px solid hsla(0,0%,100%,0.08)",
            backdropFilter: "blur(20px)",
            minWidth: "150px",
          }}
        >
          {languages.map((lang, i) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={current.code === lang.code}
              onClick={() => switchLang(lang.code)}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-all ${
                i < languages.length - 1 ? "border-b border-foreground/[0.04]" : ""
              } ${
                current.code === lang.code
                  ? "text-success bg-success/[0.07]"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.05]"
              }`}
            >
              <span className="text-lg leading-none">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.label}</span>
              {current.code === lang.code && (
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
