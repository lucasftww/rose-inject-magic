
-- 1. Create a public view for scratch card prizes WITHOUT win_percentage
CREATE OR REPLACE VIEW public.public_scratch_card_prizes AS
SELECT id, name, description, image_url, prize_value, product_id, sort_order, active, created_at
FROM public.scratch_card_prizes;

GRANT SELECT ON public.public_scratch_card_prizes TO anon, authenticated;

-- 2. Remove the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view prizes" ON public.scratch_card_prizes;

-- 3. Add authenticated-only SELECT (for admin panel which needs win_percentage)
CREATE POLICY "Authenticated can view prizes"
ON public.scratch_card_prizes
FOR SELECT
TO authenticated
USING (true);

-- 4. For product_reviews: create a view that hides user_id for public display
CREATE OR REPLACE VIEW public.public_product_reviews AS
SELECT r.id, r.rating, r.comment, r.created_at, r.product_id, p.username
FROM public.product_reviews r
LEFT JOIN public.profiles p ON p.user_id = r.user_id;

GRANT SELECT ON public.public_product_reviews TO anon, authenticated;
