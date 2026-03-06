-- Drop overly permissive policies that allow any authenticated user to insert/update payments
DROP POLICY IF EXISTS "Service can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Service can update payments" ON public.payments;

-- Re-create scoped to service_role only (edge functions bypass RLS anyway)
CREATE POLICY "Service can insert payments"
  ON public.payments FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can update payments"
  ON public.payments FOR UPDATE
  TO service_role
  USING (true);

-- Allow users to read their own payments (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Users can view own payments'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
END $$;