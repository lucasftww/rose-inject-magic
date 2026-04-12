-- Markup em `lzt_config` não é segredo comercial crítico (já refletido nos preços da edge);
-- a loja pública precisa de SELECT para alinhar fallbacks do cliente com o painel admin.
-- Escrita continua só para admins (política "Admins can manage lzt config").

DROP POLICY IF EXISTS "Anyone can view lzt config for storefront" ON public.lzt_config;
CREATE POLICY "Anyone can view lzt config for storefront"
  ON public.lzt_config
  FOR SELECT
  USING (true);
