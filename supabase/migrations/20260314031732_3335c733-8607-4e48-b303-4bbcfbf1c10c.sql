CREATE TABLE public.lzt_price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lzt_item_id text NOT NULL UNIQUE,
  custom_price_brl numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lzt_price_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage price overrides"
  ON public.lzt_price_overrides
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));