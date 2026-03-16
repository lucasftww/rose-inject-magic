-- Recreate public_product_reviews WITHOUT security_invoker so anon can read
DROP VIEW IF EXISTS public.public_product_reviews;
CREATE VIEW public.public_product_reviews AS
  SELECT r.id,
    r.rating,
    r.comment,
    r.created_at,
    r.product_id,
    p.username
  FROM product_reviews r
  LEFT JOIN profiles p ON p.user_id = r.user_id;

GRANT SELECT ON public.public_product_reviews TO anon, authenticated;

-- Recreate public_scratch_card_prizes WITHOUT security_invoker so anon can read
DROP VIEW IF EXISTS public.public_scratch_card_prizes;
CREATE VIEW public.public_scratch_card_prizes AS
  SELECT id,
    name,
    description,
    image_url,
    product_id,
    sort_order,
    active,
    created_at
  FROM scratch_card_prizes;

GRANT SELECT ON public.public_scratch_card_prizes TO anon, authenticated;