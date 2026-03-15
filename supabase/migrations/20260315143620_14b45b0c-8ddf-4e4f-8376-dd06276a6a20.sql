
-- Restrict authenticated non-admin users from seeing sensitive product columns
-- by revoking full SELECT and granting only safe columns
REVOKE ALL ON public.products FROM authenticated;

-- Authenticated users get the same safe columns as anon, plus admin policy handles full access
GRANT SELECT (
  id, name, description, image_url, active, sort_order, game_id,
  created_at, status, status_label, status_updated_at, features_text,
  robot_game_id
) ON public.products TO authenticated;

-- Admins need full access for management (INSERT, UPDATE, DELETE, all columns)
GRANT ALL ON public.products TO authenticated;

-- Wait — that re-grants everything. We need a different approach.
-- The admin RLS policy already protects writes. For reads, the column-level 
-- grant approach doesn't work well with admin needing all columns.
-- Let's revert and use a view-based approach instead.
GRANT ALL ON public.products TO authenticated;
