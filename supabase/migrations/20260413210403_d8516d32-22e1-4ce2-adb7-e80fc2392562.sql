
-- 1. Add public SELECT on product_reviews so the view works with security_invoker
CREATE POLICY "Anyone can view reviews"
  ON public.product_reviews
  FOR SELECT
  TO public
  USING (true);

-- 2. Recreate the view with security_invoker = true
DROP VIEW IF EXISTS public.public_product_reviews;

CREATE VIEW public.public_product_reviews
WITH (security_invoker = true)
AS
SELECT
  pr.id,
  pr.product_id,
  pr.rating,
  pr.comment,
  pr.created_at,
  p.username
FROM product_reviews pr
LEFT JOIN profiles p ON p.user_id = pr.user_id;

-- 3. Grant select on the new view
GRANT SELECT ON public.public_product_reviews TO anon, authenticated;

-- 4. Fix public bucket listing on game-images
-- Drop overly broad SELECT policy if it exists, then create a scoped one
DO $$
BEGIN
  -- Try to drop common broad policies
  BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "public_read_game_images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "Anyone can view game images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "Public read access for game-images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Allow reading individual objects but not listing the bucket
CREATE POLICY "Public read game images by name"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'game-images' AND name IS NOT NULL AND name != '');
