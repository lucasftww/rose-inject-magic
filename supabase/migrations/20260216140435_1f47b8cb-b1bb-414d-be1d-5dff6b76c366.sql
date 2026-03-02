
-- Add tutorial fields to products table
ALTER TABLE public.products ADD COLUMN tutorial_text text DEFAULT null;
ALTER TABLE public.products ADD COLUMN tutorial_file_url text DEFAULT null;
