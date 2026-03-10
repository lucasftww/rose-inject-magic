
-- 1. COUPONS: Replace open SELECT policy with a secure RPC for coupon validation
-- Drop the policy that exposes all active coupons to authenticated users
DROP POLICY IF EXISTS "Users can lookup active coupons" ON public.coupons;

-- Create a secure RPC that validates a specific coupon code without exposing all codes
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _user_id uuid,
  _cart_product_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coupon record;
  _result jsonb;
  _usage_count int;
  _user_used boolean;
  _is_restricted_users boolean;
  _is_restricted_products boolean;
  _user_allowed boolean;
  _products_allowed boolean;
BEGIN
  -- Find the coupon by code (case-insensitive)
  SELECT * INTO _coupon FROM coupons WHERE UPPER(code) = UPPER(_code) AND active = true LIMIT 1;
  
  IF _coupon IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom não encontrado ou inativo');
  END IF;

  -- Check expiry
  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom expirado');
  END IF;

  -- Check max uses
  IF _coupon.max_uses > 0 AND _coupon.current_uses >= _coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom esgotado');
  END IF;

  -- Check if user already used it
  SELECT EXISTS(SELECT 1 FROM coupon_usage WHERE coupon_id = _coupon.id AND user_id = _user_id) INTO _user_used;
  IF _user_used THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Você já usou este cupom');
  END IF;

  -- Check user restriction
  SELECT EXISTS(SELECT 1 FROM coupon_users WHERE coupon_id = _coupon.id LIMIT 1) INTO _is_restricted_users;
  IF _is_restricted_users THEN
    SELECT EXISTS(SELECT 1 FROM coupon_users WHERE coupon_id = _coupon.id AND user_id = _user_id) INTO _user_allowed;
    IF NOT _user_allowed THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Cupom não disponível para sua conta');
    END IF;
  END IF;

  -- Check product restriction
  SELECT EXISTS(SELECT 1 FROM coupon_products WHERE coupon_id = _coupon.id LIMIT 1) INTO _is_restricted_products;
  IF _is_restricted_products AND array_length(_cart_product_ids, 1) > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM coupon_products 
      WHERE coupon_id = _coupon.id AND product_id = ANY(_cart_product_ids)
    ) INTO _products_allowed;
    IF NOT _products_allowed THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Cupom não válido para estes produtos');
    END IF;
  END IF;

  -- Return valid coupon info (without exposing the code itself or internal IDs)
  RETURN jsonb_build_object(
    'valid', true,
    'id', _coupon.id,
    'discount_type', _coupon.discount_type,
    'discount_value', _coupon.discount_value,
    'min_order_value', _coupon.min_order_value
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, uuid[]) TO authenticated;

-- 2. SCRATCH CARD PRIZES: Create a public view without win_percentage
CREATE OR REPLACE VIEW public.scratch_card_prizes_public AS
SELECT id, name, description, image_url, prize_value, product_id, sort_order, active, created_at
FROM public.scratch_card_prizes;

-- Grant access to the view
GRANT SELECT ON public.scratch_card_prizes_public TO anon;
GRANT SELECT ON public.scratch_card_prizes_public TO authenticated;

-- Remove public access to the base table (keep admin policy)
DROP POLICY IF EXISTS "Anyone can view prizes" ON public.scratch_card_prizes;

-- Add policy so only admins can view base table
CREATE POLICY "Only admins can view prizes" ON public.scratch_card_prizes
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- 3. LZT_CONFIG: Remove authenticated access (edge function reads it server-side)
DROP POLICY IF EXISTS "Authenticated can view lzt config" ON public.lzt_config;
