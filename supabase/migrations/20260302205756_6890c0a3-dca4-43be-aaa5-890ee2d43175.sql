
-- ═══════════════════════════════════════════════════
-- FULL SCHEMA MIGRATION FOR INJECT PROJECT (FIXED ORDER)
-- ═══════════════════════════════════════════════════

-- 1. ENUM
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  username TEXT,
  avatar_url TEXT,
  banned BOOLEAN DEFAULT FALSE,
  banned_at TIMESTAMPTZ,
  banned_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- 3. USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- 4. has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 5. USER LOGIN IPS
CREATE TABLE public.user_login_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ip_address TEXT NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_login_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read login IPs" ON public.user_login_ips FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service can insert login IPs" ON public.user_login_ips FOR INSERT WITH CHECK (true);

-- 6. GAMES
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  image_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Admins can manage games" ON public.games FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 7. PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  features_text TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  status_label TEXT DEFAULT 'Ativo',
  tutorial_text TEXT,
  tutorial_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 8. PRODUCT PLANS
CREATE TABLE public.product_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.product_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view plans" ON public.product_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage plans" ON public.product_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 9. PRODUCT MEDIA
CREATE TABLE public.product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'image',
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view media" ON public.product_media FOR SELECT USING (true);
CREATE POLICY "Admins can manage media" ON public.product_media FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 10. PRODUCT FEATURES
CREATE TABLE public.product_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view features" ON public.product_features FOR SELECT USING (true);
CREATE POLICY "Admins can manage features" ON public.product_features FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 11. STOCK ITEMS (create table first, policy referencing order_tickets added later)
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_plan_id UUID NOT NULL REFERENCES public.product_plans(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage stock" ON public.stock_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 12. ORDER TICKETS
CREATE TABLE public.order_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  product_plan_id UUID NOT NULL,
  user_id UUID NOT NULL,
  stock_item_id UUID REFERENCES public.stock_items(id),
  status TEXT DEFAULT 'open',
  status_label TEXT DEFAULT 'Aberto',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.order_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tickets" ON public.order_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all tickets" ON public.order_tickets FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service can insert tickets" ON public.order_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own tickets" ON public.order_tickets FOR UPDATE USING (auth.uid() = user_id);

-- Now add the deferred stock_items policy
CREATE POLICY "Users can read own stock via ticket" ON public.stock_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.order_tickets ot WHERE ot.stock_item_id = stock_items.id AND ot.user_id = auth.uid())
);

-- 13. TICKET MESSAGES
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.order_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT DEFAULT 'user',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages of own tickets" ON public.ticket_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.order_tickets ot WHERE ot.id = ticket_messages.ticket_id AND (ot.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Users can insert messages to own tickets" ON public.ticket_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.order_tickets ot WHERE ot.id = ticket_id AND (ot.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Admins can manage messages" ON public.ticket_messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 14. PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  charge_id TEXT,
  paid_at TIMESTAMPTZ,
  cart_snapshot JSONB DEFAULT '[]',
  discount_amount NUMERIC DEFAULT 0,
  coupon_id UUID,
  payment_method TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service can insert payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update payments" ON public.payments FOR UPDATE USING (true);

-- 15. PAYMENT SETTINGS
CREATE TABLE public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT TRUE,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view payment settings" ON public.payment_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage payment settings" ON public.payment_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.payment_settings (method, label, enabled) VALUES ('pix', 'PIX', true), ('card', 'Cartão de Crédito', true), ('crypto', 'Crypto (USDT)', true);

-- 16. COUPONS
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  current_uses INTEGER DEFAULT 0,
  min_order_value NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view coupons" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 17. COUPON PRODUCTS
CREATE TABLE public.coupon_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE
);
ALTER TABLE public.coupon_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view coupon products" ON public.coupon_products FOR SELECT USING (true);
CREATE POLICY "Admins can manage coupon products" ON public.coupon_products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 18. COUPON USERS
CREATE TABLE public.coupon_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
);
ALTER TABLE public.coupon_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view coupon users" ON public.coupon_users FOR SELECT USING (true);
CREATE POLICY "Admins can manage coupon users" ON public.coupon_users FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 19. COUPON USAGE
CREATE TABLE public.coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON public.coupon_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert usage" ON public.coupon_usage FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage usage" ON public.coupon_usage FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 20. RESELLERS
CREATE TABLE public.resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  discount_percent NUMERIC DEFAULT 10,
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  total_purchases INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reseller" ON public.resellers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage resellers" ON public.resellers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 21. RESELLER PRODUCTS
CREATE TABLE public.reseller_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE
);
ALTER TABLE public.reseller_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reseller products" ON public.reseller_products FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = reseller_products.reseller_id AND r.user_id = auth.uid())
);
CREATE POLICY "Admins can manage reseller products" ON public.reseller_products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 22. RESELLER PURCHASES
CREATE TABLE public.reseller_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  original_price NUMERIC DEFAULT 0,
  paid_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reseller_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage reseller purchases" ON public.reseller_purchases FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 23. LZT CONFIG
CREATE TABLE public.lzt_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  markup_multiplier NUMERIC DEFAULT 1.5,
  max_fetch_price NUMERIC DEFAULT 500,
  currency TEXT DEFAULT 'rub',
  markup_valorant NUMERIC DEFAULT 1.5,
  markup_lol NUMERIC DEFAULT 1.5,
  markup_fortnite NUMERIC DEFAULT 1.5,
  markup_minecraft NUMERIC DEFAULT 1.5,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lzt_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view lzt config" ON public.lzt_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage lzt config" ON public.lzt_config FOR ALL USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.lzt_config (markup_multiplier, max_fetch_price) VALUES (1.5, 500);

-- 24. LZT SALES
CREATE TABLE public.lzt_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lzt_item_id TEXT,
  buy_price NUMERIC DEFAULT 0,
  sell_price NUMERIC DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  game TEXT,
  title TEXT,
  buyer_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lzt_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage lzt sales" ON public.lzt_sales FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service can insert lzt sales" ON public.lzt_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read lzt sales" ON public.lzt_sales FOR SELECT USING (true);

-- 25. SYSTEM CREDENTIALS
CREATE TABLE public.system_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  env_key TEXT NOT NULL UNIQUE,
  value TEXT DEFAULT '',
  description TEXT DEFAULT '',
  help_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.system_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage credentials" ON public.system_credentials FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 26. SCRATCH CARD PRIZES
CREATE TABLE public.scratch_card_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  win_percentage NUMERIC DEFAULT 0,
  prize_value NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.scratch_card_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view prizes" ON public.scratch_card_prizes FOR SELECT USING (true);
CREATE POLICY "Admins can manage prizes" ON public.scratch_card_prizes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 27. SCRATCH CARD CONFIG
CREATE TABLE public.scratch_card_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price NUMERIC DEFAULT 5,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.scratch_card_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scratch config" ON public.scratch_card_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage scratch config" ON public.scratch_card_config FOR ALL USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.scratch_card_config (price, active) VALUES (5, true);

-- 28. SCRATCH CARD PLAYS
CREATE TABLE public.scratch_card_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prize_id UUID REFERENCES public.scratch_card_prizes(id) ON DELETE SET NULL,
  won BOOLEAN DEFAULT FALSE,
  amount_paid NUMERIC DEFAULT 0,
  grid_data JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.scratch_card_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plays" ON public.scratch_card_plays FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plays" ON public.scratch_card_plays FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage plays" ON public.scratch_card_plays FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 29. PRODUCT REVIEWS
CREATE TABLE public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, user_id)
);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert own reviews" ON public.product_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.product_reviews FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════
-- TRIGGERS & FUNCTIONS
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════
-- STORAGE
-- ═══════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) VALUES ('game-images', 'game-images', true);
CREATE POLICY "Anyone can view game images" ON storage.objects FOR SELECT USING (bucket_id = 'game-images');
CREATE POLICY "Auth users can upload game images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'game-images' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users can update game images" ON storage.objects FOR UPDATE USING (bucket_id = 'game-images' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete game images" ON storage.objects FOR DELETE USING (bucket_id = 'game-images' AND auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_tickets;
