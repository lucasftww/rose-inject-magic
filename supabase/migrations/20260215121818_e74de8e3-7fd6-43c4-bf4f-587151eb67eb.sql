-- Create storage bucket for game images
INSERT INTO storage.buckets (id, name, public) VALUES ('game-images', 'game-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view game images
CREATE POLICY "Game images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-images');

-- Allow authenticated admins to upload game images
CREATE POLICY "Admins can upload game images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));

-- Allow authenticated admins to update game images
CREATE POLICY "Admins can update game images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));

-- Allow authenticated admins to delete game images
CREATE POLICY "Admins can delete game images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));