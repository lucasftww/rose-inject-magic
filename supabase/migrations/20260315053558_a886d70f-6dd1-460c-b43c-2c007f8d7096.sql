
-- The public_ views are INTENTIONALLY designed to expose safe subsets of data.
-- They omit sensitive columns (win_percentage, user_id, tutorial fields).
-- security_invoker = on BREAKS them because underlying tables block anon/user access.
-- Revert to security_definer (default) so the views work as intended.

-- public_scratch_card_prizes: safe (no win_percentage column)
ALTER VIEW public.public_scratch_card_prizes SET (security_invoker = off);

-- public_profiles: safe (only username, avatar_url, user_id)
ALTER VIEW public.public_profiles SET (security_invoker = off);

-- public_product_reviews: safe (no user_id, only username from join)
ALTER VIEW public.public_product_reviews SET (security_invoker = off);

-- public_products: safe (no tutorial/robot columns)
ALTER VIEW public.public_products SET (security_invoker = off);
