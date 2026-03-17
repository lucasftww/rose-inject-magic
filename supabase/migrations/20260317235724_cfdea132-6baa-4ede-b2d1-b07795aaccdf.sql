-- Remove public SELECT policy from scratch_card_prizes (exposes win_percentage and prize_value)
-- Public access should go through public_scratch_card_prizes view instead
DROP POLICY IF EXISTS "Permitir leitura publica de scratch_card_prizes" ON public.scratch_card_prizes;

-- Remove public SELECT policy from product_reviews (exposes user_id)
-- Public access should go through public_product_reviews view instead
DROP POLICY IF EXISTS "Permitir leitura publica de product_reviews" ON public.product_reviews;