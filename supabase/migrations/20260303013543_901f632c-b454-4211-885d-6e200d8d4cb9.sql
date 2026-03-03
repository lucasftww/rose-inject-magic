
-- Fix the remaining overly permissive UPDATE policy on payments
-- Service role bypasses RLS, so this open UPDATE is unnecessary and dangerous
DROP POLICY IF EXISTS "Service can update payments" ON public.payments;
