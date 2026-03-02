
-- Add product_id column to link prizes to products
ALTER TABLE public.scratch_card_prizes ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;

-- Insert all active products as prizes with default 5% win chance
INSERT INTO public.scratch_card_prizes (name, image_url, win_percentage, prize_value, active, sort_order, product_id)
SELECT name, image_url, 5, 0, true, sort_order, id
FROM public.products
WHERE active = true
ORDER BY sort_order;
