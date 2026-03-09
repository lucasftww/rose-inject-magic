
-- 1. Restrict lzt_config: remove public SELECT, add authenticated-only
DROP POLICY IF EXISTS "Anyone can view lzt config" ON public.lzt_config;
CREATE POLICY "Authenticated can view lzt config"
  ON public.lzt_config FOR SELECT TO authenticated
  USING (true);

-- 2. Restrict coupons: remove open SELECT, only active coupons visible
DROP POLICY IF EXISTS "Authenticated can view coupons" ON public.coupons;
CREATE POLICY "Users can lookup active coupons"
  ON public.coupons FOR SELECT TO authenticated
  USING (active = true);

-- 3. Restrict profiles: hide ban details from other users
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 4. Revoke public EXECUTE on has_role to prevent admin enumeration
REVOKE EXECUTE ON FUNCTION public.has_role FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO postgres;
GRANT EXECUTE ON FUNCTION public.has_role TO service_role;

-- 5. Create separate table for tutorial data (passwords/links)
CREATE TABLE IF NOT EXISTS public.product_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tutorial_text text,
  tutorial_file_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.product_tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with orders can view tutorials"
  ON public.product_tutorials FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_tickets ot
      WHERE ot.product_id = product_tutorials.product_id
        AND ot.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage tutorials"
  ON public.product_tutorials FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Migrate existing tutorial data
INSERT INTO public.product_tutorials (product_id, tutorial_text, tutorial_file_url)
SELECT id, tutorial_text, tutorial_file_url
FROM public.products
WHERE tutorial_text IS NOT NULL OR tutorial_file_url IS NOT NULL
ON CONFLICT (product_id) DO NOTHING;

-- Clear sensitive tutorial data from public products table
UPDATE public.products
SET tutorial_text = NULL, tutorial_file_url = NULL
WHERE tutorial_text IS NOT NULL OR tutorial_file_url IS NOT NULL;
