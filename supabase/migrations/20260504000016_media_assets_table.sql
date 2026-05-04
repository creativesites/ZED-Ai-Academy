-- ============================================================
-- Media asset library for marketing pages, blog posts, and shared uploads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.media_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket        text NOT NULL DEFAULT 'media-assets',
  path          text NOT NULL,
  public_url    text NOT NULL,
  file_name     text NOT NULL,
  original_name text NOT NULL,
  alt_text      text,
  caption       text,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes >= 0),
  width         integer,
  height        integer,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_bucket_path_unique UNIQUE (bucket, path),
  CONSTRAINT media_assets_public_url_unique UNIQUE (public_url)
);

CREATE INDEX IF NOT EXISTS media_assets_created_at_idx
  ON public.media_assets (created_at DESC);

CREATE INDEX IF NOT EXISTS media_assets_created_by_idx
  ON public.media_assets (created_by);

CREATE INDEX IF NOT EXISTS media_assets_file_name_idx
  ON public.media_assets (file_name);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Instructors can read media assets" ON public.media_assets;
CREATE POLICY "Admins and Instructors can read media assets"
  ON public.media_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'instructor')
    )
  );

DROP POLICY IF EXISTS "Admins and Instructors can manage media assets" ON public.media_assets;
CREATE POLICY "Admins and Instructors can manage media assets"
  ON public.media_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'instructor')
    )
  );
