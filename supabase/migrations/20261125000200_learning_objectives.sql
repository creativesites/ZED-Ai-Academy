-- ============================================================
-- AI Teacher Phase 2 (P2-01): objective registry
--
-- learning_objectives      the per-course registry that replaces free-text objective keys
-- objective_prerequisites  "objective X requires objective Y" (same course/tenant)
-- scenario_objectives      which registered objectives an AI teacher flow teaches
--
-- Architecture §4.1. Tenant-scoped: company_id is the course's tenant (courses.company_id, or the
-- platform tenant when that is null). Server code writes with the service role and authorises in app
-- code (assertCanManageCourse); RLS below is defence in depth for any direct client access.
--
-- Conventions:
--  * Clerk user ids and companies.id are text. Never uuid.
--  * Current user is (auth.jwt() ->> 'sub'), never auth.uid().
--  * Tenant staff check uses public.is_company_staff(company_id).
--
-- NOT APPLIED. Written for review and owner apply. Additive and idempotent: safe to re-run.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.learning_objectives (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id         uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  -- Stable, human-readable code, unique per course (e.g. "L3.O2").
  code              text NOT NULL,
  text              text NOT NULL,
  evidence_criteria text,
  level             text,
  locale            text,
  status            text NOT NULL DEFAULT 'active',
  source            text NOT NULL DEFAULT 'extracted',
  created_by        text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_objectives_code_check CHECK (char_length(code) BETWEEN 1 AND 32),
  CONSTRAINT learning_objectives_text_check CHECK (char_length(btrim(text)) BETWEEN 1 AND 500),
  CONSTRAINT learning_objectives_evidence_check CHECK (evidence_criteria IS NULL OR char_length(evidence_criteria) <= 600),
  CONSTRAINT learning_objectives_level_check
    CHECK (level IS NULL OR level IN ('remember', 'understand', 'apply', 'analyse')),
  CONSTRAINT learning_objectives_status_check CHECK (status IN ('draft', 'active', 'retired')),
  CONSTRAINT learning_objectives_source_check CHECK (source IN ('authored', 'extracted', 'legacy')),
  CONSTRAINT learning_objectives_course_code_key UNIQUE (course_id, code)
);

COMMENT ON TABLE public.learning_objectives IS
  'Registry of measurable learning objectives per course (AI Teacher P2-01). Evidence and mastery reference these ids instead of free text.';

CREATE INDEX IF NOT EXISTS learning_objectives_company_course_idx
  ON public.learning_objectives (company_id, course_id, status);
CREATE INDEX IF NOT EXISTS learning_objectives_lesson_idx
  ON public.learning_objectives (lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS learning_objectives_created_by_idx
  ON public.learning_objectives (created_by) WHERE created_by IS NOT NULL;

DROP TRIGGER IF EXISTS set_learning_objectives_updated_at ON public.learning_objectives;
CREATE TRIGGER set_learning_objectives_updated_at
  BEFORE UPDATE ON public.learning_objectives
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.objective_prerequisites (
  objective_id uuid NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  requires_id  uuid NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  company_id   text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by   text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, requires_id),
  CONSTRAINT objective_prerequisites_no_self CHECK (objective_id <> requires_id)
);

COMMENT ON TABLE public.objective_prerequisites IS
  'Objective dependency graph (human-confirmed). objective_id requires requires_id.';

CREATE INDEX IF NOT EXISTS objective_prerequisites_requires_idx
  ON public.objective_prerequisites (requires_id);
CREATE INDEX IF NOT EXISTS objective_prerequisites_company_idx
  ON public.objective_prerequisites (company_id);

CREATE TABLE IF NOT EXISTS public.scenario_objectives (
  scenario_id  uuid NOT NULL REFERENCES public.practice_scenarios(id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  company_id   text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  weight       numeric NOT NULL DEFAULT 1,
  position     smallint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, objective_id),
  CONSTRAINT scenario_objectives_weight_check CHECK (weight > 0 AND weight <= 10)
);

COMMENT ON TABLE public.scenario_objectives IS
  'Which registered objectives an AI teacher flow (practice_scenarios row) teaches.';

CREATE INDEX IF NOT EXISTS scenario_objectives_objective_idx
  ON public.scenario_objectives (objective_id);
CREATE INDEX IF NOT EXISTS scenario_objectives_company_idx
  ON public.scenario_objectives (company_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_objectives ENABLE ROW LEVEL SECURITY;

-- Tenant staff manage objectives of courses in their tenant.
DROP POLICY IF EXISTS "Tenant staff manage learning objectives" ON public.learning_objectives;
CREATE POLICY "Tenant staff manage learning objectives"
  ON public.learning_objectives FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (
    public.is_company_staff(company_id)
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = learning_objectives.course_id
        AND coalesce(c.company_id, learning_objectives.company_id) = learning_objectives.company_id
    )
  );

-- Enrolled learners read the active objectives of their courses (what "What my teacher knows" shows).
DROP POLICY IF EXISTS "Enrolled learners read active objectives" ON public.learning_objectives;
CREATE POLICY "Enrolled learners read active objectives"
  ON public.learning_objectives FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = learning_objectives.course_id
        AND e.user_id = (SELECT auth.jwt() ->> 'sub')
        AND e.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Tenant staff manage objective prerequisites" ON public.objective_prerequisites;
CREATE POLICY "Tenant staff manage objective prerequisites"
  ON public.objective_prerequisites FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (
    public.is_company_staff(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.learning_objectives a
      JOIN public.learning_objectives b ON b.id = objective_prerequisites.requires_id
      WHERE a.id = objective_prerequisites.objective_id
        AND a.company_id = objective_prerequisites.company_id
        AND b.company_id = objective_prerequisites.company_id
    )
  );

DROP POLICY IF EXISTS "Tenant staff manage scenario objectives" ON public.scenario_objectives;
CREATE POLICY "Tenant staff manage scenario objectives"
  ON public.scenario_objectives FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (
    public.is_company_staff(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.learning_objectives o
      JOIN public.practice_scenarios s ON s.id = scenario_objectives.scenario_id
      WHERE o.id = scenario_objectives.objective_id
        AND o.company_id = scenario_objectives.company_id
        AND s.company_id = scenario_objectives.company_id
    )
  );

COMMIT;
