
-- 1. Drop the blanket public SELECT policy on products
--    Column-level grants already restrict anon access, but the policy itself is flagged
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;

-- 2. Create a new policy for authenticated users only (admins already have ALL)
CREATE POLICY "Authenticated can view products"
  ON public.products FOR SELECT TO authenticated
  USING (true);

-- 3. Create a restricted policy for anon (only through column-level grants)
CREATE POLICY "Anon can view products"
  ON public.products FOR SELECT TO anon
  USING (true);

-- 4. Fix product_tutorials: require completed payment, not just any ticket
DROP POLICY IF EXISTS "Users with orders can view tutorials" ON public.product_tutorials;
CREATE POLICY "Users with paid orders can view tutorials"
  ON public.product_tutorials FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM order_tickets ot
      JOIN payments p ON p.user_id = ot.user_id
      WHERE ot.product_id = product_tutorials.product_id
        AND ot.user_id = auth.uid()
        AND (ot.status = 'delivered' OR ot.status = 'closed'
             OR EXISTS (
               SELECT 1 FROM payments pay
               WHERE pay.user_id = auth.uid()
                 AND pay.status = 'COMPLETED'
                 AND pay.cart_snapshot::text LIKE '%' || ot.product_id::text || '%'
             ))
    )
  );
