import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Loader2, Lock, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
      setChecking(false);
    });

    // Also check hash for type=recovery (fallback)
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    // Timeout fallback
    const timer = setTimeout(() => setChecking(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "A senha deve ter pelo menos 8 caracteres", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Erro ao redefinir senha", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
      toast({ title: "Senha redefinida com sucesso!" });
      setTimeout(() => navigate("/"), 3000);
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-dvh bg-background">
        <Header />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-success" />
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-dvh bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 pt-32 text-center">
          <Lock className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Este link de redefinição de senha não é válido. Solicite um novo link na tela de login.
          </p>
          <button
            onClick={() => navigate("/")}
            className="rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-dvh bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 pt-32 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-success/40 bg-success/10">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Senha redefinida!</h1>
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <div className="mx-auto max-w-md px-4 pt-24 pb-20">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 border border-success/20">
              <Lock className="h-5 w-5 text-success" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Redefinir Senha</h1>
              <p className="text-xs text-muted-foreground">Digite sua nova senha abaixo</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-password-new" className="text-xs font-medium text-muted-foreground">
                Nova Senha
              </label>
              <div className="relative mt-1">
                <input
                  id="reset-password-new"
                  name="new-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 100))}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reset-password-confirm" className="text-xs font-medium text-muted-foreground">
                Confirmar Senha
              </label>
              <input
                id="reset-password-confirm"
                name="confirm-password"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.slice(0, 100))}
                placeholder="Repita a senha"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || password.length < 8}
              className="w-full rounded-lg bg-success py-3 text-sm font-bold text-success-foreground disabled:opacity-50 transition-all hover:shadow-[0_0_20px_hsl(var(--success)/0.3)]"
            >
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Redefinir Senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
