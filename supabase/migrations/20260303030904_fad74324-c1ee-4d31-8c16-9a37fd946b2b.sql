
-- 1. profiles: restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- 2. lzt_sales: restrict to admin only (remove public read)
DROP POLICY IF EXISTS "Anyone can read lzt sales" ON public.lzt_sales;

-- 3. lzt_config: restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view lzt config" ON public.lzt_config;
CREATE POLICY "Authenticated can view lzt config"
  ON public.lzt_config FOR SELECT TO authenticated
  USING (true);

-- 4. coupons: restrict to authenticated users only (they validate codes, not browse)
DROP POLICY IF EXISTS "Anyone can view coupons" ON public.coupons;
CREATE POLICY "Authenticated can view coupons"
  ON public.coupons FOR SELECT TO authenticated
  USING (true);

-- 5. coupon_users: restrict to own records only
DROP POLICY IF EXISTS "Anyone can view coupon users" ON public.coupon_users;
CREATE POLICY "Users can view own coupon assignments"
  ON public.coupon_users FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
