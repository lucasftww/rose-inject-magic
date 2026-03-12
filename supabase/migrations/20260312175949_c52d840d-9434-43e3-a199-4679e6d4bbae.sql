
-- Fix security definer views - change to security invoker
ALTER VIEW public.public_scratch_card_prizes SET (security_invoker = on);
ALTER VIEW public.public_product_reviews SET (security_invoker = on);
