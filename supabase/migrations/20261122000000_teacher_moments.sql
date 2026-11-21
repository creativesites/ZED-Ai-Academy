-- ============================================================
-- ZAI Teacher Phase 1: teacher_moments
--
-- Allows a lesson to hold several short AI teacher moments placed at
-- chosen positions (e.g. after a video block or before a quiz block)
-- instead of only a single block at the end.
--
-- Conventions:
--  * Clerk user ids and companies.id are text. Never uuid.
--  * Current user is (auth.jwt() ->> 'sub'), never auth.uid().
--  * Tenant staff check uses public.is_company_staff(company_id).
--
-- NOT APPLIED. This file is written for review and owner apply.
-- Idempotent: safe to re-run.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.teacher_moments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id       uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id       uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  scenario_id     uuid NOT NULL REFERENCES public.practice_scenarios(id) ON DELETE CASCADE,
  after_block_id  uuid REFERENCES public.content_blocks(id) ON DELETE SET NULL,
  position        int NOT NULL DEFAULT 1,
  title           text,
  prompt          text,
  required        boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'published',
  created_by      text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_moments_position_check
    CHECK (position >= 0),
  CONSTRAINT teacher_moments_status_check
    CHECK (status IN ('draft', 'published', 'archived'))
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS teacher_moments_lesson_position_idx
  ON public.teacher_moments(lesson_id, position);

CREATE INDEX IF NOT EXISTS teacher_moments_course_idx
  ON public.teacher_moments(course_id);

CREATE INDEX IF NOT EXISTS teacher_moments_scenario_idx
  ON public.teacher_moments(scenario_id);

CREATE INDEX IF NOT EXISTS teacher_moments_company_status_idx
  ON public.teacher_moments(company_id, status);

CREATE INDEX IF NOT EXISTS teacher_moments_after_block_idx
  ON public.teacher_moments(after_block_id) WHERE after_block_id IS NOT NULL;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS set_teacher_moments_updated_at ON public.teacher_moments;
CREATE TRIGGER set_teacher_moments_updated_at
  BEFORE UPDATE ON public.teacher_moments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.teacher_moments ENABLE ROW LEVEL SECURITY;

-- Tenant staff manage (read, insert, update, delete) teacher moments in their tenant.
-- Verifies the lesson belongs to the course and the course belongs to the tenant.
DROP POLICY IF EXISTS "Tenant staff manage teacher moments" ON public.teacher_moments;
CREATE POLICY "Tenant staff manage teacher moments"
  ON public.teacher_moments FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (
    public.is_company_staff(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
      WHERE l.id = teacher_moments.lesson_id
        AND c.id = teacher_moments.course_id
        AND c.company_id = teacher_moments.company_id
    )
    AND (
      after_block_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.content_blocks cb
        WHERE cb.id = teacher_moments.after_block_id
          AND cb.lesson_id = teacher_moments.lesson_id
      )
    )
  );

-- Enrolled learners (and viewers of free-preview lessons) read published teacher moments
-- for published courses.
DROP POLICY IF EXISTS "Enrolled learners read published teacher moments" ON public.teacher_moments;
CREATE POLICY "Enrolled learners read published teacher moments"
  ON public.teacher_moments FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = teacher_moments.course_id
        AND c.status = 'published'
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.enrollments e
        WHERE e.course_id = teacher_moments.course_id
          AND e.user_id = (auth.jwt() ->> 'sub')
          AND e.status = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.lessons l
        WHERE l.id = teacher_moments.lesson_id
          AND l.is_preview = true
      )
    )
  );

COMMIT;
