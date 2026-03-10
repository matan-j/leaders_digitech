
-- Create storage bucket for lesson files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lesson-files', 'lesson-files', true);

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload lesson files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'lesson-files' AND
  auth.role() = 'authenticated'
);

-- Create policy to allow users to view files
CREATE POLICY "Users can view lesson files" ON storage.objects
FOR SELECT USING (bucket_id = 'lesson-files');

-- Create policy to allow users to delete their own files
CREATE POLICY "Users can delete their own lesson files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'lesson-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
