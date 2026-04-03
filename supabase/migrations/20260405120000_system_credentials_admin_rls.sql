-- Fix: "new row violates row-level security policy for table system_credentials"
-- when admins save LZT/API keys from the dashboard.
--
-- Policies that call has_role() can fail in edge cases (e.g. privilege / evaluation order).
-- This helper reads user_roles as SECURITY DEFINER (same as has_role body) but with a
-- single EXISTS used only for admin UI writes.

CREATE OR REPLACE FUNCTION public.is_admin_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  );
$$;

COMMENT ON FUNCTION public.is_admin_session() IS 'True if current JWT user has admin in user_roles; for RLS on admin-only tables.';

GRANT EXECUTE ON FUNCTION public.is_admin_session() TO authenticated;

-- Explicit table grants (safe if already granted)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_credentials TO authenticated;

DROP POLICY IF EXISTS "Admins can manage credentials" ON public.system_credentials;

CREATE POLICY "Admins can manage credentials"
ON public.system_credentials
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_admin_session())
WITH CHECK (public.is_admin_session());
