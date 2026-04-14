-- Idempotency log for server-side purchase tracking providers (Meta CAPI, UTMify, etc.)
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_tracking_events'
      AND policyname = 'Service can manage payment tracking events'
  ) THEN
    CREATE POLICY "Service can manage payment tracking events"
      ON public.payment_tracking_events
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
