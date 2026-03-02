
-- Create product_media table for images and videos
CREATE TABLE public.product_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

-- Anyone can view media for active products
CREATE POLICY "Anyone can view product media"
ON public.product_media
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = product_media.product_id AND products.active = true)
);

-- Admins can manage media
CREATE POLICY "Admins can manage product media"
ON public.product_media
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_product_media_product_id ON public.product_media(product_id, sort_order);
