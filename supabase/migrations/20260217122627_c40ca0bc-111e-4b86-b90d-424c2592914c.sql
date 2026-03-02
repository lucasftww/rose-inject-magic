
-- Table to store system credentials (API keys, tokens, etc.)
CREATE TABLE public.system_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  env_key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  description text DEFAULT '',
  help_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage credentials"
  ON public.system_credentials FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_system_credentials_updated_at
  BEFORE UPDATE ON public.system_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing credentials
INSERT INTO public.system_credentials (name, env_key, description, help_url) VALUES
  ('FlowPay API Key', 'FLOWPAY_API_KEY', 'Chave da API do FlowPay para processar pagamentos PIX.', 'https://flowpay.com.br'),
  ('LZT Market Token', 'LZT_MARKET_TOKEN', 'Token de acesso da API LZT Market para buscar contas Valorant/Riot.', 'https://lzt-market.readme.io/reference/categoryriot');
