
-- Drop tutorial columns from products table entirely
-- Tutorial content should only live in product_tutorials table
ALTER TABLE public.products DROP COLUMN IF EXISTS tutorial_text;
ALTER TABLE public.products DROP COLUMN IF EXISTS tutorial_file_url;
