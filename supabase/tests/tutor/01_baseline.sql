-- Minimal baseline matching the id types the repo's migrations intend for production
-- (Clerk ids are text; companies.id is text; courses/lessons ids are uuid).
-- Only the tables that 20261101000000_zai_tutor.sql references are included.

CREATE TABLE public.profiles (
  id          text PRIMARY KEY,
  role        text NOT NULL DEFAULT 'learner',
  company_id  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.companies (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  admin_id    text REFERENCES public.profiles(id),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id  text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'deactivated')),
  role        text NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'teacher', 'instructor', 'company_admin')),
  invited_at  timestamptz NOT NULL DEFAULT now(),
  joined_at   timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, profile_id)
);

CREATE TABLE public.courses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  instructor_id text REFERENCES public.profiles(id),
  slug         text UNIQUE NOT NULL,
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title       text NOT NULL,
  position    int NOT NULL
);

CREATE TABLE public.lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title       text NOT NULL,
  position    int NOT NULL
);

CREATE TABLE public.enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  company_id  text REFERENCES public.companies(id) ON DELETE CASCADE,
  UNIQUE (user_id, course_id)
);

CREATE TABLE public.classroom_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL
);

CREATE TABLE public.classroom_group_members (
  group_id    uuid REFERENCES public.classroom_groups(id) ON DELETE CASCADE,
  profile_id  text REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, profile_id)
);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Supabase grants table access to these roles by default; mirror that for tables created later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
