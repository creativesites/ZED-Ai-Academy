-- Add 'manual_admin' to EnrollmentSource check constraint
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_source_check;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_source_check 
  CHECK (source IN ('individual_purchase', 'subscription', 'company_seat', 'gift', 'manual_admin'));
