-- Revoke direct column access for sensitive fields from anon/public
REVOKE SELECT (robot_markup_percent, robot_game_id) ON public.products FROM anon;