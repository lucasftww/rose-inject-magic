-- Fix existing LZT account tickets missing game field
UPDATE order_tickets 
SET metadata = metadata || '{"game": "fortnite"}'::jsonb 
WHERE metadata->>'type' = 'lzt-account' 
AND metadata->>'game' IS NULL 
AND (metadata->>'account_name' ILIKE '%fortnite%' OR metadata->>'title' ILIKE '%fortnite%');

UPDATE order_tickets 
SET metadata = metadata || '{"game": "valorant"}'::jsonb 
WHERE metadata->>'type' = 'lzt-account' 
AND metadata->>'game' IS NULL;

-- Backfill lzt_sales from existing order_tickets that don't have a corresponding sale
INSERT INTO lzt_sales (lzt_item_id, buy_price, sell_price, profit, title, game, buyer_user_id, created_at)
SELECT 
  metadata->>'lzt_item_id',
  0,
  COALESCE((metadata->>'price_paid')::numeric, (metadata->>'sell_price')::numeric, 0),
  COALESCE((metadata->>'price_paid')::numeric, (metadata->>'sell_price')::numeric, 0),
  COALESCE(metadata->>'account_name', metadata->>'title', 'Conta LZT'),
  metadata->>'game',
  user_id,
  created_at
FROM order_tickets 
WHERE metadata->>'type' = 'lzt-account'
AND NOT EXISTS (
  SELECT 1 FROM lzt_sales ls 
  WHERE ls.lzt_item_id = order_tickets.metadata->>'lzt_item_id'
);