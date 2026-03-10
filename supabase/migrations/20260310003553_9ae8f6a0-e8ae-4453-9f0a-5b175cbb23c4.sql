
-- Fix: Recreate the view with SECURITY INVOKER (default, not security definer)
DROP VIEW IF EXISTS public.scratch_card_prizes_public;

CREATE VIEW public.scratch_card_prizes_public
WITH (security_invoker = true)
AS
SELECT id, name, description, image_url, prize_value, product_id, sort_order, active, created_at
FROM public.scratch_card_prizes;

-- The view uses security_invoker so it respects the caller's RLS.
-- But since we restricted the base table to admins only, we need to allow
-- the view to bypass via a security definer function instead.
-- Actually, let's use a different approach: keep the base table readable but 
-- exclude win_percentage via a column-level grant approach.
-- Simplest: revert base table policy and use the view approach with security_definer but that's flagged.

-- Better approach: Keep base table with restricted columns
-- Drop the view, restore the original policy but revoke column access
DROP VIEW IF EXISTS public.scratch_card_prizes_public;
DROP POLICY IF EXISTS "Only admins can view prizes" ON public.scratch_card_prizes;

-- Restore public read but REVOKE access to win_percentage column
CREATE POLICY "Anyone can view prizes" ON public.scratch_card_prizes
  FOR SELECT USING (true);

-- Revoke SELECT on the sensitive column from non-admin roles
REVOKE SELECT (win_percentage) ON public.scratch_card_prizes FROM anon;
REVOKE SELECT (win_percentage) ON public.scratch_card_prizes FROM authenticated;

-- Grant SELECT on all OTHER columns explicitly
GRANT SELECT (id, name, description, image_url, prize_value, product_id, sort_order, active, created_at) ON public.scratch_card_prizes TO anon;
GRANT SELECT (id, name, description, image_url, prize_value, product_id, sort_order, active, created_at) ON public.scratch_card_prizes TO authenticated;
