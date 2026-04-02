-- Margem específica para contas Steam (LZT game_type=steam); fallback = markup_multiplier
ALTER TABLE public.lzt_config
  ADD COLUMN IF NOT EXISTS markup_steam numeric;

UPDATE public.lzt_config
SET markup_steam = COALESCE(markup_steam, markup_multiplier, 3.0)
WHERE markup_steam IS NULL;

ALTER TABLE public.lzt_config
  ALTER COLUMN markup_steam SET DEFAULT 3.0;
