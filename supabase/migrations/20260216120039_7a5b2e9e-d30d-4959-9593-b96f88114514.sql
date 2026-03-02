
-- Allow resellers to view stock items they purchased
CREATE POLICY "Resellers can view own purchased stock"
ON public.stock_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM reseller_purchases rp
    JOIN resellers r ON r.id = rp.reseller_id
    WHERE rp.stock_item_id = stock_items.id
    AND r.user_id = auth.uid()
  )
);
