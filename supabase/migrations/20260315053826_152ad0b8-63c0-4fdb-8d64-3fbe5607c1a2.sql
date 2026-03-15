
-- Fix: Restrict anon column access on profiles and product_reviews

-- 1. profiles: anon should only see username, avatar_url, user_id (not ban details)
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT (user_id, username, avatar_url) ON public.profiles TO anon;

-- 2. product_reviews: anon should not see user_id directly
REVOKE ALL ON public.product_reviews FROM anon;
GRANT SELECT (id, product_id, rating, comment, created_at) ON public.product_reviews TO anon;
