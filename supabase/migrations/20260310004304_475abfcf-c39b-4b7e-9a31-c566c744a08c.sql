
-- 1. Fix ban bypass: Add WITH CHECK to prevent users from modifying ban fields
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND banned IS NOT DISTINCT FROM (SELECT p.banned FROM profiles p WHERE p.user_id = auth.uid())
    AND banned_at IS NOT DISTINCT FROM (SELECT p.banned_at FROM profiles p WHERE p.user_id = auth.uid())
    AND banned_reason IS NOT DISTINCT FROM (SELECT p.banned_reason FROM profiles p WHERE p.user_id = auth.uid())
  );

-- 2. Fix admin enumeration: Revoke public EXECUTE on has_role, create internal-only version
-- We can't fully revoke because RLS policies depend on it. Instead, rewrite to only work with auth.uid()
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    THEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    ELSE false
  END
$$;
