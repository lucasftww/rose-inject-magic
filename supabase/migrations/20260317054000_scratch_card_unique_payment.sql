-- Audit fix: Ensure scratch_card_plays has a unique constraint on payment_id
-- This is the atomic database gate that prevents TOCTOU replay attacks.
-- The edge function's SELECT check provides a friendly early rejection,
-- but this constraint is the true concurrency-safe guard.

ALTER TABLE scratch_card_plays
  ADD CONSTRAINT scratch_card_plays_payment_id_unique UNIQUE (payment_id);
