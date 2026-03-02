
-- Create product_features table for key-value features
CREATE TABLE public.product_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product features"
ON public.product_features
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = product_features.product_id AND products.active = true)
);

CREATE POLICY "Admins can manage product features"
ON public.product_features
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_product_features_product_id ON public.product_features(product_id, sort_order);
