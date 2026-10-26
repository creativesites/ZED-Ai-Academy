-- Phase 1 of the tenant-first re-architecture.
--  * Zed AI's own courses live in a real tenant ("zedai") instead of company_id = NULL.
--  * company_members is the single source of truth for who belongs where (backfilled).
--  * courses.company_id / enrollments.company_id become NOT NULL.
--  * enrollments.company_id is derived from the course by a trigger, so no writer can forget it.
--  * The shared '0000' teacher code default is removed (an unset code now means "staff sign-up disabled").
-- Idempotent: safe to re-run.

BEGIN;

-- 1. The platform's own tenant. Owned by the existing platform super admin.
--    id is the real Clerk organization created for the platform tenant.
INSERT INTO public.companies (id, name, slug, admin_id)
SELECT 'org_3LE1qkOTLeS7qWI8FiWW4hGHhvr', 'Zed AI Academy', 'zedai', p.id
FROM public.profiles p
WHERE p.id = 'user_3D8zG2D3z98MlEtAJ3Of9zhLn3s'   -- Winston Chikazhe (super_admin)
ON CONFLICT (id) DO NOTHING;

-- 2. Move tenant-less courses into the zedai tenant.
UPDATE public.courses
SET company_id = 'org_3LE1qkOTLeS7qWI8FiWW4hGHhvr'
WHERE company_id IS NULL;

-- 3. Enrollments inherit their course's tenant.
UPDATE public.enrollments e
SET company_id = c.company_id
FROM public.courses c
WHERE e.course_id = c.id
  AND e.company_id IS DISTINCT FROM c.company_id;

-- 4a. Owners are company_admin members of their own tenant (fixes owners recorded as "learner").
INSERT INTO public.company_members (company_id, profile_id, status, role, joined_at, updated_at)
SELECT co.id, co.admin_id, 'active', 'company_admin', now(), now()
FROM public.companies co
WHERE co.admin_id IS NOT NULL
ON CONFLICT (company_id, profile_id)
DO UPDATE SET role = 'company_admin', status = 'active', updated_at = now();

-- 4b. Anyone enrolled in a tenant's course is at least a learner member of that tenant.
INSERT INTO public.company_members (company_id, profile_id, status, role, joined_at, updated_at)
SELECT DISTINCT e.company_id, e.user_id, 'active', 'learner', now(), now()
FROM public.enrollments e
JOIN public.profiles p ON p.id = e.user_id
WHERE e.company_id IS NOT NULL
ON CONFLICT (company_id, profile_id) DO NOTHING;

-- 5. Enforce the invariant.
ALTER TABLE public.courses     ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.enrollments ALTER COLUMN company_id SET NOT NULL;

-- 6. Derive enrollments.company_id from the course on insert (covers hero-enroll, PayChangu webhook, etc.).
CREATE OR REPLACE FUNCTION public.set_enrollment_company_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT company_id INTO NEW.company_id FROM public.courses WHERE id = NEW.course_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_enrollment_company_id ON public.enrollments;
CREATE TRIGGER trg_set_enrollment_company_id
  BEFORE INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_enrollment_company_id();

-- 7. No shared default staff code: NULL = staff sign-up not enabled for that academy.
ALTER TABLE public.companies ALTER COLUMN teacher_code DROP NOT NULL;
ALTER TABLE public.companies ALTER COLUMN teacher_code DROP DEFAULT;
UPDATE public.companies SET teacher_code = NULL WHERE teacher_code = '0000';

COMMIT;
