-- ============================================================
-- Project Submissions Storage Bucket
-- ============================================================
-- Creates a private storage bucket for learners to upload
-- their mid-course project files (images, ZIPs, PDFs).
-- Access: enrolled users can upload; bucket owner can read.
-- ============================================================

-- Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-submissions',
  'project-submissions',
  false,
  52428800, -- 50 MB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'application/x-rar-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: authenticated users can upload to their own folder
-- Folder convention: project-submissions/{user_id}/{course_id}/{filename}
CREATE POLICY "Learners can upload project submissions"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: users can read their own submissions
CREATE POLICY "Learners can read their own submissions"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: users can delete their own submissions
CREATE POLICY "Learners can delete their own submissions"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: service role (admin) can read all submissions for review
CREATE POLICY "Service role can read all submissions"
  ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'project-submissions');
