import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff, ArrowLeft, Shield, Zap, Star } from "lucide-react";
import logoRoyal from "@/assets/logo-royal.png";

// ── Blocked temp-email domains ──────────────────────────────────────
const BLOCKED_DOMAINS = [
  "yopmail", "tempmail", "guerrillamail", "mailinator", "throwaway",
  "sharklasers", "grr.la", "guerrillamailblock", "pokemail", "spam4.me",
  "trashmail", "dispostable", "maildrop", "fakeinbox", "tempinbox",
  "10minutemail", "temp-mail", "emailondeck", "getnada",
];

function isTempEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return BLOCKED_DOMAINS.some((b) => domain.includes(b));
}

// ── Types ───────────────────────────────────────────────────────────
type Mode = "login" | "register" | "recovery";

const testimonials = [
  { name: "Lucas M.", text: "Comprei minha conta Radiante em menos de 5 minutos. Entrega instantânea!", rating: 5 },
  { name: "Gabriel S.", text: "Melhor loja de contas que já usei. Suporte 24h e preços justos.", rating: 5 },
  { name: "Pedro H.", text: "Já comprei 3 contas aqui, todas funcionando perfeitamente até hoje.", rating: 5 },
];

// ── Page ────────────────────────────────────────────────────────────
const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const { user, loading, signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) navigate(redirect, { replace: true });
  }, [loading, user, navigate, redirect]);

  const validate = useCallback((): string | null => {
    if (!email.trim()) return "Preencha o email";
    if (isTempEmail(email)) return "Emails temporários não são permitidos";
    if (mode === "recovery") return null;
    if (password.length < 6) return "A senha deve ter pelo menos 6 caracteres";
    if (mode === "register") {
      if (!username.trim()) return "Preencha o nome de usuário";
      if (password !== confirmPassword) return "As senhas não coincidem";
    }
    return null;
  }, [email, password, confirmPassword, username, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Login realizado!");
        navigate(redirect, { replace: true });
      } else if (mode === "register") {
        const { error } = await signUp(email, password, username);
        if (error) throw error;
        toast.success("Conta criada com sucesso! Verifique seu email.");
      } else {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setRecoverySent(true);
        toast.success("Email de recuperação enviado!");
      }
    } catch (error: any) {
      toast.error(error?.message || "Algo deu errado");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider: "discord" | "google") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${redirect}` },
    });
    if (error) toast.error(error.message);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-success" />
      </div>
    );
  }

  if (user) return null; // Will redirect via useEffect

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* ── Left panel — branding (desktop) ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-10 xl:p-14 bg-card border-r border-border relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-success/5 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <img src={logoRoyal} alt="Royal Store" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}>
              <span className="text-success">ROYAL</span>
              <span className="text-foreground"> STORE</span>
            </span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold text-foreground leading-tight mb-4" style={{ lineHeight: 1.15 }}>
            Sua conta dos sonhos está a um clique de distância
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md">
            Milhares de jogadores confiam na Royal Store. Entrega instantânea, garantia de troca e suporte 24h.
          </p>

          <div className="flex flex-col gap-4 mt-10">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                <Zap className="w-4.5 h-4.5 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Entrega Instantânea</p>
                <p className="text-xs text-muted-foreground">Receba sua conta em segundos após a compra</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                <Shield className="w-4.5 h-4.5 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">100% Seguro</p>
                <p className="text-xs text-muted-foreground">Garantia de troca em todas as contas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="relative z-10 flex flex-col gap-3 mt-8">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            O que dizem nossos clientes
          </p>
          {testimonials.map((t, i) => (
            <div key={i} className="bg-background/50 border border-border rounded-xl p-3.5">
              <div className="flex items-center gap-1 mb-1.5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3 h-3 fill-success text-success" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">"{t.text}"</p>
              <p className="text-xs font-semibold text-foreground mt-1.5">— {t.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center lg:justify-end px-5 sm:px-8 lg:pr-16 xl:pr-24 py-10">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <img src={logoRoyal} alt="Royal Store" className="w-8 h-8 object-contain" />
            <span className="text-lg font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}>
              <span className="text-success">ROYAL</span>
              <span className="text-foreground"> STORE</span>
            </span>
          </div>

          {/* ── Recovery mode ──────────────────────────────────────── */}
          {mode === "recovery" ? (
            <div className="flex flex-col gap-5">
              <button
                type="button"
                onClick={() => { setMode("login"); setRecoverySent(false); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>

              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Recuperar senha</h2>
                <p className="text-sm text-muted-foreground">
                  {recoverySent
                    ? "Verifique sua caixa de entrada para redefinir sua senha."
                    : "Digite seu email e enviaremos um link para redefinir sua senha."}
                </p>
              </div>

              {!recoverySent ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="bg-secondary border-border h-12"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-success text-success-foreground font-semibold text-base hover:bg-success/90">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar link de recuperação"}
                  </Button>
                </form>
              ) : (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                    <Shield className="w-7 h-7 text-success" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Enviamos um email para <span className="text-foreground font-medium">{email}</span>.
                  </p>
                  <Button variant="outline" onClick={() => { setMode("login"); setRecoverySent(false); }} className="mt-2">
                    Voltar ao login
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ── Login / Register ──────────────────────────────────── */
            <>
              <div className="flex gap-6 mb-8">
                <button
                  onClick={() => setMode("login")}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    mode === "login" ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Entrar
                </button>
                <button
                  onClick={() => setMode("register")}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    mode === "register" ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Criar Conta
                </button>
              </div>

              <form onSubmit={handleSubmit} autoComplete="on" className="flex flex-col gap-5">
                {mode === "register" && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Nome de usuário</label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Seu nome de usuário"
                      className="bg-secondary border-border h-12"
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-secondary border-border h-12"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Senha</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-secondary border-border h-12 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                {mode === "register" && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Confirmar senha</label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-secondary border-border h-12"
                    />
                  </div>
                )}

                {mode === "login" && (
                  <div className="flex justify-end -mt-2">
                    <button
                      type="button"
                      onClick={() => { setMode("recovery"); setRecoverySent(false); }}
                      className="text-sm text-success hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-success text-success-foreground font-semibold text-base hover:bg-success/90 mt-1 active:scale-[0.97] transition-transform"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === "login" ? "Entrar" : "Criar Conta"}
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">ou continue com</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* OAuth buttons */}
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => handleOAuth("discord")}
                    className="w-full flex items-center justify-center gap-2.5 h-12 rounded-md border border-border bg-secondary text-foreground font-medium hover:border-[#5865F2]/50 transition-colors active:scale-[0.97]"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
                    </svg>
                    Entrar com Discord
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuth("google")}
                    className="w-full flex items-center justify-center gap-2.5 h-12 rounded-md border border-border bg-secondary text-foreground font-medium hover:border-foreground/20 transition-colors active:scale-[0.97]"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Entrar com Google
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
