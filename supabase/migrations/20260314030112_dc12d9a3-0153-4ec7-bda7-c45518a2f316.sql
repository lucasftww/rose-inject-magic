
-- Recreate view without security_invoker so it runs as definer (owner)
-- This allows public/anon access to reviews without exposing base tables
DROP VIEW IF EXISTS public.public_product_reviews;
CREATE VIEW public.public_product_reviews AS
  SELECT r.id, r.rating, r.comment, r.created_at, r.product_id, p.username
  FROM product_reviews r
  LEFT JOIN profiles p ON p.user_id = r.user_id;

-- Grant access to anon and authenticated
GRANT SELECT ON public.public_product_reviews TO anon, authenticated;
