-- 1. Fix product_reviews: restrict SELECT to authenticated only (hides user_id from public)
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.product_reviews;
CREATE POLICY "Authenticated can view reviews"
  ON public.product_reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Fix coupon_usage: remove direct user INSERT policy (handled via service role in validate_coupon RPC)
DROP POLICY IF EXISTS "Users can insert own usage" ON public.coupon_usage;