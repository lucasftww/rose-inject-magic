-- 1) Fix: Remove direct anon SELECT on products table (exposes robot_markup_percent)
DROP POLICY IF EXISTS "Anon can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can view products" ON public.products;

-- Re-add authenticated SELECT (needed for checkout, order pages - admin has ALL policy)
CREATE POLICY "Authenticated can view products"
  ON public.products FOR SELECT TO authenticated
  USING (true);

-- 2) Recreate public_products view with robot_game_id but WITHOUT robot_markup_percent
DROP VIEW IF EXISTS public.public_products;
CREATE VIEW public.public_products AS
  SELECT id, name, description, image_url, active, sort_order, game_id,
         created_at, status, status_label, status_updated_at, features_text,
         robot_game_id
  FROM public.products;

GRANT SELECT ON public.public_products TO anon;
GRANT SELECT ON public.public_products TO authenticated;

-- 3) Fix tutorial RLS: remove dead JOIN on unused payments alias 'p'
DROP POLICY IF EXISTS "Users with paid orders can view tutorials" ON public.product_tutorials;
CREATE POLICY "Users with paid orders can view tutorials"
  ON public.product_tutorials FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM order_tickets ot
      WHERE ot.product_id = product_tutorials.product_id
        AND ot.user_id = auth.uid()
        AND (
          ot.status = 'delivered'
          OR ot.status = 'closed'
          OR EXISTS (
            SELECT 1 FROM payments pay
            WHERE pay.user_id = auth.uid()
              AND pay.status = 'COMPLETED'
              AND (pay.cart_snapshot)::text LIKE ('%' || (ot.product_id)::text || '%')
          )
        )
    )
  );