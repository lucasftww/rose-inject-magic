
-- Drop existing permissive policies for game-images bucket
DROP POLICY IF EXISTS "Auth users can upload game images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update game images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete game images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload game images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update game images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete game images" ON storage.objects;

-- Add admin-only policies
CREATE POLICY "Admins can upload game images" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update game images" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete game images" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));
