
-- LZT configuration table (singleton row for settings)
CREATE TABLE public.lzt_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  markup_multiplier numeric NOT NULL DEFAULT 1.5,
  max_fetch_price numeric NOT NULL DEFAULT 500,
  currency text NOT NULL DEFAULT 'BRL',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lzt_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lzt_config"
ON public.lzt_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default config
INSERT INTO public.lzt_config (markup_multiplier, max_fetch_price) VALUES (1.5, 500);

-- LZT sales tracking table
CREATE TABLE public.lzt_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lzt_item_id text NOT NULL,
  buy_price numeric NOT NULL DEFAULT 0,
  sell_price numeric NOT NULL DEFAULT 0,
  profit numeric GENERATED ALWAYS AS (sell_price - buy_price) STORED,
  buyer_user_id uuid,
  account_title text,
  sold_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lzt_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lzt_sales"
ON public.lzt_sales FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_lzt_sales_sold_at ON public.lzt_sales(sold_at DESC);
