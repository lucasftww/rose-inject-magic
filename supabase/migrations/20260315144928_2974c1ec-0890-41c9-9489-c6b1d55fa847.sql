
-- Re-add anon SELECT policy on products with column-level restriction
CREATE POLICY "Anon can view products" ON public.products FOR SELECT TO anon USING (true);

-- Grant only safe columns to anon (no robot_markup_percent)
GRANT SELECT (
  id, name, description, image_url, active, sort_order, game_id,
  created_at, status, status_label, status_updated_at, features_text,
  robot_game_id
) ON public.products TO anon;
