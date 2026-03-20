import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, User, ChevronDown, Settings, ShieldAlert, Package, Menu, X, Home, ShoppingBag, Gamepad2, Activity, Star, Ticket, Globe } from "lucide-react";
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
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 180 }}
        className={`fixed left-0 right-0 z-50 transition-all duration-500 ${bannerVisible ? 'top-[30px] sm:top-[32px]' : 'top-0'}`}
      >
        {/* Glassmorphic bar — centered with max-width, floating feel */}
        <div className="mx-auto max-w-5xl px-3 sm:px-4 lg:px-5 pt-3">
          <div
            className="flex h-14 items-center rounded-2xl px-4 sm:px-5 transition-all duration-500"
            style={{
              background: scrolled
                ? "hsla(0,0%,8%,0.75)"
                : "hsla(0,0%,8%,0.35)",
              backdropFilter: "blur(24px) saturate(1.4)",
              border: `1px solid ${scrolled ? "hsla(0,0%,100%,0.08)" : "hsla(0,0%,100%,0.04)"}`,
              boxShadow: scrolled
                ? "0 8px 32px hsla(0,0%,0%,0.4), inset 0 1px 0 hsla(0,0%,100%,0.04)"
                : "0 4px 20px hsla(0,0%,0%,0.15), inset 0 1px 0 hsla(0,0%,100%,0.02)",
            }}
          >
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0 group mr-6">
              <motion.img
                src={logoRoyal}
                alt="Royal Store"
                className="h-8 w-8 object-contain shrink-0"
                whileHover={{ rotate: [0, -6, 6, 0] }}
                transition={{ duration: 0.4 }}
              />
              <span
                className="text-base sm:text-lg tracking-[0.15em] whitespace-nowrap hidden sm:inline"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                <span className="text-success">ROYAL</span>
                <span className="text-foreground/70"> STORE</span>
              </span>
            </Link>

            {/* Desktop nav — centered */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium uppercase tracking-[0.08em] transition-all duration-200 group"
                    style={{
                      color: active ? accentColor : "hsla(0,0%,100%,0.5)",
                      background: active ? `${accentColor}12` : "transparent",
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = "hsla(0,0%,100%,0.85)";
                        (e.currentTarget as HTMLElement).style.background = "hsla(0,0%,100%,0.05)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = "hsla(0,0%,100%,0.5)";
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute -bottom-0.5 left-3 right-3 h-[2px] rounded-full"
                        style={{ background: accentColor }}
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right side — lang + user */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Language badge (decorative) */}
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider cursor-default select-none"
                style={{
                  color: "hsla(0,0%,100%,0.45)",
                  background: "hsla(0,0%,100%,0.04)",
                  border: "1px solid hsla(0,0%,100%,0.06)",
                }}
              >
                <Globe className="w-3 h-3" />
                PT
              </div>

              {user ? (
                /* Logged-in user bubble */
                <div className="relative" ref={dropdownRef}>
                  <motion.button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl transition-all duration-200 active:scale-[0.97]"
                    style={{
                      background: dropdownOpen ? "hsla(0,0%,100%,0.1)" : "hsla(0,0%,100%,0.05)",
                      border: `1px solid ${dropdownOpen ? "hsla(0,0%,100%,0.12)" : "hsla(0,0%,100%,0.06)"}`,
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}15)`,
                          color: accentColor,
                        }}
                      >
                        {userInitial}
                      </div>
                    )}
                    <span className="text-xs font-medium text-foreground/80 max-w-[80px] truncate hidden xl:block">
                      {profile?.username || user.email?.split("@")[0]}
                    </span>
                    <motion.div animate={{ rotate: dropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-3.5 h-3.5 text-foreground/40" />
                    </motion.div>
                  </motion.button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-2.5 w-56 rounded-xl overflow-hidden z-[60]"
                        style={{
                          background: "hsla(0,0%,10%,0.95)",
                          backdropFilter: "blur(20px)",
                          border: "1px solid hsla(0,0%,100%,0.08)",
                          boxShadow: "0 20px 60px hsla(0,0%,0%,0.5)",
                        }}
                      >
                        {/* User header */}
                        <div className="px-4 py-3.5 flex items-center gap-3" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.06)" }}>
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                              style={{ background: `${accentColor}20`, color: accentColor }}>
                              {userInitial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{profile?.username || "Usuário"}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{user.email ? maskEmail(user.email) : ""}</p>
                          </div>
                        </div>

                        <div className="p-1.5">
                          {[
                            { icon: User, label: "Meu Perfil", action: () => navigate("/dashboard") },
                            { icon: Package, label: "Meus Pedidos", action: () => navigate("/dashboard?tab=purchases") },
                            { icon: Settings, label: "Configurações", action: () => navigate("/dashboard?tab=settings") },
                          ].map(({ icon: Icon, label, action }, i) => (
                            <motion.button
                              key={label}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              onClick={() => { action(); setDropdownOpen(false); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-foreground/60 hover:bg-accent hover:text-foreground transition-colors"
                            >
                              <Icon className="w-4 h-4" />
                              {label}
                            </motion.button>
                          ))}
                        </div>

                        {isAdmin && (
                          <div className="px-1.5 py-1" style={{ borderTop: "1px solid hsla(0,0%,100%,0.06)" }}>
                            <Link to="/admin" onClick={() => setDropdownOpen(false)}
                              className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-success hover:bg-success/10 transition-colors">
                              <ShieldAlert className="w-4 h-4" />
                              Painel Admin
                            </Link>
                          </div>
                        )}

                        <div className="px-1.5 py-1" style={{ borderTop: "1px solid hsla(0,0%,100%,0.06)" }}>
                          <button onClick={() => { signOut(); setDropdownOpen(false); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-destructive hover:bg-destructive/10 transition-colors">
                            <LogOut className="w-4 h-4" />
                            Sair
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Not logged in — avatar bubble style */
                <motion.button
                  onClick={() => { setAuthTab("login"); setAuthOpen(true); }}
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-xl transition-all duration-200 active:scale-[0.97]"
                  style={{
                    background: "hsla(0,0%,100%,0.05)",
                    border: "1px solid hsla(0,0%,100%,0.06)",
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${accentColor}20` }}
                  >
                    <User className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  </div>
                  <span className="text-xs font-medium text-foreground/70 hidden sm:inline">Entrar</span>
                </motion.button>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden relative p-1.5 rounded-lg text-foreground/50 hover:text-foreground transition-colors active:scale-90"
              >
                <AnimatePresence mode="wait">
                  {mobileMenuOpen ? (
                    <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <X className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Menu className="h-5 w-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
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
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                <img src={logoRoyal} alt="Royal Store" className="h-8 w-8 object-contain" />
                <span className="text-lg tracking-[0.15em]" style={{ fontFamily: "'Valorant', sans-serif" }}>
                  <span className="text-success">ROYAL</span>
                  <span className="text-foreground/80"> STORE</span>
                </span>
              </Link>
              <motion.button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: "hsla(0,0%,100%,0.06)" }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            {user && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mx-5 mt-4 flex items-center gap-3 rounded-xl p-3"
                style={{ background: "hsla(0,0%,100%,0.04)", border: "1px solid hsla(0,0%,100%,0.06)" }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: `${accentColor}15`, color: accentColor }}>
                    {userInitial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{profile?.username || user.email?.split("@")[0]}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email ? maskEmail(user.email) : ""}</p>
                </div>
              </motion.div>
            )}

            <nav className="mt-6 px-5 space-y-1">
              {NAV_ITEMS.map((item, i) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <motion.div key={item.label} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 + i * 0.04 }}>
                    <Link
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-all ${
                        active ? "text-success bg-success/10" : "text-foreground/70 hover:text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] ${active ? "text-success" : "text-muted-foreground"}`} />
                      {item.label}
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-success" />}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="mx-5 mt-4" style={{ borderTop: "1px solid hsla(0,0%,100%,0.06)" }} />

            {user ? (
              <div className="px-5 mt-3 space-y-1">
                {[
                  { icon: User, label: "Meu Perfil", action: () => navigate("/dashboard") },
                  { icon: Package, label: "Meus Pedidos", action: () => navigate("/dashboard?tab=purchases") },
                  { icon: Settings, label: "Configurações", action: () => navigate("/dashboard?tab=settings") },
                ].map(({ icon: Icon, label, action }, i) => (
                  <motion.button key={label} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.04 }}
                    onClick={() => { action(); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] text-foreground/60 hover:text-foreground hover:bg-secondary/60 transition-all">
                    <Icon className="w-[18px] h-[18px] text-muted-foreground" />
                    {label}
                  </motion.button>
                ))}
                {isAdmin && (
                  <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.37 }}>
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium text-success hover:bg-success/10 transition-all">
                      <ShieldAlert className="w-[18px] h-[18px]" />
                      Painel Admin
                    </Link>
                  </motion.div>
                )}
                <div className="pt-2">
                  <button onClick={() => { signOut(); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] text-destructive/80 hover:bg-destructive/10 transition-all">
                    <LogOut className="w-[18px] h-[18px]" />
                    Sair
                  </button>
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="px-5 mt-5 space-y-2.5">
                <button onClick={() => { setAuthTab("register"); setAuthOpen(true); setMobileMenuOpen(false); }}
                  className="w-full py-3 text-[15px] font-semibold text-success-foreground rounded-xl transition-all btn-shine"
                  style={{ background: accentColor, boxShadow: `0 0 24px ${accentColor}25` }}>
                  Criar Conta
                </button>
                <button onClick={() => { setAuthTab("login"); setAuthOpen(true); setMobileMenuOpen(false); }}
                  className="w-full py-3 text-[15px] font-medium text-muted-foreground rounded-xl transition-colors"
                  style={{ background: "hsla(0,0%,100%,0.04)", border: "1px solid hsla(0,0%,100%,0.08)" }}>
                  Já tenho conta
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for floating navbar */}
      <div className="h-[76px] sm:h-[80px]" />
    </>
  );
};

export default Header;
