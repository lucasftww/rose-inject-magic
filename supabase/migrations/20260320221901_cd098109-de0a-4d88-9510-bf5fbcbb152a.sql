CREATE OR REPLACE FUNCTION public.admin_verify()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  _nonce := replace(gen_random_uuid()::text, '-', '');
  
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
$function$;