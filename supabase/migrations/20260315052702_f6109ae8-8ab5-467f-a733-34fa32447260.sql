
-- ═══════════════════════════════════════════════════════════════
-- FINAL SECURITY HARDENING MIGRATION
-- ═══════════════════════════════════════════════════════════════

-- 1. Restrict anon access to products table (column-level)
--    Prevent anonymous users from reading sensitive columns:
--    tutorial_text, tutorial_file_url, robot_markup_percent, robot_game_id
REVOKE ALL ON public.products FROM anon;
GRANT SELECT (
  id, name, description, image_url, active, sort_order, game_id,
  created_at, status, status_label, status_updated_at, features_text
) ON public.products TO anon;

-- 2. Ensure public views use security_invoker = on
--    so underlying table RLS policies are respected
ALTER VIEW public.public_products SET (security_invoker = on);
ALTER VIEW public.public_profiles SET (security_invoker = on);
ALTER VIEW public.public_product_reviews SET (security_invoker = on);
ALTER VIEW public.public_scratch_card_prizes SET (security_invoker = on);

-- 3. Grant explicit SELECT on public views to anon
GRANT SELECT ON public.public_products TO anon;
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_product_reviews TO anon;
GRANT SELECT ON public.public_scratch_card_prizes TO anon;

-- 4. Ensure authenticated still has full SELECT on products
--    (admins need all columns from client-side admin panel)
GRANT SELECT ON public.products TO authenticated;
