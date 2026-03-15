-- Atomic stock claim function to prevent race conditions in concurrent fulfillment
CREATE OR REPLACE FUNCTION public.claim_stock_item(_plan_id uuid)
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE stock_items
  SET used = true, used_at = now()
  WHERE id = (
    SELECT id FROM stock_items
    WHERE product_plan_id = _plan_id AND used = false
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
$$;