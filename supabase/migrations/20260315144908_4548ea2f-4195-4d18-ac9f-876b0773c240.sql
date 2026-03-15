
-- Remove anon direct access to scratch_card_prizes (force use of public view)
DROP POLICY IF EXISTS "Anon can view prizes" ON public.scratch_card_prizes;

-- Revoke anon direct access to scratch_card_prizes base table
REVOKE ALL ON public.scratch_card_prizes FROM anon;
GRANT SELECT ON public.public_scratch_card_prizes TO anon;

-- Remove anon direct access to products base table (force use of public_products view)
DROP POLICY IF EXISTS "Anon can view products" ON public.products;

REVOKE ALL ON public.products FROM anon;
GRANT SELECT ON public.public_products TO anon;
