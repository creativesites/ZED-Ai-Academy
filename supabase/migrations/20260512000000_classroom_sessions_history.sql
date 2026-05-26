-- Create classroom_sessions table
CREATE TABLE IF NOT EXISTS public.classroom_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.class_schedules(id) ON DELETE SET NULL,
  room_name text NOT NULL,
  started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at timestamp with time zone,
  duration_seconds integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);



ALTER TABLE public.classroom_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage classroom sessions" ON public.classroom_sessions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE profile_id = auth.uid() AND company_id = classroom_sessions.company_id AND role IN ('company_admin', 'teacher')));

CREATE POLICY "Students can view classroom sessions" ON public.classroom_sessions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.company_members WHERE profile_id = auth.uid() AND company_id = classroom_sessions.company_id));

-- Add session_id to student_attendance
ALTER TABLE public.student_attendance
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.classroom_sessions(id) ON DELETE CASCADE;

-- Add active_session_id to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS active_session_id uuid REFERENCES public.classroom_sessions(id) ON DELETE SET NULL;
