
-- Restore security_invoker view
DROP VIEW IF EXISTS public.public_product_reviews;
CREATE VIEW public.public_product_reviews
WITH (security_invoker=on) AS
  SELECT r.id, r.rating, r.comment, r.created_at, r.product_id, p.username
  FROM product_reviews r
  LEFT JOIN profiles p ON p.user_id = r.user_id;

GRANT SELECT ON public.public_product_reviews TO anon, authenticated;

-- Allow public SELECT on product_reviews (non-sensitive data)
CREATE POLICY "Anyone can view reviews"
  ON product_reviews FOR SELECT
  TO public
  USING (true);

-- Allow public to read username from profiles (needed for the view join)
CREATE POLICY "Anyone can view usernames"
  ON profiles FOR SELECT
  TO anon
  USING (true);
