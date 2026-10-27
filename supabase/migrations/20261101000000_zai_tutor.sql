-- ============================================================
-- ZAI Tutor: personas, practice scenarios, tutor sessions,
-- language learner profiles, SRS vocabulary, exam frameworks,
-- tenant tutor settings and AI usage ledger.
--
-- Conventions (see 20260504000018 and 20260526000000):
--  * Clerk user ids and companies.id are text. Never uuid.
--  * Current user is (auth.jwt() ->> 'sub'), never auth.uid().
--  * company_members is the membership source of truth.
--    role in ('learner','teacher','instructor','company_admin'); staff = the last three minus learner.
--    status in ('invited','active','deactivated'); only 'active' counts.
--  * Server writes use the service role (bypasses RLS). Clients get no write
--    policy on ai_usage_ledger or exam_frameworks, and no write policy on reports.
--
-- NOT APPLIED. This file is written for review only.
-- Idempotent: safe to re-run.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Exam frameworks (global reference data, seeded below).
CREATE TABLE IF NOT EXISTS public.exam_frameworks (
  id              text PRIMARY KEY,
  language        text NOT NULL,
  label           text NOT NULL,
  levels          jsonb NOT NULL DEFAULT '[]'::jsonb,
  speaking_tasks  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Teacher characters (Rive variant, voice, personality). Tenant scoped.
CREATE TABLE IF NOT EXISTS public.ai_personas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name                text NOT NULL,
  display_name        text,
  languages           text[] NOT NULL DEFAULT '{}',
  rive_variant        jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice               jsonb NOT NULL DEFAULT '{}'::jsonb,
  personality_prompt  text NOT NULL,
  default_scene       text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Scenarios to practise. Tenant scoped; 'platform' rows belong to the platform tenant
-- and are readable by members of every tenant (see RLS).
CREATE TABLE IF NOT EXISTS public.practice_scenarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id       uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id       uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  skill_pack      text NOT NULL,
  persona_id      uuid REFERENCES public.ai_personas(id) ON DELETE SET NULL,
  title           text NOT NULL,
  goal            text NOT NULL,
  beats           jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_items    jsonb NOT NULL DEFAULT '[]'::jsonb,
  level           text,
  exam_task       text,
  max_minutes     int NOT NULL DEFAULT 8,
  allowed_modes   text[] NOT NULL DEFAULT ARRAY['live','voice','text']::text[],
  scene           text,
  visibility      text NOT NULL DEFAULT 'course',
  style           text NOT NULL DEFAULT 'scene',
  status          text NOT NULL DEFAULT 'draft',
  created_by      text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_scenarios_max_minutes_check
    CHECK (max_minutes BETWEEN 1 AND 30),
  CONSTRAINT practice_scenarios_allowed_modes_check
    CHECK (allowed_modes <@ ARRAY['live','voice','text']::text[] AND cardinality(allowed_modes) > 0),
  CONSTRAINT practice_scenarios_visibility_check
    CHECK (visibility IN ('course', 'tenant_library', 'platform')),
  CONSTRAINT practice_scenarios_style_check
    CHECK (style IN ('scene', 'guided_lesson', 'oral_check')),
  CONSTRAINT practice_scenarios_status_check
    CHECK (status IN ('draft', 'published', 'archived'))
);

-- Teacher assignments of a scenario to the whole academy or one classroom group.
-- group_id NULL = every member of the tenant.
CREATE TABLE IF NOT EXISTS public.tutor_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  scenario_id   uuid NOT NULL REFERENCES public.practice_scenarios(id) ON DELETE CASCADE,
  group_id      uuid REFERENCES public.classroom_groups(id) ON DELETE CASCADE,
  due_at        timestamptz,
  assigned_by   text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One run of a scenario by a learner in a mode. Named tutor_sessions on purpose:
-- the older public.practice_sessions table is left untouched.
CREATE TABLE IF NOT EXISTS public.tutor_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id               text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_id           uuid REFERENCES public.practice_scenarios(id) ON DELETE SET NULL,
  origin                text NOT NULL,
  lesson_id             uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  assignment_id         uuid REFERENCES public.tutor_assignments(id) ON DELETE SET NULL,
  mode                  text NOT NULL,
  mode_changes          jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at            timestamptz NOT NULL DEFAULT now(),
  ended_at              timestamptz,
  learner_speaking_ms   int NOT NULL DEFAULT 0,
  teacher_speaking_ms   int NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'active',
  shared_with_teacher   boolean NOT NULL DEFAULT false,
  audio_path            text,
  consent_audio         boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_sessions_origin_check
    CHECK (origin IN ('lesson', 'assignment', 'practice', 'ask', 'placement')),
  CONSTRAINT tutor_sessions_mode_check
    CHECK (mode IN ('live', 'voice', 'text')),
  CONSTRAINT tutor_sessions_status_check
    CHECK (status IN ('active', 'completed', 'abandoned', 'flagged')),
  CONSTRAINT tutor_sessions_learner_speaking_ms_check
    CHECK (learner_speaking_ms >= 0),
  CONSTRAINT tutor_sessions_teacher_speaking_ms_check
    CHECK (teacher_speaking_ms >= 0)
);

-- One exchange within a session.
CREATE TABLE IF NOT EXISTS public.tutor_turns (
  id                bigserial PRIMARY KEY,
  session_id        uuid NOT NULL REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  idx               int NOT NULL,
  learner_text      text,
  learner_audio_ms  int,
  events            jsonb NOT NULL DEFAULT '[]'::jsonb,
  latency_ms        int,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_turns_session_idx_key UNIQUE (session_id, idx)
);

-- Post-session report. Scores are guidance only.
CREATE TABLE IF NOT EXISTS public.tutor_reports (
  session_id          uuid PRIMARY KEY REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  scores              jsonb NOT NULL DEFAULT '{}'::jsonb,
  strengths           jsonb NOT NULL DEFAULT '[]'::jsonb,
  mistakes            jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone_stats          jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_scenario_id    uuid REFERENCES public.practice_scenarios(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- One learner profile per tenant, user and language. Shared memory across all origins.
CREATE TABLE IF NOT EXISTS public.learner_language_profiles (
  company_id            text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id               text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language              text NOT NULL,
  level_estimate        text,
  framework             text,
  can_do                jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory                jsonb NOT NULL DEFAULT '{}'::jsonb,
  streak_days           int NOT NULL DEFAULT 0,
  last_practice_date    date,
  total_speaking_ms     bigint NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id, language)
);

-- Vocabulary items. Tenant scoped.
CREATE TABLE IF NOT EXISTS public.vocab_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  language     text NOT NULL,
  term         text NOT NULL,
  pron         text,
  meaning      text,
  level        text,
  audio_path   text,
  examples     jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags         text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Per-learner spaced-repetition state for a vocab item.
CREATE TABLE IF NOT EXISTS public.learner_vocab (
  user_id        text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vocab_id       uuid NOT NULL REFERENCES public.vocab_items(id) ON DELETE CASCADE,
  company_id     text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  due_at         timestamptz NOT NULL DEFAULT now(),
  interval_days  real NOT NULL DEFAULT 0,
  ease           real NOT NULL DEFAULT 2.5,
  reps           int NOT NULL DEFAULT 0,
  lapses         int NOT NULL DEFAULT 0,
  source         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vocab_id),
  CONSTRAINT learner_vocab_source_check
    CHECK (source IN ('lesson', 'mistake', 'manual'))
);

-- Per-tenant settings. One row per company.
-- enabled_persona_ids NULL = every active persona of the tenant.
CREATE TABLE IF NOT EXISTS public.tutor_settings (
  company_id                 text PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  practice_room_enabled      boolean NOT NULL DEFAULT true,
  free_practice_minutes_per_month int NOT NULL DEFAULT 60,
  allowed_modes              text[] NOT NULL DEFAULT ARRAY['live','voice','text']::text[],
  enabled_persona_ids        uuid[],
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_settings_free_minutes_check
    CHECK (free_practice_minutes_per_month >= 0),
  CONSTRAINT tutor_settings_allowed_modes_check
    CHECK (allowed_modes <@ ARRAY['live','voice','text']::text[] AND cardinality(allowed_modes) > 0)
);

-- Metered AI usage, written by the server only.
CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
  id              bigserial PRIMARY KEY,
  company_id      text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         text REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id      uuid REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,
  model           text NOT NULL,
  kind            text NOT NULL,
  units           bigint NOT NULL,
  unit            text NOT NULL,
  est_cost_usd    numeric(10,5),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_ledger_kind_check
    CHECK (kind IN ('live_audio_in', 'live_audio_out', 'tts', 'transcribe', 'llm', 'image')),
  CONSTRAINT ai_usage_ledger_units_check
    CHECK (units >= 0)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS ai_personas_company_active_idx
  ON public.ai_personas(company_id, is_active);

CREATE INDEX IF NOT EXISTS practice_scenarios_company_status_idx
  ON public.practice_scenarios(company_id, status);

CREATE INDEX IF NOT EXISTS practice_scenarios_visibility_status_idx
  ON public.practice_scenarios(visibility, status);

CREATE INDEX IF NOT EXISTS practice_scenarios_course_idx
  ON public.practice_scenarios(course_id) WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS practice_scenarios_lesson_idx
  ON public.practice_scenarios(lesson_id) WHERE lesson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS practice_scenarios_persona_idx
  ON public.practice_scenarios(persona_id) WHERE persona_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tutor_assignments_company_due_idx
  ON public.tutor_assignments(company_id, due_at);

CREATE INDEX IF NOT EXISTS tutor_assignments_scenario_idx
  ON public.tutor_assignments(scenario_id);

CREATE INDEX IF NOT EXISTS tutor_assignments_group_idx
  ON public.tutor_assignments(group_id) WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tutor_sessions_user_started_idx
  ON public.tutor_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS tutor_sessions_company_origin_started_idx
  ON public.tutor_sessions(company_id, origin, started_at DESC);

CREATE INDEX IF NOT EXISTS tutor_sessions_company_status_idx
  ON public.tutor_sessions(company_id, status);

CREATE INDEX IF NOT EXISTS tutor_sessions_scenario_idx
  ON public.tutor_sessions(scenario_id) WHERE scenario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tutor_sessions_lesson_idx
  ON public.tutor_sessions(lesson_id) WHERE lesson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tutor_sessions_assignment_idx
  ON public.tutor_sessions(assignment_id) WHERE assignment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tutor_reports_next_scenario_idx
  ON public.tutor_reports(next_scenario_id) WHERE next_scenario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vocab_items_company_language_idx
  ON public.vocab_items(company_id, language);

CREATE INDEX IF NOT EXISTS learner_vocab_user_due_idx
  ON public.learner_vocab(user_id, due_at);

CREATE INDEX IF NOT EXISTS learner_vocab_vocab_idx
  ON public.learner_vocab(vocab_id);

CREATE INDEX IF NOT EXISTS ai_usage_ledger_company_created_idx
  ON public.ai_usage_ledger(company_id, created_at);

CREATE INDEX IF NOT EXISTS ai_usage_ledger_user_created_idx
  ON public.ai_usage_ledger(user_id, created_at);

CREATE INDEX IF NOT EXISTS ai_usage_ledger_session_idx
  ON public.ai_usage_ledger(session_id) WHERE session_id IS NOT NULL;

-- ============================================================
-- 3. UPDATED_AT TRIGGERS (shared handle_updated_at from 001)
-- ============================================================

DROP TRIGGER IF EXISTS set_exam_frameworks_updated_at ON public.exam_frameworks;
CREATE TRIGGER set_exam_frameworks_updated_at
  BEFORE UPDATE ON public.exam_frameworks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_ai_personas_updated_at ON public.ai_personas;
CREATE TRIGGER set_ai_personas_updated_at
  BEFORE UPDATE ON public.ai_personas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_practice_scenarios_updated_at ON public.practice_scenarios;
CREATE TRIGGER set_practice_scenarios_updated_at
  BEFORE UPDATE ON public.practice_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_tutor_assignments_updated_at ON public.tutor_assignments;
CREATE TRIGGER set_tutor_assignments_updated_at
  BEFORE UPDATE ON public.tutor_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_tutor_sessions_updated_at ON public.tutor_sessions;
CREATE TRIGGER set_tutor_sessions_updated_at
  BEFORE UPDATE ON public.tutor_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_learner_language_profiles_updated_at ON public.learner_language_profiles;
CREATE TRIGGER set_learner_language_profiles_updated_at
  BEFORE UPDATE ON public.learner_language_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_vocab_items_updated_at ON public.vocab_items;
CREATE TRIGGER set_vocab_items_updated_at
  BEFORE UPDATE ON public.vocab_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_learner_vocab_updated_at ON public.learner_vocab;
CREATE TRIGGER set_learner_vocab_updated_at
  BEFORE UPDATE ON public.learner_vocab
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_tutor_settings_updated_at ON public.tutor_settings;
CREATE TRIGGER set_tutor_settings_updated_at
  BEFORE UPDATE ON public.tutor_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. SEED: EXAM FRAMEWORKS (reference data, no client writes)
--    Level codes and labels are factual. Speaking task descriptions are
--    placeholders; each carries a TODO(verify) marker and must be checked
--    against the official syllabus before launch. Seeds are kept minimal on
--    purpose: no vocabulary counts, pass marks or band boundaries.
-- ============================================================

INSERT INTO public.exam_frameworks (id, language, label, levels, speaking_tasks) VALUES
(
  'hsk2', 'zh', 'HSK (2.0)',
  '[
    {"code":"HSK1","label":"HSK 1"},
    {"code":"HSK2","label":"HSK 2"},
    {"code":"HSK3","label":"HSK 3"},
    {"code":"HSK4","label":"HSK 4"},
    {"code":"HSK5","label":"HSK 5"},
    {"code":"HSK6","label":"HSK 6"}
  ]'::jsonb,
  '[]'::jsonb
),
(
  'hsk3', 'zh', 'HSK 3.0',
  '[
    {"code":"L1","label":"HSK 3.0 Level 1"},
    {"code":"L2","label":"HSK 3.0 Level 2"},
    {"code":"L3","label":"HSK 3.0 Level 3"},
    {"code":"L4","label":"HSK 3.0 Level 4"},
    {"code":"L5","label":"HSK 3.0 Level 5"},
    {"code":"L6","label":"HSK 3.0 Level 6"},
    {"code":"L7","label":"HSK 3.0 Level 7"},
    {"code":"L8","label":"HSK 3.0 Level 8"},
    {"code":"L9","label":"HSK 3.0 Level 9"}
  ]'::jsonb,
  -- TODO(verify): check against official syllabus before launch. Speaking tasks intentionally empty.
  '[]'::jsonb
),
(
  'hskk', 'zh', 'HSKK (spoken Chinese)',
  '[
    {"code":"beginner","label":"HSKK Beginner"},
    {"code":"intermediate","label":"HSKK Intermediate"},
    {"code":"advanced","label":"HSKK Advanced"}
  ]'::jsonb,
  -- TODO(verify): check against official syllabus before launch.
  '[{"code":"hskk-beginner","label":"HSKK Beginner","description":"Short spoken answers to personal questions."}]'::jsonb ||
  -- TODO(verify): check against official syllabus before launch.
  '[{"code":"hskk-intermediate","label":"HSKK Intermediate","description":"Spoken answers and a short prepared talk on a familiar topic."}]'::jsonb ||
  -- TODO(verify): check against official syllabus before launch.
  '[{"code":"hskk-advanced","label":"HSKK Advanced","description":"Extended spoken discussion of a given topic with opinions and reasons."}]'::jsonb
),
(
  'cefr_es_dele', 'es', 'DELE (CEFR A1-C2)',
  '[
    {"code":"A1","label":"A1"},
    {"code":"A2","label":"A2"},
    {"code":"B1","label":"B1"},
    {"code":"B2","label":"B2"},
    {"code":"C1","label":"C1"},
    {"code":"C2","label":"C2"}
  ]'::jsonb,
  -- TODO(verify): check against official syllabus before launch.
  '[{"code":"dele-oral-interaction","label":"Oral expression and interaction","description":"Role-play and dialogue tasks matched to the level."}]'::jsonb
),
(
  'cefr_fr_delf', 'fr', 'DELF (A1-B2) and DALF (C1-C2)',
  '[
    {"code":"A1","label":"DELF A1"},
    {"code":"A2","label":"DELF A2"},
    {"code":"B1","label":"DELF B1"},
    {"code":"B2","label":"DELF B2"},
    {"code":"C1","label":"DALF C1"},
    {"code":"C2","label":"DALF C2"}
  ]'::jsonb,
  -- TODO(verify): check against official syllabus before launch.
  '[{"code":"delf-oral-production","label":"Oral production and interaction","description":"Monologue and dialogue tasks matched to the level."}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. SECURITY HELPERS
--    SECURITY DEFINER with a fixed search_path so they can read
--    company_members / tutor_sessions without RLS recursion.
-- ============================================================

-- Active member of an active tenant (any role). A suspended tenant (companies.status
-- = 'suspended', see 20260527000000) yields false, so its members lose access.
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm
    JOIN public.companies co ON co.id = cm.company_id
    WHERE cm.company_id = p_company_id
      AND cm.profile_id = (auth.jwt() ->> 'sub')
      AND cm.status = 'active'
      AND co.status = 'active'
  );
$$;

-- Active staff (company_admin, teacher or instructor) of an active tenant.
-- Suspended tenants yield false.
CREATE OR REPLACE FUNCTION public.is_company_staff(p_company_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm
    JOIN public.companies co ON co.id = cm.company_id
    WHERE cm.company_id = p_company_id
      AND cm.profile_id = (auth.jwt() ->> 'sub')
      AND cm.status = 'active'
      AND cm.role IN ('company_admin', 'teacher', 'instructor')
      AND co.status = 'active'
  );
$$;

-- The current user owns the tutor session.
CREATE OR REPLACE FUNCTION public.is_own_tutor_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_sessions s
    WHERE s.id = p_session_id
      AND s.user_id = (auth.jwt() ->> 'sub')
  );
$$;

-- Privacy split (plan section 2.5): staff may see a session's turns and report only when
-- it is a lesson or assignment session, the learner shared it, or it was flagged.
-- Practice, ask and placement sessions stay private to the learner otherwise.
CREATE OR REPLACE FUNCTION public.is_staff_visible_tutor_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_sessions s
    WHERE s.id = p_session_id
      AND public.is_company_staff(s.company_id)
      AND (
        s.origin IN ('lesson', 'assignment')
        OR s.shared_with_teacher
        OR s.status = 'flagged'
      )
  );
$$;

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.exam_frameworks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_personas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_scenarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_turns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_language_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_vocab            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_ledger          ENABLE ROW LEVEL SECURITY;

-- ---- exam_frameworks: any signed-in user reads; no client writes ----
DROP POLICY IF EXISTS "Authenticated users can read exam frameworks" ON public.exam_frameworks;
CREATE POLICY "Authenticated users can read exam frameworks"
  ON public.exam_frameworks FOR SELECT TO authenticated
  USING (true);

-- ---- ai_personas: tenant members read; tenant staff write.
--      Also readable when a published platform scenario uses the persona. ----
DROP POLICY IF EXISTS "Tenant members can read personas" ON public.ai_personas;
CREATE POLICY "Tenant members can read personas"
  ON public.ai_personas FOR SELECT TO authenticated
  USING (
    public.is_company_member(company_id)
    OR EXISTS (
      SELECT 1
      FROM public.practice_scenarios ps
      WHERE ps.persona_id = ai_personas.id
        AND ps.visibility = 'platform'
        AND ps.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Tenant staff manage personas" ON public.ai_personas;
CREATE POLICY "Tenant staff manage personas"
  ON public.ai_personas FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (public.is_company_staff(company_id));

-- ---- practice_scenarios: tenant members read published rows; staff read and write all rows;
--      any signed-in user reads published platform rows. ----
DROP POLICY IF EXISTS "Tenant members can read published scenarios" ON public.practice_scenarios;
CREATE POLICY "Tenant members can read published scenarios"
  ON public.practice_scenarios FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS "Anyone can read published platform scenarios" ON public.practice_scenarios;
CREATE POLICY "Anyone can read published platform scenarios"
  ON public.practice_scenarios FOR SELECT TO authenticated
  USING (
    visibility = 'platform'
    AND status = 'published'
  );

DROP POLICY IF EXISTS "Tenant staff manage scenarios" ON public.practice_scenarios;
CREATE POLICY "Tenant staff manage scenarios"
  ON public.practice_scenarios FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (public.is_company_staff(company_id));

-- ---- tutor_assignments: learners read assignments for the whole tenant or their own group;
--      staff manage. The group must belong to the same tenant. ----
DROP POLICY IF EXISTS "Members read assignments for their academy or group" ON public.tutor_assignments;
CREATE POLICY "Members read assignments for their academy or group"
  ON public.tutor_assignments FOR SELECT TO authenticated
  USING (
    public.is_company_member(company_id)
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.classroom_group_members m
        WHERE m.group_id = tutor_assignments.group_id
          AND m.profile_id = (auth.jwt() ->> 'sub')
      )
    )
  );

DROP POLICY IF EXISTS "Tenant staff manage assignments" ON public.tutor_assignments;
CREATE POLICY "Tenant staff manage assignments"
  ON public.tutor_assignments FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (
    public.is_company_staff(company_id)
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.classroom_groups g
        WHERE g.id = tutor_assignments.group_id
          AND g.company_id = tutor_assignments.company_id
      )
    )
  );

-- ---- tutor_sessions: learners fully manage their own sessions (must be an active member);
--      staff read only sessions that pass the privacy split. ----
DROP POLICY IF EXISTS "Learners manage own tutor sessions" ON public.tutor_sessions;
CREATE POLICY "Learners manage own tutor sessions"
  ON public.tutor_sessions FOR ALL TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')
    AND public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS "Staff read lesson, assignment, shared or flagged tutor sessions" ON public.tutor_sessions;
CREATE POLICY "Staff read lesson, assignment, shared or flagged tutor sessions"
  ON public.tutor_sessions FOR SELECT TO authenticated
  USING (
    public.is_company_staff(company_id)
    AND (
      origin IN ('lesson', 'assignment')
      OR shared_with_teacher
      OR status = 'flagged'
    )
  );

-- ---- tutor_turns: learners fully manage turns of their own sessions;
--      staff read turns only when the session passes the privacy split. ----
DROP POLICY IF EXISTS "Learners manage turns of own tutor sessions" ON public.tutor_turns;
CREATE POLICY "Learners manage turns of own tutor sessions"
  ON public.tutor_turns FOR ALL TO authenticated
  USING (public.is_own_tutor_session(session_id))
  WITH CHECK (public.is_own_tutor_session(session_id));

DROP POLICY IF EXISTS "Staff read turns of staff-visible tutor sessions" ON public.tutor_turns;
CREATE POLICY "Staff read turns of staff-visible tutor sessions"
  ON public.tutor_turns FOR SELECT TO authenticated
  USING (public.is_staff_visible_tutor_session(session_id));

-- ---- tutor_reports: learners read reports of their own sessions;
--      staff read reports under the same privacy split. No client writes (server only). ----
DROP POLICY IF EXISTS "Learners read reports of own tutor sessions" ON public.tutor_reports;
CREATE POLICY "Learners read reports of own tutor sessions"
  ON public.tutor_reports FOR SELECT TO authenticated
  USING (public.is_own_tutor_session(session_id));

DROP POLICY IF EXISTS "Staff read reports of staff-visible tutor sessions" ON public.tutor_reports;
CREATE POLICY "Staff read reports of staff-visible tutor sessions"
  ON public.tutor_reports FOR SELECT TO authenticated
  USING (public.is_staff_visible_tutor_session(session_id));

-- ---- learner_language_profiles: learners read and write their own profile in a tenant they belong to.
--      Staff access is not granted here (open question in the PR). ----
DROP POLICY IF EXISTS "Learners read own language profiles" ON public.learner_language_profiles;
CREATE POLICY "Learners read own language profiles"
  ON public.learner_language_profiles FOR SELECT TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Learners insert own language profiles" ON public.learner_language_profiles;
CREATE POLICY "Learners insert own language profiles"
  ON public.learner_language_profiles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')
    AND public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS "Learners update own language profiles" ON public.learner_language_profiles;
CREATE POLICY "Learners update own language profiles"
  ON public.learner_language_profiles FOR UPDATE TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')
    AND public.is_company_member(company_id)
  );

-- ---- learner_language_profiles (staff): tenant staff read the profiles of learners in their
--      tenant (level, streak, minutes, can_do, memory). Staff never write these rows. ----
DROP POLICY IF EXISTS "Tenant staff read learner language profiles" ON public.learner_language_profiles;
CREATE POLICY "Tenant staff read learner language profiles"
  ON public.learner_language_profiles FOR SELECT TO authenticated
  USING (public.is_company_staff(company_id));

-- ---- vocab_items: tenant members read; tenant staff write. ----
DROP POLICY IF EXISTS "Tenant members can read vocab items" ON public.vocab_items;
CREATE POLICY "Tenant members can read vocab items"
  ON public.vocab_items FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Tenant staff manage vocab items" ON public.vocab_items;
CREATE POLICY "Tenant staff manage vocab items"
  ON public.vocab_items FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (public.is_company_staff(company_id));

-- ---- learner_vocab: learners read, insert and update their own SRS rows.
--      An insert must point at an item of the same tenant. ----
DROP POLICY IF EXISTS "Learners read own vocab" ON public.learner_vocab;
CREATE POLICY "Learners read own vocab"
  ON public.learner_vocab FOR SELECT TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Learners insert own vocab" ON public.learner_vocab;
CREATE POLICY "Learners insert own vocab"
  ON public.learner_vocab FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')
    AND public.is_company_member(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.vocab_items v
      WHERE v.id = learner_vocab.vocab_id
        AND v.company_id = learner_vocab.company_id
    )
  );

DROP POLICY IF EXISTS "Learners update own vocab" ON public.learner_vocab;
CREATE POLICY "Learners update own vocab"
  ON public.learner_vocab FOR UPDATE TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- ---- tutor_settings: tenant members read (the Practice Room gate); tenant staff write. ----
DROP POLICY IF EXISTS "Tenant members can read tutor settings" ON public.tutor_settings;
CREATE POLICY "Tenant members can read tutor settings"
  ON public.tutor_settings FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Tenant staff manage tutor settings" ON public.tutor_settings;
CREATE POLICY "Tenant staff manage tutor settings"
  ON public.tutor_settings FOR ALL TO authenticated
  USING (public.is_company_staff(company_id))
  WITH CHECK (public.is_company_staff(company_id));

-- ---- ai_usage_ledger: tenant staff read their tenant's rows. No client writes
--      (the service role inserts and bypasses RLS). ----
DROP POLICY IF EXISTS "Tenant staff read AI usage" ON public.ai_usage_ledger;
CREATE POLICY "Tenant staff read AI usage"
  ON public.ai_usage_ledger FOR SELECT TO authenticated
  USING (public.is_company_staff(company_id));

-- Learners read their own usage rows (for example, remaining free minutes). Still no client writes.
DROP POLICY IF EXISTS "Learners read own AI usage" ON public.ai_usage_ledger;
CREATE POLICY "Learners read own AI usage"
  ON public.ai_usage_ledger FOR SELECT TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'));

-- ============================================================
-- 7. STORAGE
-- ============================================================

-- Private bucket for learner audio.
-- Path convention: tutor-audio/<learner_sub>/<session_id>/<file>
--   folder 1 = the learner's Clerk sub; folder 2 = tutor_sessions.id (uuid).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutor-audio',
  'tutor-audio',
  false,
  20971520, -- 20 MB per file
  ARRAY['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Learners insert own tutor audio" ON storage.objects;
CREATE POLICY "Learners insert own tutor audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tutor-audio'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "Learners read own tutor audio" ON storage.objects;
CREATE POLICY "Learners read own tutor audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tutor-audio'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "Learners update own tutor audio" ON storage.objects;
CREATE POLICY "Learners update own tutor audio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tutor-audio'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    bucket_id = 'tutor-audio'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "Learners delete own tutor audio" ON storage.objects;
CREATE POLICY "Learners delete own tutor audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tutor-audio'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

-- Staff read tutor audio only for sessions they can already see (privacy split).
-- The folder name is cast to uuid only after a regex check. CASE guarantees the
-- cast is not evaluated for non-uuid or missing folders (AND does not guarantee order).
DROP POLICY IF EXISTS "Staff read tutor audio of staff-visible sessions" ON storage.objects;
CREATE POLICY "Staff read tutor audio of staff-visible sessions"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tutor-audio'
    AND CASE
      WHEN (storage.foldername(name))[2]
           ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.is_staff_visible_tutor_session(((storage.foldername(name))[2])::uuid)
      ELSE false
    END
  );

-- Public-read cache for synthesized speech. No client writes: only the service role
-- writes here, and it bypasses RLS.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutor-tts-cache',
  'tutor-tts-cache',
  true,
  5242880, -- 5 MB per file
  ARRAY['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read tutor tts cache" ON storage.objects;
CREATE POLICY "Public can read tutor tts cache"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'tutor-tts-cache');

-- ============================================================
-- 8. PLATFORM-TENANT GUARD
--    Only the platform tenant may write visibility='platform' scenarios, and a platform
--    scenario may only use a persona owned by the platform tenant. The platform tenant is
--    found by companies.slug = 'zedai' (see 20260526000000); no org id is hardcoded.
-- ============================================================

CREATE OR REPLACE FUNCTION public.platform_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT co.id FROM public.companies co WHERE co.slug = 'zedai' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.guard_platform_scenarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform text := public.platform_tenant_id();
  v_persona_company text;
BEGIN
  IF NEW.visibility = 'platform' THEN
    IF v_platform IS NULL OR NEW.company_id IS DISTINCT FROM v_platform THEN
      RAISE EXCEPTION 'platform scenarios can only be written by the platform tenant (companies.slug = ''zedai'')'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.persona_id IS NOT NULL THEN
      SELECT p.company_id INTO v_persona_company
      FROM public.ai_personas p
      WHERE p.id = NEW.persona_id;

      IF v_persona_company IS DISTINCT FROM v_platform THEN
        RAISE EXCEPTION 'a platform scenario can only use a persona owned by the platform tenant'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_platform_scenarios ON public.practice_scenarios;
CREATE TRIGGER guard_platform_scenarios
  BEFORE INSERT OR UPDATE ON public.practice_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_scenarios();

COMMIT;
