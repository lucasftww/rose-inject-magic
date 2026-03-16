import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminUser {
  id: string;
  email: string;
  username?: string;
  [key: string]: any;
}

// Module-level cache so data persists across tab switches without refetching
let cachedUsers: AdminUser[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>(cachedUsers || []);
  const [loading, setLoading] = useState(!cachedUsers);
  const fetchingRef = useRef(false);

  const fetchUsers = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedUsers && now - cacheTimestamp < CACHE_TTL) {
      setUsers(cachedUsers);
      setLoading(false);
      return cachedUsers;
    }

    if (fetchingRef.current) return cachedUsers;
    fetchingRef.current = true;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); fetchingRef.current = false; return []; }

      const res = await supabase.functions.invoke("admin-users", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = (res.data || []) as AdminUser[];
      cachedUsers = data;
      cacheTimestamp = Date.now();
      setUsers(data);
      setLoading(false);
      fetchingRef.current = false;
      return data;
    } catch {
      setLoading(false);
      fetchingRef.current = false;
      return cachedUsers || [];
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const emailMap = useRef(new Map<string, string>());
  const usernameMap = useRef(new Map<string, string>());

  useEffect(() => {
    const eMap = new Map<string, string>();
    const uMap = new Map<string, string>();
    for (const u of users) {
      eMap.set(u.id, u.email);
      uMap.set(u.id, u.username || u.email?.split("@")[0] || "?");
    }
    emailMap.current = eMap;
    usernameMap.current = uMap;
  }, [users]);

  return { users, loading, fetchUsers, emailMap: emailMap.current, usernameMap: usernameMap.current };
}
