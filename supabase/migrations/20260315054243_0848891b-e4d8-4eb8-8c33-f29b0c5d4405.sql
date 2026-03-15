
-- robot_game_id is not sensitive (just indicates fulfillment method)
-- Grant it to anon so product pages work for non-logged-in users
REVOKE ALL ON public.products FROM anon;
GRANT SELECT (
  id, name, description, image_url, active, sort_order, game_id,
  created_at, status, status_label, status_updated_at, features_text,
  robot_game_id
) ON public.products TO anon;
