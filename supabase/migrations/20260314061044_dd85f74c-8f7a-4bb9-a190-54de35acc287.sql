
-- Fix: Make the view use SECURITY INVOKER (caller's permissions) instead of SECURITY DEFINER
ALTER VIEW public.public_profiles SET (security_invoker = on);
