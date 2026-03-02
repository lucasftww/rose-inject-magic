-- Delete ticket messages first (FK dependency)
DELETE FROM ticket_messages WHERE ticket_id IN (
  SELECT id FROM order_tickets WHERE user_id = '1acd6b09-4d6c-4cd0-bfd1-d16ddc55db2b'
);

-- Delete the tickets
DELETE FROM order_tickets WHERE user_id = '1acd6b09-4d6c-4cd0-bfd1-d16ddc55db2b';