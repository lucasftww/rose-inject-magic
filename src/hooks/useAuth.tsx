import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setAdvancedMatching, clearAdvancedMatching } from "@/lib/metaPixel";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { username: string | null; avatar_url: string | null } | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, username: string, captchaToken?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const trackedSessionRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (isMountedRef.current) setProfile(data);
    } catch {
      // silently fail
    }
  };

  const checkAdmin = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isMountedRef.current) return;
      if (!error) {
        setIsAdmin(!!data);
      }
    } catch {
      // Network error — don't change isAdmin state
    }
  };

  /** Send Advanced Matching data to Meta Pixel + cache for CAPI */
  const syncAdvancedMatching = (u: User) => {
    const rawName = (u.user_metadata?.username || "").trim();
    const nameParts = rawName.split(" ");
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
    const phone = u.phone || u.user_metadata?.phone || undefined;

    setAdvancedMatching({
      email: u.email,
      externalId: u.id,
      firstName,
      lastName,
      phone,
    });
  };

  useEffect(() => {
    isMountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMountedRef.current) return;

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          trackedSessionRef.current = null;
          clearAdvancedMatching();
          return;
        }

        if (!newSession) return;

        setSession(newSession);
        setUser(newSession.user);

        setTimeout(() => {
          if (!isMountedRef.current) return;
          fetchProfile(newSession.user.id);
          checkAdmin(newSession.user.id);
        }, 0);

        // Track login IP + Advanced Matching — once per session
        if (event === "SIGNED_IN" && newSession.access_token) {
          const sessionId = newSession.access_token.slice(-20);
          if (trackedSessionRef.current !== sessionId) {
            trackedSessionRef.current = sessionId;
            supabase.functions.invoke("track-login", {
              headers: { Authorization: `Bearer ${newSession.access_token}` },
            }).catch(() => {});

            syncAdvancedMatching(newSession.user);
          }
        }
      }
    );

    // Initial session restore
    const initializeAuth = async () => {
      // Failsafe: force loading off after 5 seconds
      const timeout = setTimeout(() => {
        if (isMountedRef.current && loading) {
          console.warn("Auth initialization timed out, proceeding anyway.");
          setLoading(false);
        }
      }, 5000);

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!isMountedRef.current) return;

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          try {
            await Promise.all([
              fetchProfile(initialSession.user.id),
              checkAdmin(initialSession.user.id),
            ]);
            syncAdvancedMatching(initialSession.user);
          } catch (e) {
            console.error("Profile fetch error during init:", e);
          }
        }
      } catch (error) {
        console.error("Session restore failed:", error);
      } finally {
        clearTimeout(timeout);
        if (isMountedRef.current) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, username: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: window.location.origin,
        captchaToken,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
