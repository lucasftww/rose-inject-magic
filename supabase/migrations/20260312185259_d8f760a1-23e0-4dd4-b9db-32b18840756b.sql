-- Fix: Restrict scratch_card_prizes SELECT to admins only
-- Regular users should use the public_scratch_card_prizes view (which hides win_percentage)
DROP POLICY IF EXISTS "Authenticated can view prizes" ON public.scratch_card_prizes;

CREATE POLICY "Only admins can view prizes"
ON public.scratch_card_prizes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));