INSERT INTO public.lzt_sales (lzt_item_id, buy_price, sell_price, profit, account_title, buyer_user_id, sold_at)
SELECT 
  metadata->>'lzt_item_id',
  COALESCE((metadata->>'price_paid')::numeric, 0),
  COALESCE((metadata->>'price_paid')::numeric, 0),
  0,
  metadata->>'account_name',
  user_id,
  created_at
FROM public.order_tickets
WHERE metadata->>'type' = 'lzt-account'
AND NOT EXISTS (
  SELECT 1 FROM public.lzt_sales ls WHERE ls.lzt_item_id = order_tickets.metadata->>'lzt_item_id'
)