
-- Table to store user login IPs
CREATE TABLE public.user_login_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_login_ips ENABLE ROW LEVEL SECURITY;

-- Only admins can view IPs
CREATE POLICY "Admins can view login IPs"
  ON public.user_login_ips FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- The edge function (service role) inserts IPs, so no INSERT policy needed for users
-- Admins can also insert via service role

-- Index for fast lookups by user
CREATE INDEX idx_user_login_ips_user_id ON public.user_login_ips(user_id);
CREATE INDEX idx_user_login_ips_logged_at ON public.user_login_ips(logged_at DESC);

-- Add banned column to profiles for ban tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_reason TEXT;
