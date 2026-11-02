-- Migration: Classroom Cohorts Evolution, Folders & Learning Materials Management System

-- 1. Evolve classroom_groups into full Cohorts / Sections
ALTER TABLE public.classroom_groups
ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS academic_period text,
ADD COLUMN IF NOT EXISTS primary_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS color text DEFAULT '#fd5523';

-- 2. Create classroom_folders table
CREATE TABLE IF NOT EXISTS public.classroom_folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.classroom_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#fd5523',
  icon text DEFAULT 'folder',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create classroom_materials table
CREATE TABLE IF NOT EXISTS public.classroom_materials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.classroom_folders(id) ON DELETE SET NULL,
  cohort_id uuid REFERENCES public.classroom_groups(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  material_type text NOT NULL DEFAULT 'document',
  file_url text,
  file_size_bytes bigint DEFAULT 0,
  tags text[] DEFAULT '{}'::text[],
  is_pinned boolean DEFAULT false,
  is_published boolean DEFAULT true,
  download_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_classroom_folders_company ON public.classroom_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_classroom_folders_cohort ON public.classroom_folders(cohort_id);
CREATE INDEX IF NOT EXISTS idx_classroom_materials_company ON public.classroom_materials(company_id);
CREATE INDEX IF NOT EXISTS idx_classroom_materials_folder ON public.classroom_materials(folder_id);
CREATE INDEX IF NOT EXISTS idx_classroom_materials_cohort ON public.classroom_materials(cohort_id);
CREATE INDEX IF NOT EXISTS idx_classroom_materials_pinned ON public.classroom_materials(is_pinned);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.classroom_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_materials ENABLE ROW LEVEL SECURITY;

-- 5. Folders Policies
DROP POLICY IF EXISTS "Company members can view classroom folders" ON public.classroom_folders;
CREATE POLICY "Company members can view classroom folders" ON public.classroom_folders
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND status = 'active'
      UNION
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors and admins can manage classroom folders" ON public.classroom_folders;
CREATE POLICY "Instructors and admins can manage classroom folders" ON public.classroom_folders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_folders.company_id
        AND profile_id = auth.uid()
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );

-- 6. Materials Policies
DROP POLICY IF EXISTS "Company members can view published classroom materials" ON public.classroom_materials;
CREATE POLICY "Company members can view published classroom materials" ON public.classroom_materials
  FOR SELECT USING (
    (
      is_published = true AND
      company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND status = 'active'
        UNION
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    ) OR
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_materials.company_id
        AND profile_id = auth.uid()
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );

DROP POLICY IF EXISTS "Instructors and admins can manage classroom materials" ON public.classroom_materials;
CREATE POLICY "Instructors and admins can manage classroom materials" ON public.classroom_materials
  FOR ALL USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_materials.company_id
        AND profile_id = auth.uid()
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );

-- 7. Storage Bucket for classroom materials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'classroom-materials',
  'classroom-materials',
  true,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view classroom-materials objects" ON storage.objects;
CREATE POLICY "Public can view classroom-materials objects"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'classroom-materials');

DROP POLICY IF EXISTS "Service role can manage classroom-materials objects" ON storage.objects;
CREATE POLICY "Service role can manage classroom-materials objects"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'classroom-materials')
  WITH CHECK (bucket_id = 'classroom-materials');
