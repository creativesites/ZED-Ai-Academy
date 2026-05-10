-- Add active_schedule_id to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS active_schedule_id uuid REFERENCES public.class_schedules(id) ON DELETE SET NULL;

-- Create attendance table
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present',
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(schedule_id, profile_id, date)
);

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage attendance" ON public.student_attendance
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE profile_id = auth.uid() AND company_id = student_attendance.company_id AND role IN ('company_admin', 'teacher')));

CREATE POLICY "Students can view own attendance" ON public.student_attendance
  FOR SELECT USING (profile_id = auth.uid());
