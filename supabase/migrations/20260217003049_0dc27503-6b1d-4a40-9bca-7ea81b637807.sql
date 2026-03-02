
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  label text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment_settings"
ON public.payment_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view payment_settings"
ON public.payment_settings FOR SELECT
USING (true);

-- Seed default methods
INSERT INTO public.payment_settings (method, enabled, label) VALUES
  ('pix', true, 'PIX'),
  ('card', true, 'Cartão de Crédito'),
  ('crypto', true, 'USDT (TRC20)');
