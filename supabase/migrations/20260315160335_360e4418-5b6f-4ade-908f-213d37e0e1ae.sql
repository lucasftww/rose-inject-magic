
-- Revoke table-level SELECT from anon on products (keeps RLS policy but removes column access)
REVOKE SELECT ON public.products FROM anon;

-- Grant SELECT only on safe public columns (excluding robot_markup_percent)
GRANT SELECT (
  id, name, description, image_url, active, sort_order, game_id, 
  created_at, status, status_label, status_updated_at, features_text, 
  robot_game_id
) ON public.products TO anon;
