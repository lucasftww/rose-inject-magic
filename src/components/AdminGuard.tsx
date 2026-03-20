import { useState, useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Centralized server-side admin guard with DOUBLE verification.
 *
 * Layer 1: supabase.rpc("has_role")   — checks user_roles via existing RPC
 * Layer 2: supabase.rpc("admin_verify") — independent SECURITY DEFINER function
 *          that also logs every access attempt to admin_access_log
 *
 * Both must return true. If either fails → access denied.
 * Cannot be bypassed via DevTools, localStorage, or React state manipulation.
 * Admin child components/bundles are never loaded for non-admin users.
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
        // Run BOTH checks in parallel — both must pass
        const [roleCheck, adminVerify] = await Promise.all([
          supabase.rpc("has_role", {
            _user_id: user.id,
            _role: "admin" as const,
          }),
          supabase.rpc("admin_verify"),
        ]);

        if (roleCheck.error) {
          console.error("AdminGuard: has_role check failed:", roleCheck.error.message);
        }
        if (adminVerify.error) {
          console.error("AdminGuard: admin_verify check failed:", adminVerify.error.message);
        }

        const layer1 = !roleCheck.error && !!roleCheck.data;
        const layer2 = !adminVerify.error &&
          typeof adminVerify.data === "object" &&
          adminVerify.data !== null &&
          (adminVerify.data as any).verified === true &&
          (adminVerify.data as any).uid === user.id;

        if (!cancelled) {
          setServerVerified(layer1 && layer2);
        }
      } catch (err) {
        console.error("AdminGuard: unexpected error during role check:", err);
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
