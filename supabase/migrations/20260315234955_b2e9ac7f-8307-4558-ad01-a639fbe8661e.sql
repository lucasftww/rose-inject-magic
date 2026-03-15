-- Restore anonymous read access to products so non-logged-in users can browse the store
-- Hide robot_markup_percent from anon by revoking column-level SELECT

CREATE POLICY "Anon can view products"
  ON public.products
  FOR SELECT
  TO anon
  USING (true);

-- Revoke anon access to sensitive column
REVOKE SELECT (robot_markup_percent) ON public.products FROM anon;
