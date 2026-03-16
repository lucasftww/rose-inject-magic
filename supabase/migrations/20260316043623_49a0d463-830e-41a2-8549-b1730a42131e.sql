-- Fix: products table is missing anon SELECT grant
-- The RLS policy "Anon can view products" exists but the table-level grant was revoked
GRANT SELECT ON public.products TO anon;