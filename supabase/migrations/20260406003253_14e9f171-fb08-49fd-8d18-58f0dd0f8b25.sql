-- Fix SECURITY DEFINER views by setting security_invoker = true
-- This ensures views respect the querying user's permissions, not the view creator's

ALTER VIEW public.public_products SET (security_invoker = true);
ALTER VIEW public.public_profiles SET (security_invoker = true);
ALTER VIEW public.public_product_reviews SET (security_invoker = true);
ALTER VIEW public.public_scratch_card_prizes SET (security_invoker = true);