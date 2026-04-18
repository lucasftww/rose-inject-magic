import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { isRecord } from "@/types/ticketChat";
import { readAdminGuardCache, writeAdminGuardCache } from "@/lib/adminGuardCache";

function parseAdminVerifyPayload(data: unknown): { verified: boolean; uid: string } | null {
  if (!isRecord(data)) return null;
  if (data.verified !== true) return null;
  const uid = data.uid;
  if (typeof uid !== "string" || !uid) return null;
  return { verified: true, uid };
}

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
  const lastUserIdRef = useRef<string | null>(null);

  // Same-session re-entry: show admin shell immediately while RPC re-runs in background
  useLayoutEffect(() => {
    if (loading) return;
    if (!user) {
      lastUserIdRef.current = null;
      setServerVerified(false);
      return;
    }
    const uid = user.id;
    if (lastUserIdRef.current !== uid) {
      lastUserIdRef.current = uid;
      setServerVerified(readAdminGuardCache(uid) === true ? true : null);
      return;
    }
    if (readAdminGuardCache(uid) === true) {
      setServerVerified(true);
    }
  }, [loading, user]);

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
          if (import.meta.env.DEV) console.error("AdminGuard: has_role check failed:", roleCheck.error.message);
        }
        if (adminVerify.error) {
          if (import.meta.env.DEV) console.error("AdminGuard: admin_verify check failed:", adminVerify.error.message);
        }

        const layer1 = !roleCheck.error && !!roleCheck.data;

        const payload = parseAdminVerifyPayload(adminVerify.data);
        const layer2 = !adminVerify.error && payload !== null && payload.uid === user.id;

        const ok = layer1 && layer2;
        if (!cancelled) {
          setServerVerified(ok);
          writeAdminGuardCache(user.id, ok);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error("AdminGuard: unexpected error during role check:", err);
        if (!cancelled) {
          setServerVerified(false);
          writeAdminGuardCache(user.id, false);
        }
      }
    };

    void verify();
    return () => { cancelled = true; };
  }, [loading, user]);

  // Still checking auth or verifying role → show spinner, never the children
  if (loading || serverVerified === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
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
