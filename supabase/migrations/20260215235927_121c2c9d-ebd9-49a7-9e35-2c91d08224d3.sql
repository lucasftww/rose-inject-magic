-- Fix RLS policies on order_tickets to be PERMISSIVE instead of RESTRICTIVE
DROP POLICY IF EXISTS "Users can view own tickets" ON public.order_tickets;
DROP POLICY IF EXISTS "Users can create own tickets" ON public.order_tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.order_tickets;

CREATE POLICY "Users can view own tickets"
  ON public.order_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets"
  ON public.order_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets"
  ON public.order_tickets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix ticket_messages too
DROP POLICY IF EXISTS "Users can view messages of own tickets" ON public.ticket_messages;
DROP POLICY IF EXISTS "Users can send messages on own open tickets" ON public.ticket_messages;
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.ticket_messages;

CREATE POLICY "Users can view messages of own tickets"
  ON public.ticket_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM order_tickets
    WHERE order_tickets.id = ticket_messages.ticket_id
    AND (order_tickets.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can send messages on own open tickets"
  ON public.ticket_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM order_tickets
    WHERE order_tickets.id = ticket_messages.ticket_id
    AND order_tickets.user_id = auth.uid()
    AND order_tickets.status = 'open'::ticket_status
  ));

CREATE POLICY "Admins can manage all messages"
  ON public.ticket_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix stock_items policies
DROP POLICY IF EXISTS "Users can view own delivered stock" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated users can read available stock" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated users can claim stock" ON public.stock_items;
DROP POLICY IF EXISTS "Admins can manage stock" ON public.stock_items;

CREATE POLICY "Users can view own delivered stock"
  ON public.stock_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM order_tickets
    WHERE order_tickets.stock_item_id = stock_items.id
    AND order_tickets.user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can read available stock"
  ON public.stock_items FOR SELECT
  USING (used = false);

CREATE POLICY "Authenticated users can claim stock"
  ON public.stock_items FOR UPDATE
  USING (used = false)
  WITH CHECK (used = true);

CREATE POLICY "Admins can manage stock"
  ON public.stock_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));