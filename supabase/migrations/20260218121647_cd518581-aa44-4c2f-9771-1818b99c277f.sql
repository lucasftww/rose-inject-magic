-- Force complete o pagamento 93c4349a e entrega manual do stock item
-- 1. Marcar pagamento como COMPLETED
UPDATE public.payments 
SET status = 'COMPLETED', paid_at = now()
WHERE id = '93c4349a-4eb1-4dc9-9103-a78d361a9cc2'
  AND status = 'ACTIVE';

-- 2. Pegar primeiro stock item disponível para o plano 2da43449
-- e criar o ticket de entrega
WITH stock AS (
  UPDATE public.stock_items
  SET used = true, used_at = now()
  WHERE id = (
    SELECT id FROM public.stock_items
    WHERE product_plan_id = '2da43449-2e02-4b94-a20c-90ffb781eb09'
      AND used = false
    LIMIT 1
  )
  RETURNING id, content, product_plan_id
),
new_ticket AS (
  INSERT INTO public.order_tickets (user_id, product_id, product_plan_id, stock_item_id, status, status_label)
  SELECT 
    '74d62e3a-5302-4db2-90ff-af63fe6f1c79',
    'cb245379-036e-445b-8421-215b47bc77c8',
    '2da43449-2e02-4b94-a20c-90ffb781eb09',
    stock.id,
    'delivered',
    'Entregue'
  FROM stock
  RETURNING id, (SELECT content FROM stock) as stock_content
)
INSERT INTO public.ticket_messages (ticket_id, sender_id, sender_role, message)
SELECT 
  new_ticket.id,
  '74d62e3a-5302-4db2-90ff-af63fe6f1c79',
  'staff',
  '✅ Seu produto foi entregue! Chave: ' || new_ticket.stock_content
FROM new_ticket;