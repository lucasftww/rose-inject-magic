
-- Add Robot Project integration fields to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS robot_game_id integer DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS robot_markup_percent numeric DEFAULT NULL;

-- Add Robot Project duration to product_plans
ALTER TABLE public.product_plans ADD COLUMN IF NOT EXISTS robot_duration_days integer DEFAULT NULL;
