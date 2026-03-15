
-- 1. Remove anon direct SELECT on profiles (force use of public_profiles view)
DROP POLICY IF EXISTS "Anyone can view public profile info" ON public.profiles;

-- 2. Remove anon direct SELECT on product_reviews (force use of public_product_reviews view)
DROP POLICY IF EXISTS "Anyone can view reviews publicly" ON public.product_reviews;

-- 3. Clear tutorial data from products table (it should only be in product_tutorials)
UPDATE public.products SET tutorial_text = NULL, tutorial_file_url = NULL;

-- 4. Revoke anon SELECT on tutorial columns from products table
REVOKE ALL ON public.products FROM anon;
GRANT SELECT (
  id, name, description, image_url, active, sort_order, game_id,
  created_at, status, status_label, status_updated_at, features_text,
  robot_game_id
) ON public.products TO anon;

-- 5. Revoke anon direct access to product_reviews base table entirely
REVOKE ALL ON public.product_reviews FROM anon;
GRANT SELECT ON public.public_product_reviews TO anon;

-- 6. Revoke anon direct access to profiles base table entirely  
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT ON public.public_profiles TO anon;
