-- Revert tutorial links back to the old domain in product tutorial fields
UPDATE public.products
SET
  tutorial_text = REPLACE(tutorial_text, 'https://authmanager.vercel.app/', 'https://app.flowware.pro/'),
  tutorial_file_url = REPLACE(tutorial_file_url, 'https://authmanager.vercel.app/', 'https://app.flowware.pro/')
WHERE
  tutorial_text LIKE '%https://authmanager.vercel.app/%'
  OR tutorial_file_url LIKE '%https://authmanager.vercel.app/%';