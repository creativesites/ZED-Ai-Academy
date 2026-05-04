-- ============================================================
-- Public media bucket for marketing, blog, and shared site assets
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media-assets',
  'media-assets',
  true,
  8388608,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view media-assets objects" ON storage.objects;
CREATE POLICY "Public can view media-assets objects"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'media-assets');

DROP POLICY IF EXISTS "Service role can manage media-assets objects" ON storage.objects;
CREATE POLICY "Service role can manage media-assets objects"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'media-assets')
  WITH CHECK (bucket_id = 'media-assets');
