
-- Allow users to read stock items linked to their tickets
CREATE POLICY "Users can view own delivered stock"
ON public.stock_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM order_tickets
    WHERE order_tickets.stock_item_id = stock_items.id
    AND order_tickets.user_id = auth.uid()
  )
);

-- Allow authenticated users to claim available stock (read unused items for checkout)
CREATE POLICY "Authenticated users can read available stock"
ON public.stock_items
FOR SELECT
USING (used = false);

-- Allow authenticated users to mark stock as used during checkout
CREATE POLICY "Authenticated users can claim stock"
ON public.stock_items
FOR UPDATE
USING (used = false)
WITH CHECK (used = true);
