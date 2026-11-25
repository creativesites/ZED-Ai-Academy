-- ============================================================
-- AI Teacher Phase 2 (P2-07): review scheduler support and retention checks
--
-- The scheduler itself is pure TypeScript (src/lib/tutor/learner/scheduler.ts). It reads columns added by
-- 20261125000201_evidence_v2.sql (next_review_at, stability_days, secured_at, status) and learner_vocab.due_at.
-- This migration adds:
--   * an index for "what is due for this learner" reads;
--   * public.learner_retention_checks: one row per secured objective × checkpoint (7 and 30 days after
--     secured_at) with the first evidence at or after the checkpoint and whether it passed. Retention accuracy =
--     share of answered checks that passed. Grading mirrors src/lib/tutor/learner/retention.ts
--     (score >= 0.75 = KNOWLEDGE_PARAMS.successAtLeast; self_report evidence never counts). Keep them in step.
--
-- The view is security_invoker so RLS of the underlying tables applies to non-service callers; server code
-- (service role) authorises staff in app code before reading it (src/lib/tutor/learner/scheduler-server.ts).
--
-- Requires 20261125000201_evidence_v2.sql. Additive and idempotent.
-- ============================================================

CREATE INDEX IF NOT EXISTS learner_mastery_due_idx
  ON public.learner_mastery (user_id, company_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS learner_mastery_secured_idx
  ON public.learner_mastery (company_id, course_id, secured_at)
  WHERE secured_at IS NOT NULL;

CREATE OR REPLACE VIEW public.learner_retention_checks
WITH (security_invoker = true) AS
SELECT
  m.company_id,
  m.course_id,
  m.user_id,
  m.objective_key,
  m.objective_id,
  m.secured_at,
  cp.checkpoint_days,
  m.secured_at + make_interval(days => cp.checkpoint_days) AS due_at,
  e.created_at AS checked_at,
  e.score,
  CASE WHEN e.created_at IS NULL THEN NULL ELSE e.score >= 0.75 END AS passed
FROM public.learner_mastery m
CROSS JOIN (VALUES (7), (30)) AS cp(checkpoint_days)
LEFT JOIN LATERAL (
  SELECT
    ev.created_at,
    coalesce(
      ev.score,
      CASE ev.result WHEN 'correct' THEN 1 WHEN 'partial' THEN 0.5 ELSE 0 END
    )::numeric AS score
  FROM public.learner_evidence ev
  WHERE ev.user_id = m.user_id
    AND ev.company_id IS NOT DISTINCT FROM m.company_id
    AND ev.objective_key = m.objective_key
    AND ev.source <> 'self_report'
    AND ev.created_at >= m.secured_at + make_interval(days => cp.checkpoint_days)
  ORDER BY ev.created_at ASC
  LIMIT 1
) e ON true
WHERE m.secured_at IS NOT NULL
  AND m.secured_at + make_interval(days => cp.checkpoint_days) <= now();

COMMENT ON VIEW public.learner_retention_checks IS
  'P2-07: delayed retention checks (7/30 days after secured_at). passed is null while the check is unanswered.';

REVOKE ALL ON public.learner_retention_checks FROM anon;
REVOKE ALL ON public.learner_retention_checks FROM authenticated;
GRANT SELECT ON public.learner_retention_checks TO service_role;
