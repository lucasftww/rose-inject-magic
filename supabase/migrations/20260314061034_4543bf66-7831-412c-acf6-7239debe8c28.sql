
-- 1. Create a public view for profile usernames (safe for anon)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT user_id, username, avatar_url
FROM public.profiles;

-- Grant anon access to the view
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 2. Drop the unsafe anon policy on profiles
DROP POLICY IF EXISTS "Anyone can view usernames" ON public.profiles;

-- 3. Drop the unsafe public policy on product_reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.product_reviews;
