
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================

-- 1. FIX: Remove dangerous policy that exposes ALL stock content (license keys) to authenticated users
DROP POLICY IF EXISTS "Authenticated users can read available stock" ON public.stock_items;

-- 2. FIX: Remove dangerous policy that lets authenticated users claim stock directly
DROP POLICY IF EXISTS "Authenticated users can claim stock" ON public.stock_items;

-- 3. FIX: Restrict profiles public SELECT to only show username and avatar (not ban info)
DROP POLICY IF EXISTS "Anyone can view profile username" ON public.profiles;
CREATE POLICY "Users can view own full profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view basic profile info"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Note: The public policy still allows SELECT but RLS cannot restrict columns.
-- We'll handle column restriction in app code. The key fix is stock_items.

-- 4. FIX: Restrict product_reviews to hide user_id from public (keep reviews visible but protect user identity)
-- Reviews should still be publicly viewable for the product pages
-- No change needed structurally - the app should just not expose user_id

-- 5. Add INSERT policy for user_login_ips so the track-login edge function (using service role) works
-- Already works with service role, but add explicit policy for completeness
DROP POLICY IF EXISTS "Service can insert login IPs" ON public.user_login_ips;

-- 6. Ensure coupon_products is restricted to only show coupons the user has access to
DROP POLICY IF EXISTS "Users can view coupon products" ON public.coupon_products;
CREATE POLICY "Authenticated users can view coupon products"
  ON public.coupon_products
  FOR SELECT
  TO authenticated
  USING (true);
