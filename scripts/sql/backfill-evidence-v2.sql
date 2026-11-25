-- ============================================================
-- Backfill for AI Teacher P2-02 (evidence v2). Run AFTER migration 20261125000201_evidence_v2.sql.
--
-- What it does (idempotent; safe to stop and re-run):
--  1. learner_evidence rows written before v2 (weight IS NULL): source = 'legacy_ai' (already the column
--     default), server_verified = false, score from result (1 / 0.5 / 0), weight = 0.24
--     (= legacy_ai 0.4 × unverified 0.6, Architecture §4.2).
--  2. learner_mastery rows written before v2 (p_mastery IS NULL AND evidence_count > 0 AND evidence_mass = 0):
--     p_mastery from the legacy level (0→0.15, 1→0.40, 2→0.65, 3→0.85, same mapping as
--     pFromLegacyLevel() in src/lib/tutor/learner/knowledge.ts and the seeding inside record_evidence()),
--     evidence_mass = evidence_count × 0.24 (no recency discount: an approximation, these are old AI
--     opinions), confidence = 1 − exp(−mass/3), stability 1 day, status learning/practising (never secure:
--     legacy evidence is AI opinion only, no independent source or spaced review), next_review_at from
--     last_evidence_at.
--  3. Validates the NOT VALID check constraints added by the migration.
--
-- Batched with keyset pagination and a COMMIT per batch, so no long-running transaction and no long locks.
--
-- Usage (psql, NOT inside BEGIN ... COMMIT — the procedure commits per batch):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/backfill-evidence-v2.sql
-- The Supabase SQL editor wraps scripts in a transaction; there, run the statements of each step by hand
-- with a LIMIT, repeating until 0 rows are updated.
--
-- NEVER run against production without a backup and the owner's go-ahead.
-- ============================================================

CREATE OR REPLACE PROCEDURE public.tmp_backfill_evidence_v2(p_batch integer DEFAULT 5000)
LANGUAGE plpgsql
-- No SET search_path here: a procedure with a SET clause cannot COMMIT. All names are schema-qualified.
AS $$
DECLARE
  v_last  uuid := '00000000-0000-0000-0000-000000000000';
  v_max   uuid;
  v_rows  integer;
  v_total bigint := 0;
BEGIN
  -- 1. Evidence rows
  LOOP
    SELECT b.id INTO v_max FROM (
      SELECT id FROM public.learner_evidence WHERE id > v_last ORDER BY id LIMIT p_batch
    ) b ORDER BY b.id DESC LIMIT 1;
    EXIT WHEN v_max IS NULL;

    UPDATE public.learner_evidence
    SET source = coalesce(source, 'legacy_ai'),
        server_verified = false,
        score = CASE result WHEN 'correct' THEN 1 WHEN 'partial' THEN 0.5 ELSE 0 END,
        weight = 0.24
    WHERE id > v_last AND id <= v_max AND weight IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
    v_last := v_max;
    COMMIT;
  END LOOP;
  RAISE NOTICE 'learner_evidence backfilled: % rows', v_total;

  -- 2. Mastery rows
  v_last := '00000000-0000-0000-0000-000000000000';
  v_total := 0;
  LOOP
    SELECT b.id INTO v_max FROM (
      SELECT id FROM public.learner_mastery WHERE id > v_last ORDER BY id LIMIT p_batch
    ) b ORDER BY b.id DESC LIMIT 1;
    EXIT WHEN v_max IS NULL;

    UPDATE public.learner_mastery m
    SET p_mastery = s.p,
        evidence_mass = round(s.mass::numeric, 6),
        confidence = round((1 - exp(-s.mass / 3.0))::numeric, 6),
        stability_days = 1,
        status = CASE WHEN s.p < 0.4 THEN 'learning' ELSE 'practising' END,
        next_review_at = coalesce(m.last_evidence_at, m.updated_at) + make_interval(secs => ln(1 / 0.85) * 86400)
    FROM (
      SELECT id,
             (ARRAY[0.15, 0.4, 0.65, 0.85])[greatest(0, least(3, level)) + 1]::numeric AS p,
             (evidence_count * 0.24)::double precision AS mass
      FROM public.learner_mastery
      WHERE id > v_last AND id <= v_max
        AND p_mastery IS NULL AND evidence_count > 0 AND evidence_mass = 0
    ) s
    WHERE m.id = s.id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
    v_last := v_max;
    COMMIT;
  END LOOP;
  RAISE NOTICE 'learner_mastery backfilled: % rows', v_total;
END;
$$;

CALL public.tmp_backfill_evidence_v2(5000);
DROP PROCEDURE public.tmp_backfill_evidence_v2(integer);

-- 3. Validate the constraints (SHARE UPDATE EXCLUSIVE lock: reads and writes continue).
ALTER TABLE public.learner_evidence VALIDATE CONSTRAINT learner_evidence_source_check;
ALTER TABLE public.learner_evidence VALIDATE CONSTRAINT learner_evidence_score_check;
ALTER TABLE public.learner_evidence VALIDATE CONSTRAINT learner_evidence_difficulty_check;
ALTER TABLE public.learner_evidence VALIDATE CONSTRAINT learner_evidence_item_ref_check;
ALTER TABLE public.learner_evidence VALIDATE CONSTRAINT learner_evidence_weight_check;
ALTER TABLE public.learner_mastery VALIDATE CONSTRAINT learner_mastery_status_check;
ALTER TABLE public.learner_mastery VALIDATE CONSTRAINT learner_mastery_p_check;

-- Sanity report
SELECT 'evidence without weight' AS check, count(*) FROM public.learner_evidence WHERE weight IS NULL
UNION ALL
SELECT 'legacy mastery without p', count(*) FROM public.learner_mastery
  WHERE p_mastery IS NULL AND evidence_count > 0 AND evidence_mass = 0;
