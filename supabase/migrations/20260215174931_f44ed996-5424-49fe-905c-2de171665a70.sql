
-- Create ticket status enum
CREATE TYPE public.ticket_status AS ENUM ('open', 'delivered', 'resolved', 'closed', 'banned', 'finished');

-- Create order tickets table
CREATE TABLE public.order_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_plan_id uuid NOT NULL REFERENCES public.product_plans(id),
  stock_item_id uuid REFERENCES public.stock_items(id),
  status ticket_status NOT NULL DEFAULT 'open',
  status_label text NOT NULL DEFAULT 'Aberto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

-- Create ticket messages table
CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.order_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'user', -- 'user' or 'staff'
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS for order_tickets
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

-- RLS for ticket_messages
CREATE POLICY "Users can view messages of own tickets"
ON public.ticket_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.order_tickets
  WHERE order_tickets.id = ticket_messages.ticket_id
  AND (order_tickets.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Users can send messages on own open tickets"
ON public.ticket_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.order_tickets
  WHERE order_tickets.id = ticket_messages.ticket_id
  AND order_tickets.user_id = auth.uid()
  AND order_tickets.status = 'open'
));

CREATE POLICY "Admins can manage all messages"
ON public.ticket_messages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_order_tickets_updated_at
BEFORE UPDATE ON public.order_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_tickets;
