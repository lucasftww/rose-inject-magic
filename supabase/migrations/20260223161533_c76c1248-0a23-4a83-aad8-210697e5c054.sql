ALTER TABLE public.lzt_config
  ADD COLUMN IF NOT EXISTS markup_valorant numeric NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS markup_lol numeric NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS markup_fortnite numeric NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS markup_minecraft numeric NOT NULL DEFAULT 1.5;

UPDATE public.lzt_config SET
  markup_valorant = markup_multiplier,
  markup_lol = markup_multiplier,
  markup_fortnite = markup_multiplier,
  markup_minecraft = markup_multiplier;