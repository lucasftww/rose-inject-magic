
-- Remove overly permissive policy (edge function uses service role which bypasses RLS)
DROP POLICY "Service can update payments" ON public.payments;
