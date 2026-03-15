-- Re-grant robot_markup_percent to authenticated (needed by admin panel)
-- The column is low-risk (pricing margin) and admin queries need it via JS client
GRANT SELECT (robot_markup_percent, tutorial_text, tutorial_file_url) ON public.products TO authenticated;

-- The tutorial columns were already nulled in a previous migration
-- The real protection is the product_tutorials table with purchase-gated RLS