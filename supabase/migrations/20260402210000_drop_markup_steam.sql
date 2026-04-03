-- Steam listings removed from storefront; column no longer used
ALTER TABLE public.lzt_config
  DROP COLUMN IF EXISTS markup_steam;
