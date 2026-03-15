-- 1. Clear tutorial content from products table (should only be in product_tutorials)
UPDATE public.products SET tutorial_text = NULL, tutorial_file_url = NULL;

-- 2. Revoke anon SELECT on sensitive products columns
-- (anon can still see the table via RLS but not these columns)
REVOKE ALL ON public.products FROM anon;
GRANT SELECT (id, name, description, image_url, active, sort_order, status, status_label, status_updated_at, features_text, game_id, created_at) ON public.products TO anon;

-- 3. Ensure authenticated users without admin can't see sensitive columns either
-- We need a function to handle this since column grants + RLS interact
-- Create a public products view for non-admin access
CREATE OR REPLACE VIEW public.public_products AS
SELECT 
  id, name, description, image_url, active, sort_order, 
  status, status_label, status_updated_at, features_text, game_id, created_at
FROM public.products;

ALTER VIEW public.public_products SET (security_invoker = on);

GRANT SELECT ON public.public_products TO anon;
GRANT SELECT ON public.public_products TO authenticated;