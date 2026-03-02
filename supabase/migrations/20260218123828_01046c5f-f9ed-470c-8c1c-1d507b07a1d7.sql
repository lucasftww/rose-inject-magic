
-- Delete ticket messages first (FK constraint)
DELETE FROM ticket_messages WHERE ticket_id = '07e0ec15-0218-49aa-9ea1-885a69187ff3';

-- Delete the ticket itself
DELETE FROM order_tickets WHERE id = '07e0ec15-0218-49aa-9ea1-885a69187ff3';
