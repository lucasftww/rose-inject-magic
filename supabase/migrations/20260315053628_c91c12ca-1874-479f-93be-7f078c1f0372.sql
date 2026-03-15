
-- ═══════════════════════════════════════════════════════════════
-- FIX: Use security_invoker on all views + add proper RLS policies
-- ═══════════════════════════════════════════════════════════════

-- 1. Set security_invoker = on for all public views
ALTER VIEW public.public_scratch_card_prizes SET (security_invoker = on);
ALTER VIEW public.public_profiles SET (security_invoker = on);
ALTER VIEW public.public_product_reviews SET (security_invoker = on);
ALTER VIEW public.public_products SET (security_invoker = on);

-- 2. product_reviews: allow public read (reviews are public feedback)
CREATE POLICY "Anyone can view reviews publicly"
  ON public.product_reviews FOR SELECT TO anon
  USING (true);

-- 3. profiles: allow public read (for username/avatar display)
CREATE POLICY "Anyone can view public profile info"
  ON public.profiles FOR SELECT TO anon
  USING (true);

-- 4. scratch_card_prizes: allow public read BUT hide win_percentage via column grants
--    First add a public SELECT policy
CREATE POLICY "Anon can view prizes"
  ON public.scratch_card_prizes FOR SELECT TO anon
  USING (active = true);

--    Then restrict columns: revoke all from anon, grant only safe columns
REVOKE ALL ON public.scratch_card_prizes FROM anon;
GRANT SELECT (id, name, description, image_url, prize_value, product_id, sort_order, active, created_at)
  ON public.scratch_card_prizes TO anon;
