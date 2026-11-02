-- Migration: CL-00 & Foundation Extensions
-- 1. Evolve classroom_groups to support concurrent independent live sessions per cohort
ALTER TABLE public.classroom_groups
ADD COLUMN IF NOT EXISTS is_session_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS active_room_name text,
ADD COLUMN IF NOT EXISTS active_schedule_id uuid REFERENCES public.class_schedules(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS active_session_id uuid REFERENCES public.classroom_sessions(id) ON DELETE SET NULL;

-- 2. Enhance classroom_sessions with cohort link and session notes
ALTER TABLE public.classroom_sessions
ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.classroom_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes text;

-- 3. Enhance classroom_materials with categories, visibility, acknowledgements, and published date
ALTER TABLE public.classroom_materials
ADD COLUMN IF NOT EXISTS category text DEFAULT 'lecture_notes',
ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'class',
ADD COLUMN IF NOT EXISTS requires_acknowledgement boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS published_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 4. Create class_document_versions for complete document version history
CREATE TABLE IF NOT EXISTS public.class_document_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.classroom_materials(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint DEFAULT 0,
  mime_type text,
  change_note text,
  uploaded_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (document_id, version_number)
);

-- 5. Create class_document_acknowledgements
CREATE TABLE IF NOT EXISTS public.class_document_acknowledgements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.classroom_materials(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  acknowledged_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (document_id, student_id)
);

-- 6. Create classroom_bookmarks for students to save handouts
CREATE TABLE IF NOT EXISTS public.classroom_bookmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.classroom_materials(id) ON DELETE CASCADE,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (student_id, document_id)
);

-- 7. Create classroom_polls for live session interactive questions
CREATE TABLE IF NOT EXISTS public.classroom_polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.classroom_groups(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.classroom_sessions(id) ON DELETE SET NULL,
  creator_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  poll_type text DEFAULT 'multiple_choice',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Create classroom_poll_votes
CREATE TABLE IF NOT EXISTS public.classroom_poll_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL REFERENCES public.classroom_polls(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  selected_option text NOT NULL,
  voted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (poll_id, student_id)
);

-- 9. Create classroom_study_packs for AI-generated study packs
CREATE TABLE IF NOT EXISTS public.classroom_study_packs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.classroom_groups(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  concepts jsonb DEFAULT '[]'::jsonb,
  flashcards jsonb DEFAULT '[]'::jsonb,
  quiz_questions jsonb DEFAULT '[]'::jsonb,
  is_published boolean DEFAULT false,
  created_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON public.class_document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_ack_doc ON public.class_document_acknowledgements(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_ack_student ON public.class_document_acknowledgements(student_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_student ON public.classroom_bookmarks(student_id);
CREATE INDEX IF NOT EXISTS idx_polls_cohort ON public.classroom_polls(cohort_id);
CREATE INDEX IF NOT EXISTS idx_polls_session ON public.classroom_polls(session_id);
CREATE INDEX IF NOT EXISTS idx_study_packs_cohort ON public.classroom_study_packs(cohort_id);

-- Enable RLS
ALTER TABLE public.class_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_document_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_study_packs ENABLE ROW LEVEL SECURITY;

-- Document Versions RLS
DROP POLICY IF EXISTS "Members can view document versions" ON public.class_document_versions;
CREATE POLICY "Members can view document versions" ON public.class_document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classroom_materials m
      WHERE m.id = class_document_versions.document_id
        AND (
          m.company_id IN (
            SELECT company_id FROM public.company_members WHERE profile_id = auth.uid()::text AND status = 'active'
            UNION
            SELECT company_id FROM public.profiles WHERE id = auth.uid()::text
          )
        )
    )
  );

DROP POLICY IF EXISTS "Instructors can insert document versions" ON public.class_document_versions;
CREATE POLICY "Instructors can insert document versions" ON public.class_document_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classroom_materials m
      JOIN public.company_members cm ON cm.company_id = m.company_id
      WHERE m.id = class_document_versions.document_id
        AND cm.profile_id = auth.uid()::text
        AND cm.role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('super_admin', 'instructor')
    )
  );

-- Document Acknowledgements RLS
DROP POLICY IF EXISTS "Students manage their acknowledgements, instructors view" ON public.class_document_acknowledgements;
CREATE POLICY "Students manage their acknowledgements, instructors view" ON public.class_document_acknowledgements
  FOR ALL USING (
    student_id = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = class_document_acknowledgements.company_id
        AND profile_id = auth.uid()::text
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('super_admin', 'instructor')
    )
  );

-- Bookmarks RLS
DROP POLICY IF EXISTS "Users manage their own bookmarks" ON public.classroom_bookmarks;
CREATE POLICY "Users manage their own bookmarks" ON public.classroom_bookmarks
  FOR ALL USING (student_id = auth.uid()::text);

-- Polls RLS
DROP POLICY IF EXISTS "Members can view active polls" ON public.classroom_polls;
CREATE POLICY "Members can view active polls" ON public.classroom_polls
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE profile_id = auth.uid()::text AND status = 'active'
      UNION
      SELECT company_id FROM public.profiles WHERE id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Instructors can manage polls" ON public.classroom_polls;
CREATE POLICY "Instructors can manage polls" ON public.classroom_polls
  FOR ALL USING (
    creator_id = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_polls.company_id
        AND profile_id = auth.uid()::text
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('super_admin', 'instructor')
    )
  );

-- Poll Votes RLS
DROP POLICY IF EXISTS "Students can vote and view votes" ON public.classroom_poll_votes;
CREATE POLICY "Students can vote and view votes" ON public.classroom_poll_votes
  FOR ALL USING (
    student_id = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.classroom_polls p
      JOIN public.company_members cm ON cm.company_id = p.company_id
      WHERE p.id = classroom_poll_votes.poll_id
        AND cm.profile_id = auth.uid()::text
        AND cm.role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('super_admin', 'instructor')
    )
  );

-- Study Packs RLS
DROP POLICY IF EXISTS "Members can view published study packs" ON public.classroom_study_packs;
CREATE POLICY "Members can view published study packs" ON public.classroom_study_packs
  FOR SELECT USING (
    (
      is_published = true AND
      company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid()::text AND status = 'active'
        UNION
        SELECT company_id FROM public.profiles WHERE id = auth.uid()::text
      )
    ) OR
    created_by = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_study_packs.company_id
        AND profile_id = auth.uid()::text
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('super_admin', 'instructor')
    )
  );

DROP POLICY IF EXISTS "Instructors can manage study packs" ON public.classroom_study_packs;
CREATE POLICY "Instructors can manage study packs" ON public.classroom_study_packs
  FOR ALL USING (
    created_by = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_study_packs.company_id
        AND profile_id = auth.uid()::text
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('super_admin', 'instructor')
    )
  );
