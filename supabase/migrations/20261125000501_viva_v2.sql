-- ============================================================
-- AI Teacher Phase 2 (P2-08): certificate oral check ("viva") v2
--
--   courses.viva_rubric      per-course rubric (jsonb; null = platform default, see src/lib/tutor/viva-v2.ts)
--   viva_reviews             staff review queue: AI `needs_review` outcomes and learner appeals (one per course)
--   viva_audit_events        append-only audit trail: review queued / requested / approved / returned,
--                            certificate issued after a viva
--
-- Server code uses the service role and authorises in app code (src/lib/authz); RLS here is defence in depth:
-- learners read their own rows, nothing else is granted to authenticated users.
--
-- Requires 20261124000000_teacher_phase3_scale.sql (courses.require_certificate_viva / viva_scenario_id).
-- Additive and idempotent. Down (manual): drop table viva_audit_events, viva_reviews; alter table courses drop
-- column viva_rubric.
-- ============================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS viva_rubric jsonb;

COMMENT ON COLUMN public.courses.viva_rubric IS
  'P2-08 oral check rubric (minMetShare, maxReviewObjectives, minTaskScore, borderlineMargin, minMasteryShare, requireHumanApproval, allowAppeal). Null = default.';

-- ------------------------------------------------------------
-- viva_reviews
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.viva_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id      uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id        text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The viva session the review is about (null for an appeal on a course whose viva is not set up).
  session_id     uuid REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,
  kind           text NOT NULL CHECK (kind IN ('needs_review', 'appeal')),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'returned')),
  -- The automatic decision snapshot at the time the review was opened (outcome, reason, signals, rubric).
  evaluation     jsonb NOT NULL DEFAULT '{}'::jsonb,
  learner_note   text CHECK (learner_note IS NULL OR char_length(learner_note) <= 1000),
  reviewer_id    text REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_note  text CHECK (reviewer_note IS NULL OR char_length(reviewer_note) <= 2000),
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT viva_reviews_decision_consistent CHECK (
    (status = 'pending' AND decided_at IS NULL) OR (status <> 'pending' AND decided_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.viva_reviews IS
  'P2-08 staff review queue for certificate oral checks: AI needs_review outcomes and learner appeals.';

-- One automatic review per viva session; one learner appeal per learner and course.
CREATE UNIQUE INDEX IF NOT EXISTS viva_reviews_session_kind_uniq
  ON public.viva_reviews (session_id, kind)
  WHERE session_id IS NOT NULL AND kind = 'needs_review';

CREATE UNIQUE INDEX IF NOT EXISTS viva_reviews_one_appeal_uniq
  ON public.viva_reviews (course_id, user_id)
  WHERE kind = 'appeal';

CREATE INDEX IF NOT EXISTS viva_reviews_queue_idx
  ON public.viva_reviews (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS viva_reviews_learner_idx
  ON public.viva_reviews (course_id, user_id, created_at DESC);

DROP TRIGGER IF EXISTS set_viva_reviews_updated_at ON public.viva_reviews;
CREATE TRIGGER set_viva_reviews_updated_at
  BEFORE UPDATE ON public.viva_reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.viva_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners read own viva reviews" ON public.viva_reviews;
CREATE POLICY "Learners read own viva reviews"
  ON public.viva_reviews FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.jwt() ->> 'sub'));

-- ------------------------------------------------------------
-- viva_audit_events (append-only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.viva_audit_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  review_id   uuid REFERENCES public.viva_reviews(id) ON DELETE SET NULL,
  session_id  uuid,
  -- Who acted: the learner, a staff member, or null for the system (automatic outcome).
  actor_id    text,
  action      text NOT NULL CHECK (action IN (
                'review_queued', 'review_requested', 'review_approved', 'review_returned',
                'certificate_issued')),
  outcome     text CHECK (outcome IS NULL OR outcome IN ('pass', 'needs_review', 'not_yet')),
  note        text CHECK (note IS NULL OR char_length(note) <= 2000),
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.viva_audit_events IS
  'P2-08 append-only audit trail of oral check reviews and certificate issuance after a viva.';

CREATE INDEX IF NOT EXISTS viva_audit_events_course_user_idx
  ON public.viva_audit_events (course_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS viva_audit_events_review_idx
  ON public.viva_audit_events (review_id)
  WHERE review_id IS NOT NULL;

ALTER TABLE public.viva_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners read own viva audit events" ON public.viva_audit_events;
CREATE POLICY "Learners read own viva audit events"
  ON public.viva_audit_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.jwt() ->> 'sub'));
