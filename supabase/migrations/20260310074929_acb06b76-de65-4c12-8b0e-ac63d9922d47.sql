
-- Fix all public-facing SELECT policies to be PERMISSIVE instead of RESTRICTIVE
-- This is critical: RESTRICTIVE policies require ALL policies to pass (AND logic)
-- which blocks unauthenticated users from seeing any public data

-- games
DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage games" ON public.games;
CREATE POLICY "Admins can manage games" ON public.games FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- products
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- product_plans
DROP POLICY IF EXISTS "Anyone can view plans" ON public.product_plans;
CREATE POLICY "Anyone can view plans" ON public.product_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage plans" ON public.product_plans;
CREATE POLICY "Admins can manage plans" ON public.product_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- product_features
DROP POLICY IF EXISTS "Anyone can view features" ON public.product_features;
CREATE POLICY "Anyone can view features" ON public.product_features FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage features" ON public.product_features;
CREATE POLICY "Admins can manage features" ON public.product_features FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- product_media
DROP POLICY IF EXISTS "Anyone can view media" ON public.product_media;
CREATE POLICY "Anyone can view media" ON public.product_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage media" ON public.product_media;
CREATE POLICY "Admins can manage media" ON public.product_media FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- product_reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.product_reviews;
CREATE POLICY "Anyone can view reviews" ON public.product_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.product_reviews;
CREATE POLICY "Users can insert own reviews" ON public.product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.product_reviews;
CREATE POLICY "Users can update own reviews" ON public.product_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- payment_settings
DROP POLICY IF EXISTS "Anyone can view payment settings" ON public.payment_settings;
CREATE POLICY "Anyone can view payment settings" ON public.payment_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage payment settings" ON public.payment_settings;
CREATE POLICY "Admins can manage payment settings" ON public.payment_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- scratch_card_config
DROP POLICY IF EXISTS "Anyone can view scratch config" ON public.scratch_card_config;
CREATE POLICY "Anyone can view scratch config" ON public.scratch_card_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage scratch config" ON public.scratch_card_config;
CREATE POLICY "Admins can manage scratch config" ON public.scratch_card_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- scratch_card_prizes
DROP POLICY IF EXISTS "Anyone can view prizes" ON public.scratch_card_prizes;
CREATE POLICY "Anyone can view prizes" ON public.scratch_card_prizes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage prizes" ON public.scratch_card_prizes;
CREATE POLICY "Admins can manage prizes" ON public.scratch_card_prizes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- coupon_products
DROP POLICY IF EXISTS "Anyone can view coupon products" ON public.coupon_products;
CREATE POLICY "Anyone can view coupon products" ON public.coupon_products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage coupon products" ON public.coupon_products;
CREATE POLICY "Admins can manage coupon products" ON public.coupon_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- coupons (admin only, but fix restrictive)
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- coupon_usage
DROP POLICY IF EXISTS "Admins can manage usage" ON public.coupon_usage;
CREATE POLICY "Admins can manage usage" ON public.coupon_usage FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own usage" ON public.coupon_usage;
CREATE POLICY "Users can insert own usage" ON public.coupon_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own usage" ON public.coupon_usage;
CREATE POLICY "Users can view own usage" ON public.coupon_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- coupon_users
DROP POLICY IF EXISTS "Admins can manage coupon users" ON public.coupon_users;
CREATE POLICY "Admins can manage coupon users" ON public.coupon_users FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own coupon assignments" ON public.coupon_users;
CREATE POLICY "Users can view own coupon assignments" ON public.coupon_users FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- order_tickets
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.order_tickets;
CREATE POLICY "Admins can manage all tickets" ON public.order_tickets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own tickets" ON public.order_tickets;
CREATE POLICY "Users can insert own tickets" ON public.order_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tickets" ON public.order_tickets;
CREATE POLICY "Users can update own tickets" ON public.order_tickets FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own tickets" ON public.order_tickets;
CREATE POLICY "Users can view own tickets" ON public.order_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- payments
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;
CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert payments" ON public.payments;
CREATE POLICY "Service role can insert payments" ON public.payments FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update payments" ON public.payments;
CREATE POLICY "Service role can update payments" ON public.payments FOR UPDATE TO service_role USING (true);

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (
    (auth.uid() = user_id) 
    AND (NOT (banned IS DISTINCT FROM (SELECT p.banned FROM profiles p WHERE p.user_id = auth.uid()))) 
    AND (NOT (banned_at IS DISTINCT FROM (SELECT p.banned_at FROM profiles p WHERE p.user_id = auth.uid()))) 
    AND (NOT (banned_reason IS DISTINCT FROM (SELECT p.banned_reason FROM profiles p WHERE p.user_id = auth.uid())))
  );

-- ticket_messages
DROP POLICY IF EXISTS "Admins can manage messages" ON public.ticket_messages;
CREATE POLICY "Admins can manage messages" ON public.ticket_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert messages to own tickets" ON public.ticket_messages;
CREATE POLICY "Users can insert messages to own tickets" ON public.ticket_messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM order_tickets ot WHERE ot.id = ticket_messages.ticket_id AND (ot.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))));

DROP POLICY IF EXISTS "Users can view messages of own tickets" ON public.ticket_messages;
CREATE POLICY "Users can view messages of own tickets" ON public.ticket_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM order_tickets ot WHERE ot.id = ticket_messages.ticket_id AND (ot.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))));

-- stock_items
DROP POLICY IF EXISTS "Admins can manage stock" ON public.stock_items;
CREATE POLICY "Admins can manage stock" ON public.stock_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can read own stock via ticket" ON public.stock_items;
CREATE POLICY "Users can read own stock via ticket" ON public.stock_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM order_tickets ot WHERE ot.stock_item_id = stock_items.id AND ot.user_id = auth.uid()));

-- product_tutorials
DROP POLICY IF EXISTS "Admins can manage tutorials" ON public.product_tutorials;
CREATE POLICY "Admins can manage tutorials" ON public.product_tutorials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users with orders can view tutorials" ON public.product_tutorials;
CREATE POLICY "Users with orders can view tutorials" ON public.product_tutorials FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM order_tickets ot WHERE ot.product_id = product_tutorials.product_id AND ot.user_id = auth.uid()));

-- lzt_config
DROP POLICY IF EXISTS "Admins can manage lzt config" ON public.lzt_config;
CREATE POLICY "Admins can manage lzt config" ON public.lzt_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- lzt_sales
DROP POLICY IF EXISTS "Admins can manage lzt sales" ON public.lzt_sales;
CREATE POLICY "Admins can manage lzt sales" ON public.lzt_sales FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- system_credentials
DROP POLICY IF EXISTS "Admins can manage credentials" ON public.system_credentials;
CREATE POLICY "Admins can manage credentials" ON public.system_credentials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- reseller_products
DROP POLICY IF EXISTS "Admins can manage reseller products" ON public.reseller_products;
CREATE POLICY "Admins can manage reseller products" ON public.reseller_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own reseller products" ON public.reseller_products;
CREATE POLICY "Users can view own reseller products" ON public.reseller_products FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM resellers r WHERE r.id = reseller_products.reseller_id AND r.user_id = auth.uid()));

-- reseller_purchases
DROP POLICY IF EXISTS "Admins can manage reseller purchases" ON public.reseller_purchases;
CREATE POLICY "Admins can manage reseller purchases" ON public.reseller_purchases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- resellers
DROP POLICY IF EXISTS "Admins can manage resellers" ON public.resellers;
CREATE POLICY "Admins can manage resellers" ON public.resellers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own reseller" ON public.resellers;
CREATE POLICY "Users can view own reseller" ON public.resellers FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- scratch_card_plays
DROP POLICY IF EXISTS "Admins can manage plays" ON public.scratch_card_plays;
CREATE POLICY "Admins can manage plays" ON public.scratch_card_plays FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own plays" ON public.scratch_card_plays;
CREATE POLICY "Users can view own plays" ON public.scratch_card_plays FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_login_ips
DROP POLICY IF EXISTS "Admins can read login IPs" ON public.user_login_ips;
CREATE POLICY "Admins can read login IPs" ON public.user_login_ips FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
