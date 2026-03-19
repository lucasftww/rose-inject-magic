import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star, Shield, Zap, X, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoRoyal from "@/assets/logo-royal.png";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

const testimonials = [
  { name: "Lucas M.", text: "Comprei minha conta Radiante em menos de 5 minutos. Entrega instantânea!", rating: 5 },
  { name: "Gabriel S.", text: "Melhor loja de contas que já usei. Suporte 24h e preços justos.", rating: 5 },
  { name: "Pedro H.", text: "Já comprei 3 contas aqui, todas funcionando perfeitamente até hoje.", rating: 5 },
];

const AuthModal = ({ open, onOpenChange, defaultTab = "login" }: AuthModalProps) => {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);

  // Sync internal tab when defaultTab prop changes
  React.useEffect(() => {
    if (open) setTab(defaultTab);
  }, [defaultTab, open]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] sm:max-h-[90vh] p-0 border-border overflow-hidden gap-0 rounded-2xl [&>button:last-child]:hidden">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 z-10 rounded-full w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex max-h-[calc(95vh-40px)] sm:max-h-[calc(90vh-40px)] overflow-y-auto sm:overflow-hidden">
          {/* Left side - Info (hidden on mobile) */}
          <div className="hidden md:flex flex-col w-[45%] bg-card relative overflow-hidden">
            <div className="relative z-10 flex flex-col h-full p-10 pt-10">
              <div className="flex items-center gap-3 mb-8">
                <img src={logoRoyal} alt="Royal Store" className="w-10 h-10 object-contain" />
                <span className="text-xl font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}>
                  <span className="text-success">ROYAL</span>
                  <span className="text-foreground"> STORE</span>
                </span>
              </div>

              <div className="flex flex-col gap-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Entrega Instantânea</p>
                    <p className="text-xs text-muted-foreground">Receba sua conta em segundos após a compra</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">100% Seguro</p>
                    <p className="text-xs text-muted-foreground">Garantia de troca em todas as contas</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-end gap-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">O que dizem nossos clientes</p>
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
          </div>

          {/* Right side - Form */}
          <div className="flex-1 flex flex-col justify-center px-5 sm:px-10 md:px-14 py-8 sm:py-12">
            {/* Mobile branding */}
            <div className="md:hidden flex items-center gap-2.5 mb-6">
              <img src={logoRoyal} alt="Royal Store" className="w-8 h-8 object-contain" />
              <span className="text-lg font-bold tracking-widest" style={{ fontFamily: "'Valorant', sans-serif" }}>
                <span className="text-success">ROYAL</span>
                <span className="text-foreground"> STORE</span>
              </span>
            </div>

            {showForgot ? (
              <div className="flex flex-col gap-4 sm:gap-5">
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setForgotSent(false); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao login
                </button>

                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">Recuperar senha</h2>
                  <p className="text-sm text-muted-foreground">
                    {forgotSent
                      ? "Verifique sua caixa de entrada para redefinir sua senha."
                      : "Digite seu email e enviaremos um link para redefinir sua senha."}
                  </p>
                </div>

                {!forgotSent ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setForgotLoading(true);
                    const { error } = await resetPassword(forgotEmail);
                    if (error) {
                      toast.error(error.message);
                    } else {
                      setForgotSent(true);
                      toast.success("Email de recuperação enviado!");
                    }
                    setForgotLoading(false);
                  }} className="flex flex-col gap-4 sm:gap-5">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
                      <Input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="bg-secondary border-border h-12"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={forgotLoading} className="w-full h-12 bg-success text-success-foreground font-semibold text-base hover:bg-success/90">
                      {forgotLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar link de recuperação"}
                    </Button>
                  </form>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                      <Shield className="w-7 h-7 text-success" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Enviamos um email para <span className="text-foreground font-medium">{forgotEmail}</span>. Clique no link para redefinir sua senha.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setShowForgot(false); setForgotSent(false); }}
                      className="mt-2"
                    >
                      Voltar ao login
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-5 sm:gap-6 mb-6 sm:mb-8">
                  <button
                    onClick={() => setTab("login")}
                    className={`text-base sm:text-lg font-semibold pb-2 border-b-2 transition-colors ${
                      tab === "login" ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => setTab("register")}
                    className={`text-base sm:text-lg font-semibold pb-2 border-b-2 transition-colors ${
                      tab === "register" ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Criar Conta
                  </button>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setIsLoading(true);
                  if (tab === "login") {
                    const { error } = await signIn(email, password);
                    if (error) { toast.error(error.message); }
                    else { toast.success("Login realizado!"); onOpenChange(false); }
                  } else {
                    const { error } = await signUp(email, password, username);
                    if (error) { toast.error(error.message); }
                    else { toast.success("Conta criada com sucesso!"); onOpenChange(false); }
                  }
                  setIsLoading(false);
                }} className="flex flex-col gap-4 sm:gap-5">
                  {tab === "register" && (
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Nome de usuário</label>
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Seu nome de usuário" className="bg-secondary border-border h-11 sm:h-12" />
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="bg-secondary border-border h-11 sm:h-12" />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Senha</label>
                    <Input type="password" autoComplete={tab === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-secondary border-border h-11 sm:h-12" />
                  </div>

                  {tab === "login" && (
                    <div className="flex items-center justify-end -mt-1 sm:-mt-2">
                      <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }} className="text-xs sm:text-sm text-success hover:underline">Esqueceu a senha?</button>
                    </div>
                  )}

                  {/* Turnstile temporarily disabled for debugging */}

                  <Button type="submit" disabled={isLoading} className="w-full h-11 sm:h-12 bg-success text-success-foreground font-semibold text-sm sm:text-base hover:bg-success/90 mt-1">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : tab === "login" ? "Entrar" : "Criar Conta"}
                  </Button>

                  <div className="flex items-center gap-3 my-0 sm:my-1">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">ou continue com</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: "discord",
                        options: { redirectTo: window.location.origin },
                      });
                      if (error) toast.error(error.message);
                    }}
                    className="w-full flex items-center justify-center gap-2 h-11 sm:h-12 rounded-md border border-border bg-secondary text-foreground font-medium hover:border-[#5865F2]/50 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"/>
                    </svg>
                    Entrar com Discord
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;