import { useState, useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Centralized server-side admin guard.
 * - Blocks rendering until Supabase RPC confirms admin role
 * - Cannot be bypassed via DevTools, localStorage, or React state manipulation
 * - Admin child components/bundles are never loaded for non-admin users
 */
const AdminGuard = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const [serverVerified, setServerVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setServerVerified(false);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin" as const,
        });
        if (!cancelled) setServerVerified(!error && !!data);
      } catch {
        if (!cancelled) setServerVerified(false);
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [loading, user]);

  // Still checking auth or verifying role → show spinner, never the children
  if (loading || serverVerified === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-success" />
      </div>
    );
  }

  // Not authenticated or not admin → redirect, never render children
  if (!user || !serverVerified) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
