-- Replace the guessable default staff code ('0000') with a random 6-digit code
-- per academy. Academy admins can see their code in Admin → Settings.

CREATE OR REPLACE FUNCTION public.generate_teacher_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT lpad((floor(random() * 1000000))::int::text, 6, '0');
$$;

ALTER TABLE public.companies
  ALTER COLUMN teacher_code SET DEFAULT public.generate_teacher_code();

UPDATE public.companies
SET teacher_code = public.generate_teacher_code()
WHERE teacher_code IS NULL OR teacher_code = '0000';

COMMENT ON COLUMN public.companies.teacher_code IS
  'Random staff access code required for teachers to join this academy during signup.';
