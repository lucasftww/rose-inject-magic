
-- Add status fields to products
ALTER TABLE public.products
ADD COLUMN status text NOT NULL DEFAULT 'undetected',
ADD COLUMN status_label text NOT NULL DEFAULT 'Indetectável',
ADD COLUMN status_updated_at timestamp with time zone NOT NULL DEFAULT now();
