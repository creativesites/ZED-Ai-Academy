-- Create announcements table
CREATE TABLE public.announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Announcements Policies
-- Anyone in the company can read announcements
CREATE POLICY "Company members can view announcements" ON public.announcements
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE profile_id = auth.uid()
      UNION
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only admins and instructors can create announcements
CREATE POLICY "Company admins and instructors can insert announcements" ON public.announcements
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE admin_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('instructor', 'super_admin')
    )
  );

-- Only author or super admin can update
CREATE POLICY "Author or super admin can update announcements" ON public.announcements
  FOR UPDATE USING (
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Only author or super admin can delete
CREATE POLICY "Author or super admin can delete announcements" ON public.announcements
  FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );


-- Create class_schedules table (Timetable)
CREATE TABLE public.class_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  instructor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for class_schedules
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

-- Class Schedules Policies
-- Anyone in the company can read schedules
CREATE POLICY "Company members can view class schedules" ON public.class_schedules
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE profile_id = auth.uid()
      UNION
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only admins and instructors can create schedules
CREATE POLICY "Company admins and instructors can insert class schedules" ON public.class_schedules
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE admin_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('instructor', 'super_admin')
    )
  );

-- Only admins and instructors can update schedules
CREATE POLICY "Company admins and instructors can update class schedules" ON public.class_schedules
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM public.companies WHERE admin_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('instructor', 'super_admin')
    )
  );

-- Only admins and instructors can delete schedules
CREATE POLICY "Company admins and instructors can delete class schedules" ON public.class_schedules
  FOR DELETE USING (
    company_id IN (
      SELECT id FROM public.companies WHERE admin_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('instructor', 'super_admin')
    )
  );
