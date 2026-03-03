
-- Remove client INSERT capability for scratch_card_plays
-- Only the edge function (using service role) should insert plays
DROP POLICY IF EXISTS "Users can insert own plays" ON public.scratch_card_plays;
