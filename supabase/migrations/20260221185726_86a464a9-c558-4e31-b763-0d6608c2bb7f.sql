
-- Allow anyone to read lzt_config (markup is not sensitive, it's reflected in displayed prices)
DROP POLICY IF EXISTS "Only admins can view lzt config" ON public.lzt_config;

CREATE POLICY "Anyone can view lzt config"
ON public.lzt_config
FOR SELECT
USING (true);
