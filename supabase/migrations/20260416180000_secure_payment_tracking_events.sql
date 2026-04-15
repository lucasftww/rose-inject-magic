-- Idempotency log for server-side purchase tracking (Meta CAPI, UTMify, etc.).
-- Some remotes never had the table despite older migration history; CREATE IF NOT EXISTS is safe.
-- No permissive RLS policy: Edge uses service_role (bypasses RLS); clients must not have broad access.

CREATE TABLE IF NOT EXISTS public.payment_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id, provider, event_name)
);

ALTER TABLE public.payment_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage payment tracking events" ON public.payment_tracking_events;

REVOKE ALL ON TABLE public.payment_tracking_events FROM PUBLIC;
REVOKE ALL ON TABLE public.payment_tracking_events FROM anon;
REVOKE ALL ON TABLE public.payment_tracking_events FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_tracking_events TO service_role;
