-- Fix has_role to prevent role enumeration by non-admin users
-- Only allow: checking your own roles, OR admins checking anyone's roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    -- Admins can check anyone's roles
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    THEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    -- Non-admins can ONLY check their own roles
    WHEN _user_id = auth.uid()
    THEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    -- Block enumeration of other users' roles
    ELSE false
  END
$$;