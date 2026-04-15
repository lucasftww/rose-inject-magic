-- payment_tracking_events is only written by Edge Functions (service_role bypasses RLS).
-- Remove the permissive FOR ALL / USING (true) policy so anon/authenticated never get broad access
-- if table privileges are ever granted by mistake.

DROP POLICY IF EXISTS "Service can manage payment tracking events" ON public.payment_tracking_events;

REVOKE ALL ON TABLE public.payment_tracking_events FROM PUBLIC;
REVOKE ALL ON TABLE public.payment_tracking_events FROM anon;
REVOKE ALL ON TABLE public.payment_tracking_events FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_tracking_events TO service_role;
