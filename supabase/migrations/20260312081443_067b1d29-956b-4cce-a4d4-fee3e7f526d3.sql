
-- Fix 1: Restrict order_tickets INSERT to service_role only (prevents ticket forging, tutorial bypass, and stock item access)
DROP POLICY IF EXISTS "Users can insert own tickets" ON public.order_tickets;
CREATE POLICY "Service role can insert tickets" ON public.order_tickets
  FOR INSERT TO service_role WITH CHECK (true);

-- Fix 2: Restrict order_tickets UPDATE to service_role + own user SELECT-only fields
DROP POLICY IF EXISTS "Users can update own tickets" ON public.order_tickets;
CREATE POLICY "Service role can update tickets" ON public.order_tickets
  FOR UPDATE TO service_role USING (true);
