-- Migration: Tenant Customization and Automatic Student Mapping

-- 1. Add home_template to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS home_template text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS home_content jsonb DEFAULT '{}'::jsonb;

-- 2. Trigger to automatically map students to companies on enrollment
-- If a student enrolls in a course belonging to a company, ensure the profile is linked to that company
CREATE OR REPLACE FUNCTION public.map_student_to_company()
RETURNS TRIGGER AS $$
BEGIN
  -- If the enrollment has a company_id, update the user's profile to that company_id if they don't have one
  IF NEW.company_id IS NOT NULL THEN
    UPDATE public.profiles
    SET company_id = NEW.company_id
    WHERE id = NEW.user_id AND (company_id IS NULL OR company_id = '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_map_student_to_company ON public.enrollments;
CREATE TRIGGER tr_map_student_to_company
AFTER INSERT ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.map_student_to_company();

-- 3. Backfill existing enrollments
UPDATE public.profiles p
SET company_id = e.company_id
FROM public.enrollments e
WHERE p.id = e.user_id 
AND e.company_id IS NOT NULL 
AND (p.company_id IS NULL OR p.company_id = '');
