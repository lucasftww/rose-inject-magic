-- Fix game field for Minecraft sale incorrectly set as valorant
UPDATE lzt_sales 
SET game = 'minecraft' 
WHERE lzt_item_id = '221385410' AND title ILIKE '%minecraft%';

-- Backfill buy_price for existing sales using markup multipliers
-- Fortnite: markup 1.6, so buy_price = sell_price / 1.6
UPDATE lzt_sales 
SET buy_price = ROUND(sell_price / 1.6, 2),
    profit = sell_price - ROUND(sell_price / 1.6, 2)
WHERE buy_price = 0 AND game = 'fortnite';

-- Minecraft: markup 1.6, so buy_price = sell_price / 1.6
UPDATE lzt_sales 
SET buy_price = ROUND(sell_price / 1.6, 2),
    profit = sell_price - ROUND(sell_price / 1.6, 2)
WHERE buy_price = 0 AND game = 'minecraft';