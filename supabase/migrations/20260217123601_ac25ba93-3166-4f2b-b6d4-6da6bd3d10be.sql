CREATE POLICY "Anon can view lzt_config"
ON public.lzt_config
FOR SELECT
TO anon
USING (true);