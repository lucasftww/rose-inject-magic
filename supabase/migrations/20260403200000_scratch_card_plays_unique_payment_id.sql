-- One scratch play per payment (idempotent Edge Function + race safety)
-- Remove duplicate rows for the same payment_id (tie-break: created_at, then id)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY payment_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.scratch_card_plays
  WHERE payment_id IS NOT NULL
)
DELETE FROM public.scratch_card_plays p
  USING ranked r
 WHERE p.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS scratch_card_plays_payment_id_unique
  ON public.scratch_card_plays (payment_id)
  WHERE payment_id IS NOT NULL;
