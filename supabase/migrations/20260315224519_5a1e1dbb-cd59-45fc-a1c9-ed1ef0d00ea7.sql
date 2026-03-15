-- Fix SECURITY DEFINER on public_products view
ALTER VIEW public.public_products SET (security_invoker = on);