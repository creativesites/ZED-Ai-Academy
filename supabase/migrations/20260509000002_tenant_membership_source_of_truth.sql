-- Migration: make company_members the tenant membership source of truth.
-- Clerk user IDs are text, so classroom tables must not reference profiles(id) as uuid.

-- 1. Allow the platform-level teacher role.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'profiles'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%role%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('learner', 'teacher', 'instructor', 'company_admin', 'super_admin'));

-- 2. Tenant-specific role lives on membership.
ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'learner',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'company_members'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%role%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.company_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.company_members
  ADD CONSTRAINT company_members_role_check
  CHECK (role IN ('learner', 'teacher', 'instructor', 'company_admin'));

UPDATE public.company_members cm
SET role = CASE
    WHEN p.role = 'company_admin' THEN 'company_admin'
    WHEN p.role IN ('teacher', 'instructor') THEN 'teacher'
    ELSE 'learner'
  END,
  updated_at = now()
FROM public.profiles p
WHERE p.id = cm.profile_id;

-- 3. Fix classroom table references that were added after the Clerk text ID migration.
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_author_id_fkey;
ALTER TABLE public.class_schedules DROP CONSTRAINT IF EXISTS class_schedules_instructor_id_fkey;
ALTER TABLE public.classroom_group_members DROP CONSTRAINT IF EXISTS classroom_group_members_profile_id_fkey;

ALTER TABLE public.announcements
  ALTER COLUMN author_id TYPE text USING author_id::text;

ALTER TABLE public.class_schedules
  ALTER COLUMN instructor_id TYPE text USING instructor_id::text;

ALTER TABLE public.classroom_group_members
  ALTER COLUMN profile_id TYPE text USING profile_id::text;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.class_schedules
  ADD CONSTRAINT class_schedules_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.classroom_group_members
  ADD CONSTRAINT classroom_group_members_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Enrolling into a tenant course should create tenant membership.
CREATE OR REPLACE FUNCTION public.map_student_to_company()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, profile_id, status, role, joined_at, updated_at)
    VALUES (NEW.company_id, NEW.user_id, 'active', 'learner', now(), now())
    ON CONFLICT (company_id, profile_id) DO UPDATE
      SET status = 'active',
          role = CASE
            WHEN public.company_members.role IN ('company_admin', 'teacher', 'instructor')
              THEN public.company_members.role
            ELSE 'learner'
          END,
          joined_at = COALESCE(public.company_members.joined_at, now()),
          updated_at = now();

    -- Backward-compatible default company only. Permissions should read company_members.
    UPDATE public.profiles
    SET company_id = NEW.company_id
    WHERE id = NEW.user_id AND (company_id IS NULL OR company_id = '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Backfill memberships from existing profile defaults and enrollments.
INSERT INTO public.company_members (company_id, profile_id, status, role, joined_at, updated_at)
SELECT p.company_id,
       p.id,
       'active',
       CASE
         WHEN p.role = 'company_admin' THEN 'company_admin'
         WHEN p.role IN ('teacher', 'instructor') THEN 'teacher'
         ELSE 'learner'
       END,
       now(),
       now()
FROM public.profiles p
WHERE p.company_id IS NOT NULL
ON CONFLICT (company_id, profile_id) DO UPDATE
  SET status = 'active',
      role = EXCLUDED.role,
      joined_at = COALESCE(public.company_members.joined_at, now()),
      updated_at = now();

INSERT INTO public.company_members (company_id, profile_id, status, role, joined_at, updated_at)
SELECT DISTINCT e.company_id, e.user_id, 'active', 'learner', now(), now()
FROM public.enrollments e
WHERE e.company_id IS NOT NULL
ON CONFLICT (company_id, profile_id) DO UPDATE
  SET status = 'active',
      joined_at = COALESCE(public.company_members.joined_at, now()),
      updated_at = now();

CREATE INDEX IF NOT EXISTS company_members_profile_status_idx
  ON public.company_members(profile_id, status);

CREATE INDEX IF NOT EXISTS company_members_company_role_idx
  ON public.company_members(company_id, role, status);
