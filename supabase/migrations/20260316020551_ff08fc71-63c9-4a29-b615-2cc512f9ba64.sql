
-- Aggregated finance stats for admin
CREATE OR REPLACE FUNCTION public.admin_finance_summary(_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only admins
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN '{"error":"forbidden"}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(amount), 0),
    'total_count', COUNT(*),
    'method_pix_count', COUNT(*) FILTER (WHERE COALESCE(payment_method, 'pix') = 'pix'),
    'method_pix_revenue', COALESCE(SUM(amount) FILTER (WHERE COALESCE(payment_method, 'pix') = 'pix'), 0),
    'method_card_count', COUNT(*) FILTER (WHERE payment_method = 'card'),
    'method_card_revenue', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'card'), 0),
    'method_crypto_count', COUNT(*) FILTER (WHERE payment_method = 'crypto'),
    'method_crypto_revenue', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'crypto'), 0)
  ) INTO result
  FROM payments
  WHERE status = 'COMPLETED'
    AND (_since IS NULL OR paid_at >= _since);

  RETURN result;
END;
$$;

-- Aggregated scratch card stats for admin
CREATE OR REPLACE FUNCTION public.admin_scratch_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN '{"error":"forbidden"}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'total_plays', COUNT(*),
    'total_wins', COUNT(*) FILTER (WHERE won = true),
    'total_revenue', COALESCE(SUM(amount_paid), 0)
  ) INTO result
  FROM scratch_card_plays;

  RETURN result;
END;
$$;

-- Aggregated LZT sales stats for admin
CREATE OR REPLACE FUNCTION public.admin_lzt_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN '{"error":"forbidden"}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'total_bought', COALESCE(SUM(buy_price), 0),
    'total_sold', COALESCE(SUM(sell_price), 0),
    'total_profit', COALESCE(SUM(profit), 0),
    'total_count', COUNT(*)
  ) INTO result
  FROM lzt_sales;

  RETURN result;
END;
$$;

-- Overview stats for admin (aggregated counts and revenue)
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  _total_orders bigint;
  _total_revenue bigint;
  _total_paid_payments bigint;
  _total_resellers bigint;
  _total_products bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN '{"error":"forbidden"}'::jsonb;
  END IF;

  SELECT COUNT(*) INTO _total_orders FROM order_tickets;
  SELECT COALESCE(SUM(amount), 0), COUNT(*) INTO _total_revenue, _total_paid_payments FROM payments WHERE status = 'COMPLETED';
  SELECT COUNT(*) INTO _total_resellers FROM resellers WHERE active = true;
  SELECT COUNT(*) INTO _total_products FROM products;

  RETURN jsonb_build_object(
    'total_orders', _total_orders,
    'total_revenue', _total_revenue,
    'total_paid_payments', _total_paid_payments,
    'total_resellers', _total_resellers,
    'total_products', _total_products
  );
END;
$$;

-- Admin: count order_tickets with optional status filter
CREATE OR REPLACE FUNCTION public.admin_sales_count(_status text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN 0;
  END IF;

  IF _status IS NULL OR _status = 'all' THEN
    SELECT COUNT(*) INTO result FROM order_tickets;
  ELSE
    SELECT COUNT(*) INTO result FROM order_tickets WHERE status = _status;
  END IF;

  RETURN result;
END;
$$;

-- Admin: revenue sum from delivered tickets
CREATE OR REPLACE FUNCTION public.admin_sales_revenue()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN 0;
  END IF;

  -- Sum from payments with COMPLETED status
  SELECT COALESCE(SUM(amount), 0) INTO result FROM payments WHERE status = 'COMPLETED';
  RETURN result;
END;
$$;
