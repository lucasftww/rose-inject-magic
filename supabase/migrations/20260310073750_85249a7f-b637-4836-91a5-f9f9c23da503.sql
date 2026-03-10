
-- Fix RLS policies: change from RESTRICTIVE to PERMISSIVE for public SELECT

-- games
DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage games" ON public.games;
CREATE POLICY "Admins can manage games" ON public.games FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- products
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- product_plans
DROP POLICY IF EXISTS "Anyone can view plans" ON public.product_plans;
CREATE POLICY "Anyone can view plans" ON public.product_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage plans" ON public.product_plans;
CREATE POLICY "Admins can manage plans" ON public.product_plans FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- product_features
DROP POLICY IF EXISTS "Anyone can view features" ON public.product_features;
CREATE POLICY "Anyone can view features" ON public.product_features FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage features" ON public.product_features;
CREATE POLICY "Admins can manage features" ON public.product_features FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- product_media
DROP POLICY IF EXISTS "Anyone can view media" ON public.product_media;
CREATE POLICY "Anyone can view media" ON public.product_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage media" ON public.product_media;
CREATE POLICY "Admins can manage media" ON public.product_media FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- product_reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.product_reviews;
CREATE POLICY "Anyone can view reviews" ON public.product_reviews FOR SELECT USING (true);

-- payment_settings
DROP POLICY IF EXISTS "Anyone can view payment settings" ON public.payment_settings;
CREATE POLICY "Anyone can view payment settings" ON public.payment_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage payment settings" ON public.payment_settings;
CREATE POLICY "Admins can manage payment settings" ON public.payment_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- scratch_card_config
DROP POLICY IF EXISTS "Anyone can view scratch config" ON public.scratch_card_config;
CREATE POLICY "Anyone can view scratch config" ON public.scratch_card_config FOR SELECT USING (true);

-- scratch_card_prizes
DROP POLICY IF EXISTS "Anyone can view prizes" ON public.scratch_card_prizes;
CREATE POLICY "Anyone can view prizes" ON public.scratch_card_prizes FOR SELECT USING (true);

-- coupon_products
DROP POLICY IF EXISTS "Anyone can view coupon products" ON public.coupon_products;
CREATE POLICY "Anyone can view coupon products" ON public.coupon_products FOR SELECT USING (true);
