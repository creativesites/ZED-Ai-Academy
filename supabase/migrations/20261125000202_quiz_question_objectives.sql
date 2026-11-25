-- ============================================================
-- AI Teacher Phase 2 (P2-03): quiz questions link to registered objectives
--
-- Optional objective_id on quiz_questions. saveQuizAttempt records one server-verified `quiz` evidence
-- item per answered question that has an objective (enrolled learners only), via record_evidence().
--
-- Requires 20261125000200_learning_objectives.sql.
-- NOT APPLIED. Written for review and owner apply. Additive and idempotent.
-- ============================================================

BEGIN;

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quiz_questions.objective_id IS
  'Optional registered objective this question tests (same course). Answers become quiz evidence for it.';

CREATE INDEX IF NOT EXISTS quiz_questions_objective_idx
  ON public.quiz_questions (objective_id)
  WHERE objective_id IS NOT NULL;

COMMIT;
