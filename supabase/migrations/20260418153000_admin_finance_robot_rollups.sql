-- Ledger Robot a partir de pagamentos COMPLETED + cart_snapshot (alinhado a buildRobotSalesLedgerFromPayments).
-- Agregados por período; não depende da amostra truncada no cliente.

CREATE OR REPLACE FUNCTION public.admin_finance_robot_rollups()
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
    robot_products AS (
      SELECT
        p.id,
        p.robot_markup_percent AS mup
      FROM public.products p
      WHERE p.robot_game_id IS NOT NULL
    ),
    pay AS (
      SELECT
        pay.id,
        COALESCE(pay.paid_at, pay.created_at) AS ts,
        (pay.amount::numeric / 100.0) AS actual_paid,
        pay.cart_snapshot
      FROM public.payments pay
      WHERE pay.status = 'COMPLETED'
        AND pay.cart_snapshot IS NOT NULL
        AND jsonb_typeof(pay.cart_snapshot) = 'array'
        AND jsonb_array_length(pay.cart_snapshot) > 0
    ),
    cart_totals AS (
      SELECT
        p.id,
        SUM(GREATEST(COALESCE((elem->>'price')::numeric, 0), 0)) AS cart_total
      FROM pay p
      CROSS JOIN LATERAL jsonb_array_elements(p.cart_snapshot) AS elem
      GROUP BY p.id
    ),
    lines AS (
      SELECT
        p.ts,
        p.actual_paid,
        GREATEST(COALESCE((elem->>'price')::numeric, 0), 0) AS line_price,
        ct.cart_total,
        rp.mup
      FROM pay p
      CROSS JOIN LATERAL jsonb_array_elements(p.cart_snapshot) AS elem
      INNER JOIN cart_totals ct ON ct.id = p.id
      INNER JOIN robot_products rp ON lower(rp.id::text) = lower(NULLIF(trim(elem->>'productId'), ''))
      WHERE elem ? 'productId'
        AND length(trim(COALESCE(elem->>'productId', ''))) >= 32
        AND COALESCE(elem->>'type', '') NOT IN ('lzt-account', 'raspadinha')
    ),
    lines_calc AS (
      SELECT
        l.ts,
        CASE
          WHEN l.cart_total > 0 THEN round((l.actual_paid * (l.line_price / l.cart_total))::numeric, 2)
          ELSE 0::numeric
        END AS revenue,
        l.mup
      FROM lines l
    ),
    lines_with_cost AS (
      SELECT
        c.ts,
        c.revenue,
        CASE
          WHEN c.revenue > 0 AND c.mup IS NOT NULL THEN
            round((c.revenue / (1 + (COALESCE(NULLIF(c.mup, 0::numeric), 50::numeric) / 100.0)))::numeric, 2)
          ELSE 0::numeric
        END AS cost
      FROM lines_calc c
    ),
    lines_profit AS (
      SELECT
        ts,
        revenue,
        cost,
        round((revenue - cost)::numeric, 2) AS profit
      FROM lines_with_cost
    )
    SELECT jsonb_build_object(
      '24h', (SELECT to_jsonb(x) FROM (
        SELECT
          round(COALESCE(SUM(revenue), 0), 2) AS revenue,
          round(COALESCE(SUM(cost), 0), 2) AS cost,
          round(COALESCE(SUM(profit), 0), 2) AS profit,
          COUNT(*)::int AS lines
        FROM lines_profit lp CROSS JOIN b
        WHERE lp.ts >= b.n - interval '24 hours'
      ) x),
      '24h_prev', (SELECT to_jsonb(x) FROM (
        SELECT
          round(COALESCE(SUM(revenue), 0), 2) AS revenue,
          round(COALESCE(SUM(cost), 0), 2) AS cost,
          round(COALESCE(SUM(profit), 0), 2) AS profit,
          COUNT(*)::int AS lines
        FROM lines_profit lp CROSS JOIN b
        WHERE lp.ts >= b.n - interval '48 hours'
          AND lp.ts < b.n - interval '24 hours'
      ) x),
      '7d', (SELECT to_jsonb(x) FROM (
        SELECT
          round(COALESCE(SUM(revenue), 0), 2) AS revenue,
          round(COALESCE(SUM(cost), 0), 2) AS cost,
          round(COALESCE(SUM(profit), 0), 2) AS profit,
          COUNT(*)::int AS lines
        FROM lines_profit lp CROSS JOIN b
        WHERE lp.ts >= b.n - interval '7 days'
      ) x),
      '7d_prev', (SELECT to_jsonb(x) FROM (
        SELECT
          round(COALESCE(SUM(revenue), 0), 2) AS revenue,
          round(COALESCE(SUM(cost), 0), 2) AS cost,
          round(COALESCE(SUM(profit), 0), 2) AS profit,
          COUNT(*)::int AS lines
        FROM lines_profit lp CROSS JOIN b
        WHERE lp.ts >= b.n - interval '14 days'
          AND lp.ts < b.n - interval '7 days'
      ) x),
      '30d', (SELECT to_jsonb(x) FROM (
        SELECT
          round(COALESCE(SUM(revenue), 0), 2) AS revenue,
          round(COALESCE(SUM(cost), 0), 2) AS cost,
          round(COALESCE(SUM(profit), 0), 2) AS profit,
          COUNT(*)::int AS lines
        FROM lines_profit lp CROSS JOIN b
        WHERE lp.ts >= b.n - interval '30 days'
      ) x),
      '30d_prev', (SELECT to_jsonb(x) FROM (
        SELECT
          round(COALESCE(SUM(revenue), 0), 2) AS revenue,
          round(COALESCE(SUM(cost), 0), 2) AS cost,
          round(COALESCE(SUM(profit), 0), 2) AS profit,
          COUNT(*)::int AS lines
        FROM lines_profit lp CROSS JOIN b
        WHERE lp.ts >= b.n - interval '60 days'
          AND lp.ts < b.n - interval '30 days'
      ) x),
      'all', (SELECT to_jsonb(x) FROM (
        SELECT
          round(COALESCE(SUM(revenue), 0), 2) AS revenue,
          round(COALESCE(SUM(cost), 0), 2) AS cost,
          round(COALESCE(SUM(profit), 0), 2) AS profit,
          COUNT(*)::int AS lines
        FROM lines_profit lp
      ) x)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.admin_finance_robot_rollups() IS 'Admin: receita/custo/lucro Robot por período a partir de payments.cart_snapshot + products.robot_game_id.';

GRANT EXECUTE ON FUNCTION public.admin_finance_robot_rollups() TO authenticated;
