-- Add teacher_code to companies for simple staff onboarding
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS teacher_code text NOT NULL DEFAULT '0000';

-- Update the join function to handle teacher code validation (optional but good for future)
COMMENT ON COLUMN public.companies.teacher_code IS '4-digit code required for teachers to join this academy during signup.';
