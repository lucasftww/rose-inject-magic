-- 1. Fix product_reviews: restrict SELECT to own reviews only (public reads go through public_product_reviews view)
DROP POLICY IF EXISTS "Authenticated can view reviews" ON public.product_reviews;

CREATE POLICY "Users can view own reviews"
  ON public.product_reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Secure public views: ensure proper grants
REVOKE ALL ON public.public_scratch_card_prizes FROM anon;
GRANT SELECT ON public.public_scratch_card_prizes TO anon;

REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO anon;

REVOKE ALL ON public.public_product_reviews FROM anon;
GRANT SELECT ON public.public_product_reviews TO anon;

-- 3. Make views use security_invoker so they respect caller's RLS
ALTER VIEW public.public_profiles SET (security_invoker = on);
ALTER VIEW public.public_product_reviews SET (security_invoker = on);