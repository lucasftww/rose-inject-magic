DROP VIEW IF EXISTS public.public_product_reviews;

CREATE OR REPLACE VIEW public.public_product_reviews
WITH (security_invoker = false)
AS
SELECT
  r.id,
  r.rating,
  r.comment,
  r.created_at,
  r.product_id,
  p.username
FROM product_reviews r
LEFT JOIN profiles p ON p.user_id = r.user_id;

ALTER VIEW public.public_product_reviews OWNER TO postgres;

GRANT SELECT ON public.public_product_reviews TO anon;
GRANT SELECT ON public.public_product_reviews TO authenticated;