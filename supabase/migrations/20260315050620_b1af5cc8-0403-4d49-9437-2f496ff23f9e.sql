-- Restrict authenticated role to safe columns on products table
-- (admin access is handled by the ALL policy with has_role check)
-- Note: This doesn't affect RLS - admins still get full access via service role in edge functions
-- For the JS client, authenticated non-admin users only see safe columns

-- First check: does the "Anyone can view products" policy apply to authenticated too?
-- It applies to {public} which includes both anon and authenticated
-- We need column-level restriction for authenticated as well

REVOKE SELECT ON public.products FROM authenticated;
GRANT SELECT (id, name, description, image_url, active, sort_order, status, status_label, status_updated_at, features_text, game_id, created_at, robot_game_id) ON public.products TO authenticated;
-- Note: robot_game_id is needed for product display logic, robot_markup_percent is excluded