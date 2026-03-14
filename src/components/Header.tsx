import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, User, ChevronDown, Settings, ShieldAlert, Package, Menu, X, Home, ShoppingBag, Gamepad2, Activity, Star, Ticket } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import logoRoyal from "@/assets/logo-royal.png";
import AuthModal from "@/components/AuthModal";

import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";
import DiscordBanner from "@/components/DiscordBanner";

const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  return name.slice(0, 2) + "****@" + domain;
};

const NAV_ITEMS = [
  { label: "Início", href: "/", icon: Home },
  { label: "Produtos", href: "/produtos", icon: ShoppingBag },
  { label: "Contas", href: "/contas", icon: Gamepad2 },
  { label: "Status", href: "/status", icon: Activity },
  { label: "Avaliações", href: "/avaliacoes", icon: Star },
  { label: "Raspadinha", href: "/raspadinha", icon: Ticket },
];

const LOL_BLUE = "hsl(198,100%,45%)";

const Header = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, profile, isAdmin, signOut } = useAuth();
  const { requiresAuth, clearRequiresAuth } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const isLolContext =
    location.pathname.startsWith("/lol/") ||
    (location.pathname === "/contas" && new URLSearchParams(location.search).get("game") === "lol");

  // Detect scroll for header elevation
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (requiresAuth) {
      setAuthTab("login");
      setAuthOpen(true);
      clearRequiresAuth();
    }
  }, [requiresAuth, clearRequiresAuth]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const accentColor = isLolContext ? LOL_BLUE : "hsl(var(--success))";

  return (
    <>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />

      <div className="fixed top-0 left-0 right-0 z-50">
        <DiscordBanner onVisibilityChange={setBannerVisible} />
      </div>

      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${bannerVisible ? 'mt-[36px]' : 'mt-0'}`}
        style={{
          borderBottom: `1px solid ${scrolled ? (isLolContext ? `${LOL_BLUE}20` : "hsl(var(--border))") : "transparent"}`,
          background: scrolled
            ? isLolContext
              ? "hsla(220,30%,8%,0.92)"
              : "hsla(0,0%,7.5%,0.85)"
            : "transparent",
          backdropFilter: scrolled ? "blur(20px) saturate(1.5)" : "none",
          boxShadow: scrolled ? "0 4px 30px hsla(0,0%,0%,0.3)" : "none",
        }}
      >
        <div className="mx-auto flex h-14 sm:h-16 lg:h-[72px] max-w-7xl items-center justify-between px-4 sm:px-5 lg:px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 lg:gap-3 shrink-0 group">
            <motion.img
              src={logoRoyal}
              alt="Royal Store"
              className="h-9 w-9 lg:h-11 lg:w-11 object-contain shrink-0"
              whileHover={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.5 }}
            />
            <span
              className="text-lg sm:text-xl lg:text-2xl tracking-[0.15em] sm:tracking-[0.2em] whitespace-nowrap"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              <span className="inline-block bg-gradient-to-r from-success via-[hsl(197,100%,70%)] to-success bg-[length:200%_100%] bg-clip-text text-transparent animate-[text-shine_3s_ease-in-out_infinite]">
                ROYAL
              </span>
              <span className="text-foreground/80"> STORE</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className="relative px-4 py-2 text-sm font-medium tracking-wide transition-colors duration-200 group"
                  style={{
                    color: active ? accentColor : "hsl(var(--muted-foreground))",
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = "hsl(var(--foreground))";
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))";
                  }}
                >
                  {item.label}
                  {/* Active indicator line */}
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                      style={{ background: accentColor }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 lg:gap-2.5">
            {user ? (
              <>

                {/* Desktop user dropdown */}
                <div className="relative hidden lg:block" ref={dropdownRef}>
                  <motion.button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all duration-200 hover:border-muted-foreground/30"
                    style={{
                      borderColor: dropdownOpen ? `${accentColor}50` : "hsl(var(--border))",
                      background: dropdownOpen ? "hsl(var(--accent))" : "hsl(var(--secondary))",
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-8 h-8 rounded-md object-cover ring-2 ring-border" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm"
                        style={{
                          background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
                          color: accentColor,
                          border: `1px solid ${accentColor}25`,
                        }}
                      >
                        {(profile?.username || user.email?.split("@")[0] || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-left hidden xl:block max-w-[120px]">
                      <p className="text-sm font-semibold text-foreground leading-tight truncate">
                        {profile?.username || user.email?.split("@")[0]}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {user.email ? maskEmail(user.email) : ""}
                      </p>
                    </div>
                    <motion.div
                      animate={{ rotate: dropdownOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </motion.button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.95 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-2.5 w-60 rounded-lg border border-border bg-card shadow-[0_20px_60px_hsla(0,0%,0%,0.5),0_0_0_1px_hsla(0,0%,100%,0.03)] z-[60] overflow-hidden"
                      >
                        {/* User header */}
                        <div className="px-4 py-3.5 border-b border-border flex items-center gap-3">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-md object-cover ring-2 ring-border" />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-md flex items-center justify-center font-bold text-base shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
                                color: accentColor,
                                border: `1px solid ${accentColor}25`,
                              }}
                            >
                              {(profile?.username || user.email?.split("@")[0] || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{profile?.username || "Usuário"}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email ? maskEmail(user.email) : ""}</p>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="p-1.5">
                          {[
                            { icon: User, label: "Meu Perfil", action: () => navigate("/dashboard") },
                            { icon: Package, label: "Meus Pedidos", action: () => navigate("/dashboard?tab=purchases") },
                            { icon: Settings, label: "Configurações", action: () => navigate("/dashboard?tab=settings") },
                          ].map(({ icon: Icon, label, action }, i) => (
                            <motion.button
                              key={label}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              onClick={() => { action(); setDropdownOpen(false); }}
                              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors group"
                            >
                              <Icon className="w-4 h-4 group-hover:text-foreground transition-colors" />
                              {label}
                            </motion.button>
                          ))}
                        </div>

                        {isAdmin && (
                          <div className="border-t border-border px-1.5 py-1.5">
                            <Link
                              to="/admin"
                              onClick={() => setDropdownOpen(false)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-success hover:bg-success/10 transition-colors"
                            >
                              <ShieldAlert className="w-4 h-4" />
                              Painel Admin
                            </Link>
                          </div>
                        )}

                        <div className="border-t border-border px-1.5 py-1.5">
                          <button
                            onClick={() => { signOut(); setDropdownOpen(false); }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sair
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <motion.button
                  onClick={() => { setAuthTab("login"); setAuthOpen(true); }}
                  className="hidden sm:inline-flex border border-border/60 px-4 lg:px-5 py-1.5 text-[13px] font-medium tracking-wide text-muted-foreground rounded-md transition-all duration-200 hover:border-success/40 hover:text-foreground"
                  whileTap={{ scale: 0.97 }}
                >
                  Entrar
                </motion.button>
                <motion.button
                  onClick={() => { setAuthTab("register"); setAuthOpen(true); }}
                  className="inline-flex px-3.5 sm:px-4 lg:px-5 py-1.5 text-[11px] sm:text-[13px] font-semibold tracking-wide whitespace-nowrap rounded-md transition-all duration-200 btn-shine"
                  style={{
                    background: isLolContext ? LOL_BLUE : "hsl(var(--success))",
                    color: "white",
                    boxShadow: `0 0 16px ${isLolContext ? LOL_BLUE : "hsl(var(--success))"}20`,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Criar Conta
                </motion.button>
              </>
            )}

            {/* Mobile hamburger */}
            <motion.button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                {mobileMenuOpen ? (
                  <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <X className="h-6 w-6" />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Menu className="h-6 w-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu — fullscreen overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] lg:hidden"
            style={{ background: "hsla(0,0%,5%,0.97)", backdropFilter: "blur(24px)" }}
          >
            {/* Close button */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                <img src={logoRoyal} alt="Royal Store" className="h-8 w-8 object-contain" />
                <span className="text-lg tracking-[0.15em]" style={{ fontFamily: "'Valorant', sans-serif" }}>
                  <span className="bg-gradient-to-r from-success via-[hsl(197,100%,70%)] to-success bg-[length:200%_100%] bg-clip-text text-transparent">ROYAL</span>
                  <span className="text-foreground/80"> STORE</span>
                </span>
              </Link>
              <motion.button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-full bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            {/* User card */}
            {user && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mx-5 mt-4 flex items-center gap-3 rounded-xl p-3"
                style={{ background: "hsla(0,0%,100%,0.04)", border: "1px solid hsla(0,0%,100%,0.06)" }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover ring-2 ring-border/30" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: `${accentColor}15`, color: accentColor }}
                  >
                    {(profile?.username || user.email?.split("@")[0] || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {profile?.username || user.email?.split("@")[0]}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {user.email ? maskEmail(user.email) : ""}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Nav links */}
            <nav className="mt-6 px-5 space-y-1">
              {NAV_ITEMS.map((item, i) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + i * 0.04 }}
                  >
                    <Link
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-all ${
                        active
                          ? "text-success bg-success/10"
                          : "text-foreground/70 hover:text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] ${active ? "text-success" : "text-muted-foreground"}`} />
                      {item.label}
                      {active && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-success" />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* Divider + account actions */}
            <div className="mx-5 mt-4 border-t border-border/20" />

            {user ? (
              <div className="px-5 mt-3 space-y-1">
                {[
                  { icon: User, label: "Meu Perfil", action: () => navigate("/dashboard") },
                  { icon: Package, label: "Meus Pedidos", action: () => navigate("/dashboard?tab=purchases") },
                  { icon: Settings, label: "Configurações", action: () => navigate("/dashboard?tab=settings") },
                ].map(({ icon: Icon, label, action }, i) => (
                  <motion.button
                    key={label}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.04 }}
                    onClick={() => { action(); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] text-foreground/60 hover:text-foreground hover:bg-secondary/60 transition-all"
                  >
                    <Icon className="w-[18px] h-[18px] text-muted-foreground" />
                    {label}
                  </motion.button>
                ))}
                {isAdmin && (
                  <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.37 }}>
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium text-success hover:bg-success/10 transition-all"
                    >
                      <ShieldAlert className="w-[18px] h-[18px]" />
                      Painel Admin
                    </Link>
                  </motion.div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => { signOut(); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] text-destructive/80 hover:bg-destructive/10 transition-all"
                  >
                    <LogOut className="w-[18px] h-[18px]" />
                    Sair
                  </button>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="px-5 mt-5 space-y-2.5"
              >
                <button
                  onClick={() => { setAuthTab("register"); setAuthOpen(true); setMobileMenuOpen(false); }}
                  className="w-full py-3 text-[15px] font-semibold text-success-foreground rounded-xl transition-all btn-shine"
                  style={{
                    background: isLolContext ? LOL_BLUE : "hsl(var(--success))",
                    boxShadow: `0 0 24px ${isLolContext ? LOL_BLUE : "hsl(var(--success))"}25`,
                  }}
                >
                  Criar Conta
                </button>
                <button
                  onClick={() => { setAuthTab("login"); setAuthOpen(true); setMobileMenuOpen(false); }}
                  className="w-full py-3 text-[15px] font-medium text-muted-foreground rounded-xl transition-colors"
                  style={{ background: "hsla(0,0%,100%,0.04)", border: "1px solid hsla(0,0%,100%,0.08)" }}
                >
                  Já tenho conta
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer to prevent content from being hidden behind fixed header */}
      <div className={`${bannerVisible ? 'h-[92px] sm:h-[108px] lg:h-[108px]' : 'h-14 sm:h-16 lg:h-[72px]'} transition-all duration-300`} />
    </>
  );
};

export default Header;
