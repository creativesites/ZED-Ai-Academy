-- Migration: Classroom Announcements Priority & Assignments Submission and Grading Flow

-- 1. Extend announcements with priority tags, cohort scope, and pinned state
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'notice',
ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.classroom_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- 2. Create classroom_assignments table
CREATE TABLE IF NOT EXISTS public.classroom_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.classroom_groups(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date timestamp with time zone NOT NULL,
  max_points integer DEFAULT 100,
  submission_type text DEFAULT 'file_or_link', -- 'file', 'link', 'file_or_link'
  attachments jsonb DEFAULT '[]'::jsonb,
  rubric jsonb DEFAULT '[]'::jsonb,
  is_published boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create classroom_assignment_submissions table
CREATE TABLE IF NOT EXISTS public.classroom_assignment_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES public.classroom_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  submission_text text,
  file_url text,
  repo_url text,
  file_name text,
  file_size_bytes bigint DEFAULT 0,
  status text DEFAULT 'submitted', -- 'submitted', 'graded', 'late', 'resubmit_requested'
  grade numeric,
  feedback text,
  graded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at timestamp with time zone,
  submitted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (assignment_id, student_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_company ON public.classroom_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_assignments_cohort ON public.classroom_assignments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due ON public.classroom_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON public.classroom_assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON public.classroom_assignment_submissions(assignment_id);

-- Enable RLS
ALTER TABLE public.classroom_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Assignments Policies
DROP POLICY IF EXISTS "Company members can view published assignments" ON public.classroom_assignments;
CREATE POLICY "Company members can view published assignments" ON public.classroom_assignments
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
      WHERE company_id = classroom_assignments.company_id
        AND profile_id = auth.uid()
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );

DROP POLICY IF EXISTS "Instructors and admins can manage assignments" ON public.classroom_assignments;
CREATE POLICY "Instructors and admins can manage assignments" ON public.classroom_assignments
  FOR ALL USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_assignments.company_id
        AND profile_id = auth.uid()
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );

-- Submissions Policies
DROP POLICY IF EXISTS "Students can view and manage their own submissions" ON public.classroom_assignment_submissions;
CREATE POLICY "Students can view and manage their own submissions" ON public.classroom_assignment_submissions
  FOR ALL USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_assignment_submissions.company_id
        AND profile_id = auth.uid()
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );

-- 4. Create classroom_channels table for topic-based discussions
CREATE TABLE IF NOT EXISTS public.classroom_channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.classroom_groups(id) ON DELETE SET NULL,
  name text NOT NULL, -- e.g. 'general', 'homework-help'
  display_name text NOT NULL, -- e.g. 'General Discussion', 'Homework & Projects'
  description text,
  icon text DEFAULT 'hash',
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (company_id, name, cohort_id)
);

-- 5. Create classroom_messages table
CREATE TABLE IF NOT EXISTS public.classroom_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.classroom_channels(id) ON DELETE CASCADE,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_pinned boolean DEFAULT false,
  reply_to_id uuid REFERENCES public.classroom_messages(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes for Chat / Channels
CREATE INDEX IF NOT EXISTS idx_classroom_channels_company ON public.classroom_channels(company_id);
CREATE INDEX IF NOT EXISTS idx_classroom_channels_cohort ON public.classroom_channels(cohort_id);
CREATE INDEX IF NOT EXISTS idx_classroom_messages_channel ON public.classroom_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_classroom_messages_company ON public.classroom_messages(company_id);

-- Enable RLS
ALTER TABLE public.classroom_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_messages ENABLE ROW LEVEL SECURITY;

-- Channels Policies
DROP POLICY IF EXISTS "Members can view channels of their company" ON public.classroom_channels;
CREATE POLICY "Members can view channels of their company" ON public.classroom_channels
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND status = 'active'
      UNION
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Instructors and admins can manage channels" ON public.classroom_channels;
CREATE POLICY "Instructors and admins can manage channels" ON public.classroom_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_channels.company_id
        AND profile_id = auth.uid()
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );

-- Messages Policies
DROP POLICY IF EXISTS "Members can view messages in company channels" ON public.classroom_messages;
CREATE POLICY "Members can view messages in company channels" ON public.classroom_messages
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND status = 'active'
      UNION
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Members can post messages" ON public.classroom_messages;
CREATE POLICY "Members can post messages" ON public.classroom_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    (
      company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND status = 'active'
        UNION
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Users can update or delete their own messages, instructors can moderate" ON public.classroom_messages;
CREATE POLICY "Users can update or delete their own messages, instructors can moderate" ON public.classroom_messages
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = classroom_messages.company_id
        AND profile_id = auth.uid()
        AND role IN ('company_admin', 'teacher')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );

