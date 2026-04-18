-- Admin finance/overview: leituras em bulk no Postgres (1 round-trip) em vez de milhares de .range() no cliente.
-- Guard: apenas sessão admin (is_admin_session).

CREATE INDEX IF NOT EXISTS idx_payments_completed_paid_at
  ON public.payments (paid_at DESC NULLS LAST)
  WHERE status = 'COMPLETED';

CREATE INDEX IF NOT EXISTS idx_lzt_sales_created_at
  ON public.lzt_sales (created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_reseller_purchases_created_at
  ON public.reseller_purchases (created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_order_tickets_created_at
  ON public.order_tickets (created_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.admin_finance_completed_payments(p_limit integer DEFAULT 2000000)
RETURNS TABLE (
  id uuid,
  amount integer,
  status text,
  created_at timestamptz,
  paid_at timestamptz,
  cart_snapshot jsonb,
  payment_method text,
  discount_amount numeric,
  user_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer := LEAST(GREATEST(COALESCE(p_limit, 2000000), 1), 5000000);
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.amount,
    p.status,
    p.created_at,
    p.paid_at,
    p.cart_snapshot,
    p.payment_method,
    COALESCE(p.discount_amount, 0)::numeric,
    p.user_id
  FROM public.payments p
  WHERE p.status = 'COMPLETED'
  ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
  LIMIT lim;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finance_lzt_sales(p_limit integer DEFAULT 2000000)
RETURNS TABLE (
  buy_price numeric,
  sell_price numeric,
  profit numeric,
  created_at timestamptz,
  game text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer := LEAST(GREATEST(COALESCE(p_limit, 2000000), 1), 5000000);
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    s.buy_price,
    s.sell_price,
    s.profit,
    s.created_at,
    s.game
  FROM public.lzt_sales s
  ORDER BY s.created_at DESC NULLS LAST
  LIMIT lim;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finance_reseller_purchases(p_limit integer DEFAULT 1000000)
RETURNS TABLE (
  original_price numeric,
  paid_price numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer := LEAST(GREATEST(COALESCE(p_limit, 1000000), 1), 5000000);
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    r.original_price,
    r.paid_price,
    r.created_at
  FROM public.reseller_purchases r
  ORDER BY r.created_at DESC NULLS LAST
  LIMIT lim;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finance_order_tickets(p_limit integer DEFAULT 2000000)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  product_plan_id uuid,
  user_id uuid,
  metadata jsonb,
  status text,
  created_at timestamptz,
  status_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer := LEAST(GREATEST(COALESCE(p_limit, 2000000), 1), 5000000);
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    t.id,
    t.product_id,
    t.product_plan_id,
    t.user_id,
    t.metadata,
    t.status,
    t.created_at,
    t.status_label
  FROM public.order_tickets t
  ORDER BY t.created_at DESC NULLS LAST
  LIMIT lim;
END;
$$;

COMMENT ON FUNCTION public.admin_finance_completed_payments(integer) IS 'Admin: pagamentos COMPLETED mais recentes (limite máx. 5M).';
COMMENT ON FUNCTION public.admin_finance_lzt_sales(integer) IS 'Admin: linhas lzt_sales mais recentes.';
COMMENT ON FUNCTION public.admin_finance_reseller_purchases(integer) IS 'Admin: reseller_purchases mais recentes.';
COMMENT ON FUNCTION public.admin_finance_order_tickets(integer) IS 'Admin: order_tickets mais recentes.';

GRANT EXECUTE ON FUNCTION public.admin_finance_completed_payments(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_lzt_sales(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_reseller_purchases(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_order_tickets(integer) TO authenticated;
