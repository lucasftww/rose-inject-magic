CREATE POLICY "Anyone can view lzt_config"
ON public.lzt_config
FOR SELECT
TO authenticated
USING (true);