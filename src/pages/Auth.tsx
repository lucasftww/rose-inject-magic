import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import logoRoyal from "@/assets/logo-royal.png";
import { useTranslation } from "react-i18next";
import { safeAuthRedirect } from "@/lib/safeUrl";

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
type Mode = "login" | "signup" | "recovery";

// ── Page ────────────────────────────────────────────────────────────
const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeAuthRedirect(searchParams.get("redirect"));
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate(redirect, { replace: true });
  }, [loading, user, navigate, redirect]);

  const validateEmail = useCallback((v: string): string | null => {
    if (!v.trim()) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return t("auth.invalidEmail");
    if (isTempEmail(v)) return t("auth.tempEmailBlocked");
    return null;
  }, [t]);

  const validatePassword = useCallback((v: string): string | null => {
    if (!v) return null;
    if (v.length < 6) return t("auth.minChars");
    return null;
  }, [t]);

  const emailError = touchedEmail ? validateEmail(email) : null;
  const passwordError = touchedPassword ? validatePassword(password) : null;
  const confirmError = touchedConfirm && confirmPassword && password !== confirmPassword ? t("auth.passwordsMismatch") : null;

  const canSubmit = useCallback((): boolean => {
    if (!email.trim() || validateEmail(email)) return false;
    if (mode === "recovery") return true;
    if (password.length < 6) return false;
    if (mode === "signup" && password !== confirmPassword) return false;
    return true;
  }, [email, password, confirmPassword, mode, validateEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success(t("auth.loginSuccess"));
        navigate(redirect, { replace: true });
      } else if (mode === "signup") {
        const username = email.split("@")[0];
        const { error } = await signUp(email, password, username);
        if (error) throw error;
        toast.success(t("auth.accountCreated"));
      } else {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setRecoverySent(true);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t("auth.error");
      toast.error(msg);
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

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-success" />
          {user && <p className="text-white/40 text-xs animate-pulse">{t("auth.redirecting")}</p>}
        </div>
      </div>
    );
  }

  const titles: Record<Mode, { title: string; sub: string }> = {
    login: { title: t("auth.loginTitle"), sub: t("auth.loginSub") },
    signup: { title: t("auth.signupTitle"), sub: t("auth.signupSub") },
    recovery: { title: t("auth.recoveryTitle"), sub: t("auth.recoverySub") },
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center lg:justify-end overflow-hidden">
      <img
        src="/images/auth-bg.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-black/50" />

      <Link
        to="/"
        className="absolute top-5 left-5 z-20 flex items-center gap-2"
      >
        <img src={logoRoyal} alt="Royal Store" className="w-9 h-9 object-contain" />
      </Link>

      <div className="relative z-10 w-full max-w-md mx-5 lg:mx-0 lg:mr-[15%] my-10">
        <div
          className="rounded-xl p-7 sm:p-9 flex flex-col gap-6"
          style={{
            background: "rgba(26,26,26,0.95)",
            border: "1px solid #2a2a2a",
          }}
        >
          <div className="text-center">
            <h1 className="text-xl lg:text-3xl font-bold text-white" style={{ lineHeight: 1.15 }}>
              {titles[mode].title}
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1.5">
              {titles[mode].sub}
            </p>
          </div>

          {mode === "recovery" && recoverySent ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center">
                <Check className="w-7 h-7 text-success" />
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center">
                {t("auth.emailSent")} <span className="text-white font-medium">{email}</span>.
                <br />{t("auth.checkInbox")}
              </p>
              <button
                onClick={() => { setMode("login"); setRecoverySent(false); }}
                className="text-sm text-success hover:underline mt-2"
              >
                {t("auth.backToLogin")}
              </button>
            </div>
          ) : (
            <>
              {mode !== "recovery" && (
                <>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => handleOAuth("google")}
                      className="w-full flex items-center justify-center gap-2.5 h-11 lg:h-12 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white font-medium hover:border-white/20 transition-colors active:scale-[0.97]"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {t("auth.googleLogin")}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOAuth("discord")}
                      className="w-full flex items-center justify-center gap-2.5 h-11 lg:h-12 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white font-medium hover:border-[#5865F2]/50 transition-colors active:scale-[0.97]"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
                      </svg>
                      {t("auth.discordLogin")}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[#2a2a2a]" />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{t("auth.orContinueWith")}</span>
                    <div className="flex-1 h-px bg-[#2a2a2a]" />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} autoComplete="on" className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-semibold text-white mb-1.5 block">{t("auth.email")}</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouchedEmail(true)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className="h-11 lg:h-12 bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-white/30 focus-visible:ring-success/50"
                  />
                  {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                </div>

                {mode !== "recovery" && (
                  <div>
                    <label className="text-sm font-semibold text-white mb-1.5 block">{t("auth.password")}</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setTouchedPassword(true)}
                        placeholder="••••••••"
                        className="h-11 lg:h-12 bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-white/30 pr-11 focus-visible:ring-success/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                    {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
                  </div>
                )}

                {mode === "signup" && (
                  <div>
                    <label className="text-sm font-semibold text-white mb-1.5 block">{t("auth.confirmPassword")}</label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => setTouchedConfirm(true)}
                      placeholder="••••••••"
                      className="h-11 lg:h-12 bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-white/30 focus-visible:ring-success/50"
                    />
                    {confirmError && <p className="text-xs text-red-500 mt-1">{confirmError}</p>}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !canSubmit()}
                  className="w-full h-11 lg:h-12 bg-[#00b4d8] hover:bg-[#00a0c0] text-black font-semibold text-base mt-1 active:scale-[0.97] transition-transform rounded-lg"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {mode === "login" ? t("auth.continue") : mode === "signup" ? t("auth.createAccount") : t("auth.sendLink")}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => { setMode("recovery"); setRecoverySent(false); }}
                    className="text-sm text-[hsl(var(--muted-foreground))] hover:text-white transition-colors text-center"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                )}
              </form>

              <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
                {mode === "login" ? (
                  <>
                    {t("auth.noAccount")}{" "}
                    <button onClick={() => setMode("signup")} className="text-white font-semibold hover:underline">
                      {t("auth.signUp")}
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <>
                    {t("auth.hasAccount")}{" "}
                    <button onClick={() => setMode("login")} className="text-white font-semibold hover:underline">
                      {t("auth.login")}
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setMode("login"); setRecoverySent(false); }} className="text-white font-semibold hover:underline">
                    {t("auth.backToLogin")}
                  </button>
                )}
              </div>

              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center leading-relaxed">
                {t("auth.termsAgree")}{" "}
                <Link to="/termos" className="text-success hover:underline">{t("auth.termsLink")}</Link>
                {" "}{t("auth.and")}{" "}
                <Link to="/privacidade" className="text-success hover:underline">{t("auth.privacyLink")}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
