-- Agregações por período no Postgres (totais correctos sem carregar milhões de linhas no browser).
-- Gráficos / fatia LZT-Robot-Estoque continuam a usar a amostra limitada no cliente (cart_snapshot).

CREATE OR REPLACE FUNCTION public.admin_finance_period_rollups()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH b AS (
      SELECT clock_timestamp() AS n
    ),
    pay AS (
      SELECT
        COALESCE(p.paid_at, p.created_at) AS ts,
        p.amount,
        p.user_id
      FROM public.payments p
      WHERE p.status = 'COMPLETED'
    ),
    lzt_rows AS (
      SELECT s.created_at AS ts, s.buy_price, s.sell_price, s.profit
      FROM public.lzt_sales s
    ),
    res AS (
      SELECT
        r.created_at AS ts,
        (COALESCE(r.original_price, 0) - COALESCE(r.paid_price, 0)) AS discount
      FROM public.reseller_purchases r
    )
    SELECT jsonb_build_object(
      'payments', jsonb_build_object(
        '24h', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(pay.amount), 0)::bigint AS revenue_cents,
            COUNT(*)::int AS count,
            COUNT(DISTINCT pay.user_id)::int AS buyers,
            COUNT(*) FILTER (WHERE pay.amount > 0)::int AS paid_count
          FROM pay CROSS JOIN b
          WHERE pay.ts >= b.n - interval '24 hours'
        ) x),
        '24h_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(pay.amount), 0)::bigint AS revenue_cents,
            COUNT(*)::int AS count,
            COUNT(DISTINCT pay.user_id)::int AS buyers,
            COUNT(*) FILTER (WHERE pay.amount > 0)::int AS paid_count
          FROM pay CROSS JOIN b
          WHERE pay.ts >= b.n - interval '48 hours'
            AND pay.ts < b.n - interval '24 hours'
        ) x),
        '7d', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(pay.amount), 0)::bigint AS revenue_cents,
            COUNT(*)::int AS count,
            COUNT(DISTINCT pay.user_id)::int AS buyers,
            COUNT(*) FILTER (WHERE pay.amount > 0)::int AS paid_count
          FROM pay CROSS JOIN b
          WHERE pay.ts >= b.n - interval '7 days'
        ) x),
        '7d_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(pay.amount), 0)::bigint AS revenue_cents,
            COUNT(*)::int AS count,
            COUNT(DISTINCT pay.user_id)::int AS buyers,
            COUNT(*) FILTER (WHERE pay.amount > 0)::int AS paid_count
          FROM pay CROSS JOIN b
          WHERE pay.ts >= b.n - interval '14 days'
            AND pay.ts < b.n - interval '7 days'
        ) x),
        '30d', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(pay.amount), 0)::bigint AS revenue_cents,
            COUNT(*)::int AS count,
            COUNT(DISTINCT pay.user_id)::int AS buyers,
            COUNT(*) FILTER (WHERE pay.amount > 0)::int AS paid_count
          FROM pay CROSS JOIN b
          WHERE pay.ts >= b.n - interval '30 days'
        ) x),
        '30d_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(pay.amount), 0)::bigint AS revenue_cents,
            COUNT(*)::int AS count,
            COUNT(DISTINCT pay.user_id)::int AS buyers,
            COUNT(*) FILTER (WHERE pay.amount > 0)::int AS paid_count
          FROM pay CROSS JOIN b
          WHERE pay.ts >= b.n - interval '60 days'
            AND pay.ts < b.n - interval '30 days'
        ) x),
        'all', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(pay.amount), 0)::bigint AS revenue_cents,
            COUNT(*)::int AS count,
            COUNT(DISTINCT pay.user_id)::int AS buyers,
            COUNT(*) FILTER (WHERE pay.amount > 0)::int AS paid_count
          FROM pay
        ) x)
      ),
      'lzt', jsonb_build_object(
        '24h', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(z.buy_price), 0)::numeric AS buy,
            COALESCE(SUM(z.sell_price), 0)::numeric AS sell,
            COALESCE(SUM(z.profit), 0)::numeric AS profit,
            COUNT(*)::int AS count
          FROM lzt_rows z CROSS JOIN b
          WHERE z.ts >= b.n - interval '24 hours'
        ) x),
        '24h_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(z.buy_price), 0)::numeric AS buy,
            COALESCE(SUM(z.sell_price), 0)::numeric AS sell,
            COALESCE(SUM(z.profit), 0)::numeric AS profit,
            COUNT(*)::int AS count
          FROM lzt_rows z CROSS JOIN b
          WHERE z.ts >= b.n - interval '48 hours'
            AND z.ts < b.n - interval '24 hours'
        ) x),
        '7d', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(z.buy_price), 0)::numeric AS buy,
            COALESCE(SUM(z.sell_price), 0)::numeric AS sell,
            COALESCE(SUM(z.profit), 0)::numeric AS profit,
            COUNT(*)::int AS count
          FROM lzt_rows z CROSS JOIN b
          WHERE z.ts >= b.n - interval '7 days'
        ) x),
        '7d_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(z.buy_price), 0)::numeric AS buy,
            COALESCE(SUM(z.sell_price), 0)::numeric AS sell,
            COALESCE(SUM(z.profit), 0)::numeric AS profit,
            COUNT(*)::int AS count
          FROM lzt_rows z CROSS JOIN b
          WHERE z.ts >= b.n - interval '14 days'
            AND z.ts < b.n - interval '7 days'
        ) x),
        '30d', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(z.buy_price), 0)::numeric AS buy,
            COALESCE(SUM(z.sell_price), 0)::numeric AS sell,
            COALESCE(SUM(z.profit), 0)::numeric AS profit,
            COUNT(*)::int AS count
          FROM lzt_rows z CROSS JOIN b
          WHERE z.ts >= b.n - interval '30 days'
        ) x),
        '30d_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(z.buy_price), 0)::numeric AS buy,
            COALESCE(SUM(z.sell_price), 0)::numeric AS sell,
            COALESCE(SUM(z.profit), 0)::numeric AS profit,
            COUNT(*)::int AS count
          FROM lzt_rows z CROSS JOIN b
          WHERE z.ts >= b.n - interval '60 days'
            AND z.ts < b.n - interval '30 days'
        ) x),
        'all', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(z.buy_price), 0)::numeric AS buy,
            COALESCE(SUM(z.sell_price), 0)::numeric AS sell,
            COALESCE(SUM(z.profit), 0)::numeric AS profit,
            COUNT(*)::int AS count
          FROM lzt_rows z
        ) x)
      ),
      'reseller', jsonb_build_object(
        '24h', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(r.discount), 0)::numeric AS discount,
            COUNT(*)::int AS count
          FROM res r CROSS JOIN b
          WHERE r.ts >= b.n - interval '24 hours'
        ) x),
        '24h_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(r.discount), 0)::numeric AS discount,
            COUNT(*)::int AS count
          FROM res r CROSS JOIN b
          WHERE r.ts >= b.n - interval '48 hours'
            AND r.ts < b.n - interval '24 hours'
        ) x),
        '7d', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(r.discount), 0)::numeric AS discount,
            COUNT(*)::int AS count
          FROM res r CROSS JOIN b
          WHERE r.ts >= b.n - interval '7 days'
        ) x),
        '7d_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(r.discount), 0)::numeric AS discount,
            COUNT(*)::int AS count
          FROM res r CROSS JOIN b
          WHERE r.ts >= b.n - interval '14 days'
            AND r.ts < b.n - interval '7 days'
        ) x),
        '30d', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(r.discount), 0)::numeric AS discount,
            COUNT(*)::int AS count
          FROM res r CROSS JOIN b
          WHERE r.ts >= b.n - interval '30 days'
        ) x),
        '30d_prev', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(r.discount), 0)::numeric AS discount,
            COUNT(*)::int AS count
          FROM res r CROSS JOIN b
          WHERE r.ts >= b.n - interval '60 days'
            AND r.ts < b.n - interval '30 days'
        ) x),
        'all', (SELECT to_jsonb(x) FROM (
          SELECT
            COALESCE(SUM(r.discount), 0)::numeric AS discount,
            COUNT(*)::int AS count
          FROM res r
        ) x)
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.admin_finance_period_rollups() IS 'Admin: somas por período (pagamentos COMPLETED, lzt_sales, reseller) para totais sem truncar no cliente.';

GRANT EXECUTE ON FUNCTION public.admin_finance_period_rollups() TO authenticated;
