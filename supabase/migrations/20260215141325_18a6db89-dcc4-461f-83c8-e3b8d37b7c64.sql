
-- Resellers table
CREATE TABLE public.resellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  discount_percent NUMERIC NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage resellers" ON public.resellers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own reseller status" ON public.resellers
  FOR SELECT USING (auth.uid() = user_id);

-- Reseller-product association (which products the reseller can sell)
CREATE TABLE public.reseller_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  UNIQUE(reseller_id, product_id)
);

ALTER TABLE public.reseller_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reseller_products" ON public.reseller_products
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own reseller products" ON public.reseller_products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.resellers WHERE resellers.id = reseller_products.reseller_id AND resellers.user_id = auth.uid())
  );

-- Reseller purchases log
CREATE TABLE public.reseller_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_plan_id UUID NOT NULL REFERENCES public.product_plans(id),
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id),
  original_price NUMERIC NOT NULL,
  paid_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reseller_purchases" ON public.reseller_purchases
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can view own purchases" ON public.reseller_purchases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.resellers WHERE resellers.id = reseller_purchases.reseller_id AND resellers.user_id = auth.uid())
  );

-- Trigger to update resellers.updated_at
CREATE TRIGGER update_resellers_updated_at
  BEFORE UPDATE ON public.resellers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
