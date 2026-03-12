
-- Create private bucket for ticket files
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-files', 'ticket-files', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own ticket folders
CREATE POLICY "Users upload own ticket files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read their own ticket files
CREATE POLICY "Users read own ticket files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read all ticket files
CREATE POLICY "Admins read all ticket files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Admins can upload ticket files
CREATE POLICY "Admins upload ticket files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Admins can delete ticket files
CREATE POLICY "Admins delete ticket files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ticket-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
