import { useState, useEffect, useRef, useCallback, forwardRef, type TransitionEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Home, ShoppingBag, Gamepad2, Activity, Star, Ticket, LogIn, User, Package, Settings, LogOut } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import logoRoyal from "@/assets/logo-royal.png";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const LOL_BLUE = "hsl(198,100%,45%)";

const CLOSE_FALLBACK_MS = 280;

const Header = forwardRef<HTMLDivElement>((_props, _ref) => {
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [overlayEntered, setOverlayEntered] = useState(false);
  const closeFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();
  
  const { user, profile, signOut } = useAuth();
  const { requiresAuth, clearRequiresAuth } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const NAV_ITEMS = [
    { label: t("nav.home"), href: "/", icon: Home },
    { label: t("nav.accounts"), href: "/contas", icon: Gamepad2 },
    { label: t("nav.software"), href: "/produtos", icon: ShoppingBag },
    { label: t("nav.status"), href: "/status", icon: Activity },
    { label: t("nav.reviews"), href: "/avaliacoes", icon: Star },
    { label: t("nav.scratchCard"), href: "/raspadinha", icon: Ticket },
  ];

  const isLolContext =
    location.pathname.startsWith("/lol/") ||
    (location.pathname === "/contas" && new URLSearchParams(location.search).get("game") === "lol");

  const clearCloseFallback = useCallback(() => {
    if (closeFallbackRef.current) {
      clearTimeout(closeFallbackRef.current);
      closeFallbackRef.current = null;
    }
  }, []);

  const finishCloseOverlay = useCallback(() => {
    clearCloseFallback();
    setOverlayMounted(false);
    setOverlayEntered(false);
  }, [clearCloseFallback]);

  const requestCloseOverlay = useCallback(() => {
    setOverlayEntered(false);
    clearCloseFallback();
    closeFallbackRef.current = setTimeout(finishCloseOverlay, CLOSE_FALLBACK_MS);
  }, [clearCloseFallback, finishCloseOverlay]);

  useEffect(() => {
    if (!overlayMounted) {
      setOverlayEntered(false);
      return;
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setOverlayEntered(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [overlayMounted]);

  useEffect(() => () => clearCloseFallback(), [clearCloseFallback]);

  useEffect(() => {
    finishCloseOverlay();
  }, [location.pathname, finishCloseOverlay]);

  useEffect(() => {
    if (requiresAuth) {
      clearRequiresAuth();
      navigate("/auth?redirect=/checkout");
    }
  }, [requiresAuth, clearRequiresAuth, navigate]);

  useEffect(() => {
    document.body.style.overflow = overlayMounted ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [overlayMounted]);

  const handleOverlayTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "opacity") return;
    if (overlayEntered) return;
    finishCloseOverlay();
  };

  const toggleMobileMenu = () => {
    if (!overlayMounted) setOverlayMounted(true);
    else requestCloseOverlay();
  };

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const accentColor = isLolContext ? LOL_BLUE : "hsl(var(--success))";
  const userInitial = (profile?.username || user?.email?.split("@")[0] || "U").charAt(0).toUpperCase();

  return (
    <>
      <header className="fixed left-0 right-0 z-50 top-0 royal-header-enter">
        <div
          className="relative flex h-14 sm:h-16 items-center px-5 sm:px-8 lg:px-10 transition-[background,border-color] duration-500"
          style={{
            background: "hsla(0,0%,6%,0.92)",
            borderBottom: "1px solid hsla(0,0%,100%,0.06)",
          }}
        >
            {/* ── Logo ── */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <img
                src={logoRoyal}
                alt="Royal Store"
                width={44}
                height={44}
                className="sm:w-9 sm:h-9"
                decoding="async"
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain shrink-0 transition-transform duration-300 ease-out group-hover:-rotate-[8deg]"
              />
              <span
                className="text-base sm:text-lg tracking-[0.14em] whitespace-nowrap hidden sm:inline"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                <span className="text-success">ROYAL</span>
                <span className="text-foreground/60 ml-0.5">STORE</span>
              </span>
            </Link>

            {/* ── Desktop nav (centered) ── */}
            <nav className="hidden lg:flex items-center justify-center gap-1 absolute left-1/2 -translate-x-1/2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium tracking-[0.02em] transition-colors duration-150 ${
                      active
                        ? "text-success bg-success/[0.08]"
                        : "text-foreground/45 hover:text-foreground/80 hover:bg-foreground/[0.04]"
                    }`}
                  >
                    <Icon className="w-4 h-4 opacity-70" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* ── Right side ── */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {/* Language switcher */}
              <LanguageSwitcher />

              {user ? (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-xl transition-colors duration-200 active:scale-[0.97]"
                  style={{
                    background: "hsla(0,0%,100%,0.05)",
                    border: "1px solid hsla(0,0%,100%,0.07)",
                  }}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor}35, ${accentColor}12)`,
                        color: accentColor,
                      }}
                    >
                      {userInitial}
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-foreground/70 max-w-[72px] truncate hidden xl:block">
                    {profile?.username || user.email?.split("@")[0]}
                  </span>
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="flex items-center gap-2 px-4 sm:px-4.5 py-2 rounded-lg text-xs sm:text-[13px] font-semibold tracking-wide transition-colors duration-200 active:scale-[0.96]"
                  style={{
                    background: accentColor,
                    color: "hsl(var(--success-foreground))",
                    boxShadow: `0 0 18px ${accentColor}30`,
                  }}
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("nav.login")}</span>
                </Link>
              )}

              {/* ── Mobile hamburger ── */}
              <button
                type="button"
                onClick={toggleMobileMenu}
                aria-expanded={overlayMounted}
                aria-label={overlayMounted ? t("nav.closeMenu") || "Fechar menu" : t("nav.openMenu") || "Abrir menu"}
                className="lg:hidden p-1.5 rounded-lg text-foreground/50 hover:text-foreground hover:bg-foreground/[0.05] transition-colors active:scale-90"
              >
                {overlayMounted ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
      </header>

      {/* ── Mobile menu overlay (opacity transition on close) ── */}
      {overlayMounted && (
          <div
            className="fixed inset-0 z-[60] lg:hidden overflow-y-auto transition-opacity duration-200 ease-out motion-reduce:transition-none"
            style={{
              background: "hsla(0,0%,4%,0.98)",
              backdropFilter: "blur(28px)",
              opacity: overlayEntered ? 1 : 0,
            }}
            onTransitionEnd={handleOverlayTransitionEnd}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <Link to="/" onClick={requestCloseOverlay} className="flex items-center gap-2.5">
                <img src={logoRoyal} alt="Royal Store" className="h-8 w-8 object-contain" />
                <span className="text-base tracking-[0.14em]" style={{ fontFamily: "'Valorant', sans-serif" }}>
                  <span className="text-success">ROYAL</span>
                  <span className="text-foreground/60 ml-0.5">STORE</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={requestCloseOverlay}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-90"
                style={{ background: "hsla(0,0%,100%,0.05)" }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User card */}
            {user && (
              <div
                className="mx-5 mt-3 flex items-center gap-3 rounded-xl p-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
                style={{ background: "hsla(0,0%,100%,0.03)", border: "1px solid hsla(0,0%,100%,0.06)" }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: `${accentColor}12`, color: accentColor }}>
                    {userInitial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{profile?.username || user.email?.split("@")[0]}</p>
                  <p className="text-[11px] text-muted-foreground/60 truncate">{user.email || ""}</p>
                </div>
              </div>
            )}

            {/* Nav links */}
            <nav className="mt-5 px-5 space-y-0.5">
              {NAV_ITEMS.map((item, i) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <div
                    key={item.href}
                    className="mobile-nav-row-enter"
                    style={{ animationDelay: `${60 + i * 35}ms` }}
                  >
                    <Link
                      to={item.href}
                      onClick={requestCloseOverlay}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                        active ? "text-success bg-success/[0.08]" : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] ${active ? "text-success" : "text-foreground/30"}`} />
                      {item.label}
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-success" />}
                    </Link>
                  </div>
                );
              })}
            </nav>

            {/* Language switcher mobile */}
            <div className="mx-5 mt-3">
              <LanguageSwitcher variant="mobile" />
            </div>

            <div className="mx-5 mt-3 h-px" style={{ background: "hsla(0,0%,100%,0.05)" }} />

            {user ? (
              <div className="px-5 mt-2 space-y-0.5">
                {[
                  { icon: User, label: t("nav.myProfile"), action: () => navigate("/dashboard") },
                  { icon: Package, label: t("nav.myOrders"), action: () => navigate("/dashboard?tab=purchases") },
                  { icon: Settings, label: t("nav.settings"), action: () => navigate("/dashboard?tab=settings") },
                ].map(({ icon: Icon, label, action }, i) => (
                  <button
                    key={label}
                    type="button"
                    className="mobile-nav-row-enter flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                    style={{ animationDelay: `${220 + i * 35}ms` }}
                    onClick={() => { action(); requestCloseOverlay(); }}
                  >
                    <Icon className="w-[18px] h-[18px] text-foreground/25" />
                    {label}
                  </button>
                ))}
                <div className="pt-1.5">
                  <button type="button" onClick={() => { signOut(); requestCloseOverlay(); }}
                    className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] text-destructive/70 hover:bg-destructive/[0.08] transition-colors">
                    <LogOut className="w-[18px] h-[18px]" />
                    {t("nav.logout")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 mt-5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200" style={{ animationDelay: "250ms", animationFillMode: "both" }}>
                <Link to="/auth" onClick={requestCloseOverlay}
                  className="block w-full py-3 text-[14px] font-semibold text-success-foreground rounded-xl transition-colors btn-shine text-center"
                  style={{ background: accentColor, boxShadow: `0 0 20px ${accentColor}20` }}>
                  {t("nav.createAccount")}
                </Link>
                <Link to="/auth" onClick={requestCloseOverlay}
                  className="block w-full py-3 text-[14px] font-medium text-foreground/50 rounded-xl transition-colors hover:text-foreground text-center"
                  style={{ background: "hsla(0,0%,100%,0.03)", border: "1px solid hsla(0,0%,100%,0.07)" }}>
                  {t("nav.alreadyHaveAccount")}
                </Link>
              </div>
            )}
          </div>
      )}

      {/* Spacer */}
      <div className="h-14 sm:h-16" />
    </>
  );
});

Header.displayName = "Header";

export default Header;
