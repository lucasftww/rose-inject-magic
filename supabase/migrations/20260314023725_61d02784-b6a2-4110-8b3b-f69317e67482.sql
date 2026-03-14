
-- Revoke public access to sensitive product columns (robot_markup_percent, robot_game_id)
-- These columns reveal business logic and profit margins

REVOKE SELECT(robot_markup_percent, robot_game_id) ON public.products FROM anon, authenticated;
GRANT SELECT(robot_markup_percent, robot_game_id) ON public.products TO service_role;
