import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseAdminUsersResponse, type UserData } from "@/types/adminUsersPayload";

export type AdminUser = UserData;

let cachedUsers: AdminUser[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

/** Single in-flight list request so parallel callers share one fetch; `force` waits then re-fetches. */
let listUsersInFlight: Promise<AdminUser[]> | null = null;

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>(cachedUsers || []);
  const [loading, setLoading] = useState(!cachedUsers);

  const fetchUsers = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedUsers && now - cacheTimestamp < CACHE_TTL) {
      setUsers(cachedUsers);
      setLoading(false);
      return cachedUsers;
    }

    if (listUsersInFlight) {
      const done = await listUsersInFlight;
      if (!force) return done;
    }

    listUsersInFlight = (async (): Promise<AdminUser[]> => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          return [];
        }

        const res = await supabase.functions.invoke("admin-users", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.error) throw res.error;

        const data = parseAdminUsersResponse(res.data);
        cachedUsers = data;
        cacheTimestamp = Date.now();
        setUsers(data);
        return data;
      } catch {
        return cachedUsers || [];
      } finally {
        setLoading(false);
        listUsersInFlight = null;
      }
    })();

    return listUsersInFlight;
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const emailMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.id, u.email);
    }
    return map;
  }, [users]);

  const usernameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.id, u.username || u.email?.split("@")[0] || "?");
    }
    return map;
  }, [users]);

  return { users, loading, fetchUsers, emailMap, usernameMap };
}
