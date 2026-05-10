-- Migration: Add company_id to courses and enrollments to support multi-tenancy (Clerk Organizations)

-- 1. Add company_id to courses
ALTER TABLE public.courses
ADD COLUMN company_id text REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Add company_id to enrollments
ALTER TABLE public.enrollments
ADD COLUMN company_id text REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. Update Course RLS Policies to allow company admins/instructors to manage them
-- Drop old instructor policies
DROP POLICY IF EXISTS "Instructors can manage own courses" ON public.courses;

-- Add new policy: users who are part of the company and have a non-learner status can manage the courses
-- Wait, we just check if auth.uid() is the admin_id of the company, or if they are in company_members
CREATE POLICY "Company members can manage courses" ON public.courses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = courses.company_id 
      AND cm.profile_id = auth.uid()::text()
      AND cm.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = courses.company_id
      AND c.admin_id = auth.uid()::text()
    )
    OR instructor_id = auth.uid()::text() -- fallback for legacy courses
  );

-- 4. Update Enrollment policies
-- Allow company admins to see enrollments for their company
CREATE POLICY "Company admins can view enrollments" ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = enrollments.company_id
      AND c.admin_id = auth.uid()::text()
    )
  );

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_courses_company_id ON public.courses(company_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_company_id ON public.enrollments(company_id);
