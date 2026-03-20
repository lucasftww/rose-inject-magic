import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";
import Header from "@/components/Header";

const Login = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "register" ? "register" : "login";
  const [authOpen, setAuthOpen] = useState(true);

  // Re-open modal if user closes it (they're on the login page, after all)
  useEffect(() => {
    if (!authOpen && !user && !loading) {
      // Small delay so the close animation finishes
      const timer = setTimeout(() => setAuthOpen(true), 300);
      return () => clearTimeout(timer);
    }
  }, [authOpen, user, loading]);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab={defaultTab} />
      <div className="flex items-center justify-center pt-32">
        <p className="text-muted-foreground text-sm">Faça login para continuar</p>
      </div>
    </div>
  );
};

export default Login;
