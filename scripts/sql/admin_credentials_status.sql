-- Uso: npx supabase db query --linked -f scripts/sql/admin_credentials_status.sql -o table --agent no
-- Mostra chaves e se há valor (sem revelar segredos).
SELECT
  env_key,
  (NULLIF(btrim(COALESCE(value, '')), '') IS NOT NULL) AS configured
FROM public.system_credentials
ORDER BY env_key;
