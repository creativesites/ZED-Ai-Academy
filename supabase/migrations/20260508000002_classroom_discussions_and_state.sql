-- Migration: Add classroom-wide columns and discussions company support

-- 1. Add company_id to discussions to support classroom-level chat
ALTER TABLE public.discussions
ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.companies(id) ON DELETE CASCADE;

-- Add index for classroom discussions
CREATE INDEX IF NOT EXISTS idx_discussions_company_id ON public.discussions(company_id);

-- Update RLS for discussions to allow company members to view classroom discussions
DROP POLICY IF EXISTS "Anyone can view public discussions" ON public.discussions;
CREATE POLICY "Anyone can view public discussions" ON public.discussions
  FOR SELECT USING (
    is_public = true OR 
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.courses c 
      WHERE c.id = discussions.course_id AND c.instructor_id = auth.uid()
    ) OR
    (company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = discussions.company_id AND cm.profile_id = auth.uid()
    ))
  );

-- 2. Add is_session_active to companies for a simple toggle
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS is_session_active boolean DEFAULT false;

-- 3. Fix class_schedules columns to match standard naming (starts_at/ends_at vs start_time/end_time)
-- We check if they exist first to avoid errors if they are already named correctly
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='class_schedules' AND column_name='start_time') THEN
    ALTER TABLE public.class_schedules RENAME COLUMN start_time TO starts_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='class_schedules' AND column_name='end_time') THEN
    ALTER TABLE public.class_schedules RENAME COLUMN end_time TO ends_at;
  END IF;
END $$;

-- 4. Add schedule_type to class_schedules
ALTER TABLE public.class_schedules
ADD COLUMN IF NOT EXISTS schedule_type text DEFAULT 'live_session';
