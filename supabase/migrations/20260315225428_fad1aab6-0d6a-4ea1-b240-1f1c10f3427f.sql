-- Remove prize_value from public view to hide sensitive prize data
DROP VIEW IF EXISTS public.public_scratch_card_prizes;
CREATE VIEW public.public_scratch_card_prizes
WITH (security_invoker = on) AS
  SELECT id, name, description, image_url, product_id, sort_order, active, created_at
  FROM scratch_card_prizes;

GRANT SELECT ON public.public_scratch_card_prizes TO anon;
GRANT SELECT ON public.public_scratch_card_prizes TO authenticated;