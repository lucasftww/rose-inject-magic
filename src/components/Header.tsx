import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, User, ChevronDown, Settings, ShieldAlert, Package, Menu, X, Home, ShoppingBag, Gamepad2, Activity, Star, Ticket, Globe, LogIn } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import logoRoyal from "@/assets/logo-royal.png";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";

const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  return name.slice(0, 2) + "****@" + domain;
};

const NAV_ITEMS = [
  { label: "Início", href: "/", icon: Home },
  { label: "Contas", href: "/contas", icon: Gamepad2 },
  { label: "Softwares", href: "/produtos", icon: ShoppingBag },
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, profile, isAdmin, signOut } = useAuth();
  const { requiresAuth, clearRequiresAuth } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const isLolContext =
    location.pathname.startsWith("/lol/") ||
    (location.pathname === "/contas" && new URLSearchParams(location.search).get("game") === "lol");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (requiresAuth) {
      setAuthTab("login");
      setAuthOpen(true);
      clearRequiresAuth();
    }
  }, [requiresAuth, clearRequiresAuth]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const accentColor = isLolContext ? LOL_BLUE : "hsl(var(--success))";
  const userInitial = (profile?.username || user?.email?.split("@")[0] || "U").charAt(0).toUpperCase();

  return (
    <>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />

      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-0 right-0 z-50 top-0"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className="flex h-14 sm:h-16 items-center px-0 transition-all duration-500"
          >
            {/* ── Logo ── */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <motion.img
                src={logoRoyal}
                alt="Royal Store"
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain shrink-0"
                whileHover={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.35 }}
              />
              <span
                className="text-base sm:text-lg tracking-[0.14em] whitespace-nowrap hidden sm:inline"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                <span className="text-success">ROYAL</span>
                <span className="text-foreground/60 ml-0.5">STORE</span>
              </span>
            </Link>

            {/* ── Separator ── */}
            <div className="hidden lg:block h-6 w-px mx-5 bg-foreground/[0.08]" />

            {/* ── Desktop nav ── */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
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
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              {/* Language pill */}
              <div
                className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-widest cursor-default select-none text-foreground/30"
                style={{ background: "hsla(0,0%,100%,0.03)" }}
              >
                <Globe className="w-2.5 h-2.5" />
                PT
              </div>

              {user ? (
                /* ── Logged-in bubble ── */
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl transition-all duration-200 active:scale-[0.97]"
                    style={{
                      background: dropdownOpen ? "hsla(0,0%,100%,0.1)" : "hsla(0,0%,100%,0.05)",
                      border: `1px solid ${dropdownOpen ? "hsla(0,0%,100%,0.14)" : "hsla(0,0%,100%,0.07)"}`,
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
                    <motion.div animate={{ rotate: dropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-3 h-3 text-foreground/30" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-[60]"
                        style={{
                          background: "hsla(0,0%,8%,0.96)",
                          backdropFilter: "blur(24px)",
                          border: "1px solid hsla(0,0%,100%,0.08)",
                          boxShadow: "0 16px 48px hsla(0,0%,0%,0.55), 0 0 0 1px hsla(0,0%,100%,0.03)",
                        }}
                      >
                        {/* User header */}
                        <div className="px-3.5 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.06)" }}>
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                              style={{ background: `${accentColor}18`, color: accentColor }}>
                              {userInitial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-foreground truncate">{profile?.username || "Usuário"}</p>
                            <p className="text-[10px] text-muted-foreground/70 truncate">{user.email ? maskEmail(user.email) : ""}</p>
                          </div>
                        </div>

                        <div className="p-1">
                          {[
                            { icon: User, label: "Meu Perfil", action: () => navigate("/dashboard") },
                            { icon: Package, label: "Meus Pedidos", action: () => navigate("/dashboard?tab=purchases") },
                            { icon: Settings, label: "Configurações", action: () => navigate("/dashboard?tab=settings") },
                          ].map(({ icon: Icon, label, action }) => (
                            <button
                              key={label}
                              onClick={() => { action(); setDropdownOpen(false); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {label}
                            </button>
                          ))}
                        </div>

                        {isAdmin && (
                          <div className="px-1 py-0.5" style={{ borderTop: "1px solid hsla(0,0%,100%,0.06)" }}>
                            <Link to="/admin" onClick={() => setDropdownOpen(false)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-success hover:bg-success/10 transition-colors">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Painel Admin
                            </Link>
                          </div>
                        )}

                        <div className="px-1 py-0.5" style={{ borderTop: "1px solid hsla(0,0%,100%,0.06)" }}>
                          <button onClick={() => { signOut(); setDropdownOpen(false); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-destructive/80 hover:bg-destructive/10 transition-colors">
                            <LogOut className="w-3.5 h-3.5" />
                            Sair
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* ── Login button ── */
                <button
                  onClick={() => { setAuthTab("login"); setAuthOpen(true); }}
                  className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-semibold tracking-wide transition-all duration-200 active:scale-[0.96]"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                    color: "hsl(var(--success-foreground))",
                    boxShadow: `0 2px 12px ${accentColor}30`,
                  }}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Entrar</span>
                </button>
              )}

              {/* ── Mobile hamburger ── */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 rounded-lg text-foreground/50 hover:text-foreground hover:bg-foreground/[0.05] transition-all active:scale-90"
              >
                <AnimatePresence mode="wait">
                  {mobileMenuOpen ? (
                    <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.12 }}>
                      <X className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.12 }}>
                      <Menu className="h-5 w-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Mobile menu overlay ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] lg:hidden"
            style={{ background: "hsla(0,0%,4%,0.98)", backdropFilter: "blur(28px)" }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5">
                <img src={logoRoyal} alt="Royal Store" className="h-8 w-8 object-contain" />
                <span className="text-base tracking-[0.14em]" style={{ fontFamily: "'Valorant', sans-serif" }}>
                  <span className="text-success">ROYAL</span>
                  <span className="text-foreground/60 ml-0.5">STORE</span>
                </span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors active:scale-90"
                style={{ background: "hsla(0,0%,100%,0.05)" }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User card */}
            {user && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mx-5 mt-3 flex items-center gap-3 rounded-xl p-3"
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
                  <p className="text-[11px] text-muted-foreground/60 truncate">{user.email ? maskEmail(user.email) : ""}</p>
                </div>
              </motion.div>
            )}

            {/* Nav links */}
            <nav className="mt-5 px-5 space-y-0.5">
              {NAV_ITEMS.map((item, i) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <motion.div key={item.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 + i * 0.035 }}>
                    <Link
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-all ${
                        active ? "text-success bg-success/[0.08]" : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] ${active ? "text-success" : "text-foreground/30"}`} />
                      {item.label}
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-success" />}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="mx-5 mt-3 h-px" style={{ background: "hsla(0,0%,100%,0.05)" }} />

            {user ? (
              <div className="px-5 mt-2 space-y-0.5">
                {[
                  { icon: User, label: "Meu Perfil", action: () => navigate("/dashboard") },
                  { icon: Package, label: "Meus Pedidos", action: () => navigate("/dashboard?tab=purchases") },
                  { icon: Settings, label: "Configurações", action: () => navigate("/dashboard?tab=settings") },
                ].map(({ icon: Icon, label, action }, i) => (
                  <motion.button key={label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.22 + i * 0.035 }}
                    onClick={() => { action(); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] transition-all">
                    <Icon className="w-[18px] h-[18px] text-foreground/25" />
                    {label}
                  </motion.button>
                ))}
                {isAdmin && (
                  <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.34 }}>
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium text-success hover:bg-success/[0.08] transition-all">
                      <ShieldAlert className="w-[18px] h-[18px]" />
                      Painel Admin
                    </Link>
                  </motion.div>
                )}
                <div className="pt-1.5">
                  <button onClick={() => { signOut(); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] text-destructive/70 hover:bg-destructive/[0.08] transition-all">
                    <LogOut className="w-[18px] h-[18px]" />
                    Sair
                  </button>
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="px-5 mt-5 space-y-2">
                <button onClick={() => { setAuthTab("register"); setAuthOpen(true); setMobileMenuOpen(false); }}
                  className="w-full py-3 text-[14px] font-semibold text-success-foreground rounded-xl transition-all btn-shine"
                  style={{ background: accentColor, boxShadow: `0 0 20px ${accentColor}20` }}>
                  Criar Conta
                </button>
                <button onClick={() => { setAuthTab("login"); setAuthOpen(true); setMobileMenuOpen(false); }}
                  className="w-full py-3 text-[14px] font-medium text-foreground/50 rounded-xl transition-colors hover:text-foreground"
                  style={{ background: "hsla(0,0%,100%,0.03)", border: "1px solid hsla(0,0%,100%,0.07)" }}>
                  Já tenho conta
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="h-[72px] sm:h-[80px]" />
    </>
  );
};

export default Header;
