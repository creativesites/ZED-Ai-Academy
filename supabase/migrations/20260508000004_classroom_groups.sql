-- Migration: Classroom Groups and Timetable Refinement

-- 1. Create classroom_groups table
CREATE TABLE IF NOT EXISTS public.classroom_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Link students to groups
CREATE TABLE IF NOT EXISTS public.classroom_group_members (
  group_id uuid REFERENCES public.classroom_groups(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, profile_id)
);

-- 3. Update class_schedules to link to groups or individual students
-- Link schedule to a specific group (optional)
ALTER TABLE public.class_schedules
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.classroom_groups(id) ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE public.classroom_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_group_members ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Company members can view groups" ON public.classroom_groups
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage groups" ON public.classroom_groups
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')));

-- Same for members
CREATE POLICY "Company members can view group members" ON public.classroom_group_members
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.classroom_groups g WHERE g.id = group_id AND g.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())));
