-- Bases legadas: tabela system_credentials sem coluna `id` (PK só em env_key).
-- Corrige "column system_credentials.id does not exist" e pedidos id=eq.undefined no admin.

DO $$
DECLARE
  pk_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_credentials'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_credentials' AND column_name = 'id'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.system_credentials ADD COLUMN id uuid DEFAULT gen_random_uuid();
  UPDATE public.system_credentials SET id = gen_random_uuid() WHERE id IS NULL;
  ALTER TABLE public.system_credentials ALTER COLUMN id SET NOT NULL;
  ALTER TABLE public.system_credentials ALTER COLUMN id SET DEFAULT gen_random_uuid();

  SELECT tc.constraint_name INTO pk_name
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'system_credentials'
    AND tc.constraint_type = 'PRIMARY KEY'
  LIMIT 1;

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.system_credentials DROP CONSTRAINT %I', pk_name);
  END IF;

  ALTER TABLE public.system_credentials ADD CONSTRAINT system_credentials_pkey PRIMARY KEY (id);

  -- Após remover PK só em env_key, garantir UNIQUE em env_key (pode já existir como constraint separada)
  BEGIN
    ALTER TABLE public.system_credentials ADD CONSTRAINT system_credentials_env_key_unique UNIQUE (env_key);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
