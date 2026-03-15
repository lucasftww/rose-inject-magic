
-- Atomic increment for coupon usage counter (prevents race conditions)
CREATE OR REPLACE FUNCTION public.increment_coupon_uses(_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE coupons SET current_uses = COALESCE(current_uses, 0) + 1 WHERE id = _coupon_id;
$$;

-- Atomic increment for reseller total_purchases (prevents race conditions)
CREATE OR REPLACE FUNCTION public.increment_reseller_purchases(_reseller_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE resellers SET total_purchases = COALESCE(total_purchases, 0) + 1 WHERE id = _reseller_id;
$$;
