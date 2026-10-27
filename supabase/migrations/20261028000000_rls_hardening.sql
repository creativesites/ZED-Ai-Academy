-- =============================================================================
-- RLS hardening (fixes CRITICAL and HIGH findings of the RLS audit).
--
-- Source: RLS_AUDIT.md (finding IDs below refer to it).
-- Model: the server uses the service role (bypasses RLS). RLS matters for direct
-- PostgREST calls made with the publishable key (role anon) or a Clerk JWT
-- (role authenticated, sub = Clerk user id). Current user = (auth.jwt() ->> 'sub').
--
-- Idempotent: every DROP uses IF EXISTS, every CREATE POLICY is preceded by a DROP,
-- every function is CREATE OR REPLACE. Safe to re-run.
--
-- NOT APPLIED to any database. Verified on a local Postgres 16 harness only.
-- Run docs/SECURITY_RLS.md "Before applying" first.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Helpers
-- SECURITY DEFINER so policy checks on company_members do not recurse through
-- company_members' own RLS (H7). Both read the JWT sub, never a client-supplied id.
-- -----------------------------------------------------------------------------

-- Used by H7 (company_members admin policy).
CREATE OR REPLACE FUNCTION public.is_tenant_role(p_company_id text, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = p_company_id
      AND m.profile_id = (auth.jwt() ->> 'sub')
      AND m.status = 'active'
      AND m.role = ANY (p_roles)
  );
$$;

-- Used by H6 (courses write policies). Definition must stay byte-identical to the
-- ZAI Tutor migration that CREATE OR REPLACEs it later.
CREATE OR REPLACE FUNCTION public.is_company_staff(p_company_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    JOIN public.companies co ON co.id = cm.company_id
    WHERE cm.company_id = p_company_id
      AND cm.profile_id = (auth.jwt() ->> 'sub')
      AND cm.status = 'active'
      AND cm.role IN ('company_admin', 'teacher', 'instructor')
      AND co.status = 'active'
  );
$$;

-- Public certificate verification (H4). Returns only the fields the public page
-- src/app/(marketing)/certificates/[publicId]/page.tsx shows. No user_id, no
-- other certificates, no write access.
CREATE OR REPLACE FUNCTION public.verify_certificate(p_public_id text)
RETURNS TABLE (
  public_id         text,
  issued_at         timestamptz,
  file_url          text,
  course_id         uuid,
  course_title      text,
  course_slug       text,
  learner_name      text,
  learner_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.public_id, c.issued_at, c.file_url,
         co.id, co.title, co.slug,
         p.full_name, p.avatar_url
  FROM public.certificates c
  LEFT JOIN public.courses  co ON co.id = c.course_id
  LEFT JOIN public.profiles p  ON p.id  = c.user_id
  WHERE c.public_id = p_public_id;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- C1  profiles: users may edit only safe columns of their own row.
-- Role, company_id, email, onboarding_completed and id stay server-owned.
-- Server code writes profiles with the service role (ensure-profile, webhooks,
-- onboarding), so no client write path is lost.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (id = (auth.jwt() ->> 'sub'))
  WITH CHECK (id = (auth.jwt() ->> 'sub'));

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, bio) ON public.profiles TO authenticated;

-- -----------------------------------------------------------------------------
-- H1  profiles: the PUBLIC "WITH CHECK (true)" insert policy opened inserts to
-- anon and authenticated. Service role bypasses RLS, so it is not needed.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can upsert profiles" ON public.profiles;

-- -----------------------------------------------------------------------------
-- H2  profiles: the public instructor read exposed every instructor's email and
-- other columns to anon. No in-app code reads profiles through the browser client.
-- Fix chosen: drop the policy (the report's alternative is a view; see
-- docs/SECURITY_RLS.md). The owner SELECT policy "Users can view own profile" is unchanged.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are publicly readable for instructors" ON public.profiles;

-- -----------------------------------------------------------------------------
-- C2  enrollments: enrollment is created and changed server-side (service role:
-- checkout webhooks, admin actions). Self-insert/update allowed a paywall bypass.
-- The learner's own SELECT policy is kept.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own enrollment" ON public.enrollments;
DROP POLICY IF EXISTS "Users can insert own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can enroll themselves" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update own enrollment" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update own enrollments" ON public.enrollments;

REVOKE INSERT, UPDATE ON public.enrollments FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- C3  companies: public tenant resolution stays possible, but secrets are hidden.
-- teacher_code (staff join secret), admin_id, suspended_reason and suspended_at
-- are NOT granted to anon or authenticated. Column grants: the browser client
-- (LiveSessionTab realtime on companies UPDATE) needs is_session_active,
-- active_room_name, active_schedule_id, active_session_id plus id. The rest of the
-- list is the audit's proposal for public branding and tenant resolution.
-- The policy stays USING (true); column privileges do the hiding.
-- The duplicate "Anyone can view active session" policy is dropped.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view active session" ON public.companies;

REVOKE SELECT ON public.companies FROM anon, authenticated;
GRANT SELECT (
  id,
  name,
  slug,
  logo_url,
  primary_color,
  home_template,
  home_content,
  status,
  is_session_active,
  active_schedule_id,
  active_session_id,
  active_room_name
) ON public.companies TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- H3  user_platforms: "FOR ALL USING (true)" with no TO clause applied to PUBLIC,
-- so anon and authenticated could read and change any user's platform rows.
-- Writes are done by the service role (onboarding action). No replacement needed.
-- The owner SELECT policy "Users can read own platforms" is kept.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage platforms" ON public.user_platforms;

-- -----------------------------------------------------------------------------
-- M1  notifications: "WITH CHECK (true)" insert let anon spoof in-app notifications.
-- Writers are the service role. The owner SELECT and mark-read policies are kept.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- -----------------------------------------------------------------------------
-- H4  certificates: public USING (true) SELECT let anon enumerate every holder and
-- file. Forged inserts and updates let users issue or repoint certificates.
-- Public verification goes through public.verify_certificate() above.
-- Owner SELECT is kept (recreated here so the definition is known).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Certificates are publicly viewable by public_id" ON public.certificates;
DROP POLICY IF EXISTS "Users can insert own certificate" ON public.certificates;
DROP POLICY IF EXISTS "Users can insert own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can update own certificate" ON public.certificates;
DROP POLICY IF EXISTS "Users can update own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can view own certificates" ON public.certificates;

CREATE POLICY "Users can view own certificates" ON public.certificates
  FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

REVOKE INSERT, UPDATE ON public.certificates FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- H5  orders: users could insert paid orders with any amount, paid_at or course.
-- Orders are written by checkout and the PayChangu webhook (service role).
-- The owner SELECT policy is kept.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;

REVOKE INSERT, UPDATE ON public.orders FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- H6  courses: any signed-in user could create or update courses in any tenant
-- (company_id was unchecked, and UPDATE had no WITH CHECK). Writes now require
-- the user to be active tenant staff of the course's company, and the instructor
-- to be the user. WITH CHECK stops a course from being moved to another tenant
-- or reassigned to another instructor.
-- "Company members can manage courses" (20260507000000) is ALL for any member
-- role and cannot exist as written (auth.uid()::text()). Dropped if present.
-- The public SELECT and the instructor DELETE policies are unchanged.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Company members can manage courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can create courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can update own courses" ON public.courses;
DROP POLICY IF EXISTS "Tenant staff can create own courses" ON public.courses;
DROP POLICY IF EXISTS "Tenant staff can update own courses" ON public.courses;

CREATE POLICY "Tenant staff can create own courses" ON public.courses
  FOR INSERT
  WITH CHECK (
    instructor_id = (auth.jwt() ->> 'sub')
    AND public.is_company_staff(company_id)
  );

CREATE POLICY "Tenant staff can update own courses" ON public.courses
  FOR UPDATE
  USING (
    instructor_id = (auth.jwt() ->> 'sub')
    AND public.is_company_staff(company_id)
  )
  WITH CHECK (
    instructor_id = (auth.jwt() ->> 'sub')
    AND public.is_company_staff(company_id)
  );

-- -----------------------------------------------------------------------------
-- H7  company_members: the admin policy recursed through company_members, checked
-- the invalid role 'admin', and broke every user-scoped read of company_members.
-- Replaced with the SECURITY DEFINER helper. Only company_admin manages members.
-- The own-membership SELECT policy is kept.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Company admins can manage members" ON public.company_members;

CREATE POLICY "Company admins can manage members" ON public.company_members
  FOR ALL
  USING (public.is_tenant_role(company_id, ARRAY['company_admin']))
  WITH CHECK (public.is_tenant_role(company_id, ARRAY['company_admin']));

-- -----------------------------------------------------------------------------
-- H8  NOT FIXED HERE. Classroom tables (announcements, class_schedules,
-- classroom_groups, classroom_group_members, classroom_sessions, student_attendance)
-- cannot be created from the migration history (RLS_AUDIT.md section 1), so their
-- live state is unknown. Fixing them needs the live schema (section 6 queries).
-- See docs/SECURITY_RLS.md "Not fixed in this migration".
-- -----------------------------------------------------------------------------

COMMIT;
