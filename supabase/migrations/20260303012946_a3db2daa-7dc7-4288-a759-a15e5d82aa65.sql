
-- Fix overly permissive INSERT policies on sensitive tables
-- Service role bypasses RLS entirely, so these "always true" INSERT policies
-- only serve to let any anonymous/authenticated user insert, which is dangerous.

-- 1. payments: drop open INSERT, replace with user-only insert
DROP POLICY IF EXISTS "Service can insert payments" ON public.payments;
CREATE POLICY "Users can insert own payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. order_tickets: drop open INSERT, replace with user-only insert  
DROP POLICY IF EXISTS "Service can insert tickets" ON public.order_tickets;
CREATE POLICY "Users can insert own tickets"
  ON public.order_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. lzt_sales: drop open INSERT (only admins/service should insert)
DROP POLICY IF EXISTS "Service can insert lzt sales" ON public.lzt_sales;

-- 4. coupon_usage: drop open INSERT, replace with user-only insert
DROP POLICY IF EXISTS "Service can insert usage" ON public.coupon_usage;
CREATE POLICY "Users can insert own usage"
  ON public.coupon_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. user_login_ips: keep open INSERT since edge function track-login uses service role
-- and there's no user_id context at insert time from client — this one stays as-is
-- (service role bypasses RLS anyway, so this policy is harmless but we'll restrict it)
DROP POLICY IF EXISTS "Service can insert login IPs" ON public.user_login_ips;
