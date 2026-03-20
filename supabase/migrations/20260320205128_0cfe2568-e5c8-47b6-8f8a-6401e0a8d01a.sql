
-- Table to log every admin access attempt (successful or not)
CREATE TABLE public.admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  ip_hint text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the log
CREATE POLICY "Admins can read access log"
  ON public.admin_access_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- System can insert access log entries
CREATE POLICY "System can insert access log"
  ON public.admin_access_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Independent admin verification function (does NOT use has_role)
CREATE OR REPLACE FUNCTION public.admin_verify()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _uid uuid;
  _is_admin boolean;
  _nonce text;
BEGIN
  _uid := auth.uid();
  
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('verified', false, 'reason', 'not_authenticated');
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = 'admin'
  ) INTO _is_admin;
  
  _nonce := encode(gen_random_bytes(16), 'hex');
  
  INSERT INTO public.admin_access_log (user_id, granted)
  VALUES (_uid, _is_admin);
  
  IF NOT _is_admin THEN
    RETURN jsonb_build_object('verified', false, 'reason', 'not_admin');
  END IF;
  
  RETURN jsonb_build_object(
    'verified', true,
    'nonce', _nonce,
    'uid', _uid,
    'ts', extract(epoch from now())::bigint
  );
END;
$$;

CREATE INDEX idx_admin_access_log_created ON public.admin_access_log (created_at DESC);
CREATE INDEX idx_admin_access_log_user ON public.admin_access_log (user_id, created_at DESC);
