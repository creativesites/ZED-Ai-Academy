-- Migration: Recurring Timetable and Active Session State

-- 1. Add active session fields to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS active_session_id text,
ADD COLUMN IF NOT EXISTS active_room_name text;

-- 2. Update class_schedules to support recurring weekly entries
ALTER TABLE public.class_schedules
ADD COLUMN IF NOT EXISTS day_of_week int, -- 0 = Sunday, 1 = Monday, etc.
ADD COLUMN IF NOT EXISTS start_time_only time, -- Just the time part (e.g. 18:00:00)
ADD COLUMN IF NOT EXISTS end_time_only time,
ADD COLUMN IF NOT EXISTS topics_covered text,
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT true;

-- 3. Ensure discussions has company_id (redundant check)
ALTER TABLE public.discussions
ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.companies(id) ON DELETE CASCADE;

-- 4. RLS for new columns (usually handled by table-level RLS, but verifying)
DROP POLICY IF EXISTS "Anyone can view active session" ON public.companies;
CREATE POLICY "Anyone can view active session" ON public.companies FOR SELECT USING (true);
