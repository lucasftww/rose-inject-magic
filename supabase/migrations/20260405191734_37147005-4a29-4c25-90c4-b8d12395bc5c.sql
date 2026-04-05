CREATE OR REPLACE FUNCTION public.admin_stock_counts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN '{"error":"forbidden"}'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    FROM (
      SELECT
        product_plan_id AS plan_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE used = false)::int AS available
      FROM stock_items
      GROUP BY product_plan_id
    ) t
  );
END;
$$;