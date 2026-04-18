-- Algumas bases registaram a migração 20260414213000 sem a linha em system_credentials (reparo idempotente).
INSERT INTO public.system_credentials (name, env_key, value, description, help_url)
VALUES (
  'UTMify — API Token',
  'UTMIFY_API_TOKEN',
  '',
  'Token da API da UTMify usado para enviar eventos de venda (orders).',
  'https://utmify.help.center/category/112-integracoes-via-api'
)
ON CONFLICT (env_key) DO NOTHING;
