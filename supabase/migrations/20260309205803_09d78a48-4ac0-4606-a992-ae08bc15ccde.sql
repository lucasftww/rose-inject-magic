
-- Fix: GRANT EXECUTE on has_role back to public
-- The function is SECURITY DEFINER so it safely bypasses RLS internally.
-- Revoking it broke ALL RLS policies that reference has_role (lzt_config, products, etc.)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
