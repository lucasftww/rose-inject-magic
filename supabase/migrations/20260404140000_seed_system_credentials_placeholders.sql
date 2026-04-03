-- Alinha system_credentials com o que o admin e as Edge Functions esperam (env_key, name, help_url).
-- Alguns projetos legados têm só a coluna `key`; renomeamos para `env_key` se necessário.

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_credentials' AND column_name = 'key'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_credentials' AND column_name = 'env_key'
  ) THEN
    ALTER TABLE public.system_credentials RENAME COLUMN key TO env_key;
  END IF;
END $mig$;

ALTER TABLE public.system_credentials ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';
ALTER TABLE public.system_credentials ADD COLUMN IF NOT EXISTS help_url TEXT DEFAULT '';

UPDATE public.system_credentials
SET name = env_key
WHERE name IS NULL OR btrim(name) = '';

ALTER TABLE public.system_credentials ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.system_credentials ALTER COLUMN name SET DEFAULT '';

-- Linhas guia (valor vazio: preencher no Admin → Credenciais)
INSERT INTO public.system_credentials (name, env_key, value, description, help_url)
VALUES
  (
    'LZT Market — JWT',
    'LZT_MARKET_TOKEN',
    '',
    'JWT da API LZT (Lolzteam Market). Se já usas LZT_API_TOKEN, podes preencher só uma das chaves com o mesmo token.',
    'https://lzt.market'
  ),
  (
    'LZT Market — JWT (alias)',
    'LZT_API_TOKEN',
    '',
    'Alias opcional do token LZT; basta preencher LZT_MARKET_TOKEN ou esta chave.',
    'https://lzt.market'
  ),
  (
    'Meta — CAPI Access Token',
    'META_ACCESS_TOKEN',
    '',
    'Token do Graph API para Conversions API (compras).',
    'https://developers.facebook.com/docs/marketing-api/conversions-api/get-started'
  ),
  (
    'Meta — Pixel ID',
    'META_PIXEL_ID',
    '',
    'ID numérico do Pixel (o mesmo do site / VITE_META_PIXEL_ID).',
    'https://business.facebook.com/events_manager'
  ),
  (
    'MisticPay — Client ID',
    'MISTICPAY_CLIENT_ID',
    '',
    'Client ID do gateway MisticPay.',
    ''
  ),
  (
    'MisticPay — Client Secret',
    'MISTICPAY_CLIENT_SECRET',
    '',
    'Client Secret do MisticPay.',
    ''
  ),
  (
    'Robot API — utilizador',
    'ROBOT_API_USERNAME',
    '',
    'Utilizador da API Robot (cheats), se aplicável.',
    ''
  ),
  (
    'Robot API — palavra-passe',
    'ROBOT_API_PASSWORD',
    '',
    'Palavra-passe da API Robot.',
    ''
  )
ON CONFLICT (env_key) DO NOTHING;
