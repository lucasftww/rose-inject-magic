-- 1. Fix coupons: only authenticated users can view (needed for checkout validation)
DROP POLICY IF EXISTS "Anyone can view coupons" ON public.coupons;
CREATE POLICY "Authenticated users can view coupons"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (true);

-- 2. Fix coupon_products: only authenticated
DROP POLICY IF EXISTS "Anyone can view coupon products" ON public.coupon_products;
CREATE POLICY "Authenticated users can view coupon products"
  ON public.coupon_products FOR SELECT
  TO authenticated
  USING (true);

-- 3. Fix coupon_users: only own data
DROP POLICY IF EXISTS "Anyone can view coupon users" ON public.coupon_users;
CREATE POLICY "Users can view own coupon assignments"
  ON public.coupon_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Fix lzt_config: admin only (frontend fetches via edge function)
DROP POLICY IF EXISTS "Anyone can view lzt config" ON public.lzt_config;
CREATE POLICY "Only admins can view lzt config"
  ON public.lzt_config FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Fix profiles: only authenticated users can view
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);