-- Update all product tutorial links from old to new domain
UPDATE products 
SET tutorial_text = REPLACE(tutorial_text, 'https://app.flowware.pro/', 'https://authmanager.vercel.app/')
WHERE tutorial_text LIKE '%https://app.flowware.pro/%';