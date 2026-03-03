
-- Allow anonymous users to read lzt_config (needed for pricing on public pages)
DROP POLICY IF EXISTS "Authenticated can view lzt config" ON public.lzt_config;
CREATE POLICY "Anyone can view lzt config"
  ON public.lzt_config FOR SELECT
  USING (true);
