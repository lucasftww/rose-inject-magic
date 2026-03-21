CREATE POLICY "Allow public uploads to game-images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'game-images');

CREATE POLICY "Allow public updates to game-images"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'game-images');