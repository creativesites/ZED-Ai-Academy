-- ============================================================
-- AI Teacher Phase 2 (P2-02): evidence v2 and record_evidence()
--
-- Evolves learner_evidence and learner_mastery in place (D-05, no parallel tables) and adds the single
-- write path for the knowledge model (Architecture §4.1, §4.2, D-06):
--
--   public.record_evidence(...)        one evidence item: insert evidence + update mastery, one transaction,
--                                      mastery row locked FOR UPDATE (fixes lost updates under concurrency)
--   public.record_evidence_batch(jsonb) many items in one transaction, locks taken in objective_key order
--
-- The update rule mirrors src/lib/tutor/learner/knowledge.ts exactly (parity fixtures:
-- supabase/tests/tutor/fixtures/knowledge_parity.json, SQL test supabase/tests/tutor/knowledge_parity_test.sql).
-- Change both together.
--
-- Requires 20261123000000_learner_mastery.sql and 20261125000200_learning_objectives.sql.
--
-- Large-table safety:
--  * New columns use constant defaults (metadata-only in PG11+, no table rewrite).
--  * CHECK constraints are added NOT VALID (no full scan under ACCESS EXCLUSIVE); the backfill script
--    scripts/sql/backfill-evidence-v2.sql validates them afterwards with a weaker lock.
--  * Existing evidence rows read source = 'legacy_ai' through the column default. Mastery v2 fields
--    (p_mastery, status, ...) for existing rows are filled by the batched backfill script, NOT here.
--
-- Unique key change (D-05): learner_mastery was unique on (user_id, objective_key). The new key is
-- (company_id, user_id, objective_key). The new key is strictly finer than the old one, so any table that
-- satisfies the old constraint already satisfies the new one: creating the new index cannot fail on
-- duplicates. The DO block below still checks first and aborts with a clear message rather than leaving a
-- half-applied migration (everything is in one transaction). Dropping the old constraint lets the same
-- legacy text key exist in two tenants.
--
-- NOT APPLIED. Written for review and owner apply. Idempotent: safe to re-run.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- learner_evidence: v2 columns
-- ------------------------------------------------------------
ALTER TABLE public.learner_evidence
  ADD COLUMN IF NOT EXISTS objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy_ai',
  ADD COLUMN IF NOT EXISTS server_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS difficulty smallint,
  ADD COLUMN IF NOT EXISTS item_ref text,
  ADD COLUMN IF NOT EXISTS weight numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learner_evidence_source_check'
                 AND conrelid = 'public.learner_evidence'::regclass) THEN
    ALTER TABLE public.learner_evidence ADD CONSTRAINT learner_evidence_source_check
      CHECK (source IN ('quiz', 'interaction', 'widget', 'viva_check', 'teacher_judgement', 'self_report', 'legacy_ai'))
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learner_evidence_score_check'
                 AND conrelid = 'public.learner_evidence'::regclass) THEN
    ALTER TABLE public.learner_evidence ADD CONSTRAINT learner_evidence_score_check
      CHECK (score IS NULL OR (score >= 0 AND score <= 1)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learner_evidence_difficulty_check'
                 AND conrelid = 'public.learner_evidence'::regclass) THEN
    ALTER TABLE public.learner_evidence ADD CONSTRAINT learner_evidence_difficulty_check
      CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 3) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learner_evidence_item_ref_check'
                 AND conrelid = 'public.learner_evidence'::regclass) THEN
    ALTER TABLE public.learner_evidence ADD CONSTRAINT learner_evidence_item_ref_check
      CHECK (item_ref IS NULL OR char_length(item_ref) <= 200) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learner_evidence_weight_check'
                 AND conrelid = 'public.learner_evidence'::regclass) THEN
    ALTER TABLE public.learner_evidence ADD CONSTRAINT learner_evidence_weight_check
      CHECK (weight IS NULL OR weight >= 0) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS learner_evidence_objective_idx
  ON public.learner_evidence (objective_id, created_at DESC)
  WHERE objective_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS learner_evidence_item_ref_idx
  ON public.learner_evidence (user_id, item_ref)
  WHERE item_ref IS NOT NULL;

-- ------------------------------------------------------------
-- learner_mastery: v2 columns (level stays; dual-written from p_mastery)
-- ------------------------------------------------------------
ALTER TABLE public.learner_mastery
  ADD COLUMN IF NOT EXISTS objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS p_mastery numeric,
  ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_mass numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stability_days numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unseen',
  ADD COLUMN IF NOT EXISTS evidence_sources text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS spaced_reviews integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secured_at timestamptz;

COMMENT ON COLUMN public.learner_mastery.p_mastery IS
  'Estimated mastery 0..1 at last_evidence_at (null = unseen). Read-time p_effective = p × exp(−t/stability_days).';
COMMENT ON COLUMN public.learner_mastery.evidence_mass IS
  'Recency-discounted sum of evidence weights; confidence = 1 − exp(−mass/3).';
COMMENT ON COLUMN public.learner_mastery.evidence_sources IS
  'Distinct evidence sources that moved p (self_report and legacy_ai excluded). Secure needs ≥2 or a spaced review.';
COMMENT ON COLUMN public.learner_mastery.level IS
  'Legacy 0..3 level, derived from p_mastery by record_evidence() during the transition (D-05).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learner_mastery_status_check'
                 AND conrelid = 'public.learner_mastery'::regclass) THEN
    ALTER TABLE public.learner_mastery ADD CONSTRAINT learner_mastery_status_check
      CHECK (status IN ('unseen', 'learning', 'practising', 'secure', 'needs_review')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learner_mastery_p_check'
                 AND conrelid = 'public.learner_mastery'::regclass) THEN
    ALTER TABLE public.learner_mastery ADD CONSTRAINT learner_mastery_p_check
      CHECK ((p_mastery IS NULL OR (p_mastery >= 0 AND p_mastery <= 1))
             AND confidence >= 0 AND confidence <= 1
             AND evidence_mass >= 0
             AND stability_days >= 1
             AND spaced_reviews >= 0) NOT VALID;
  END IF;
END $$;

-- Unique key change: check, add the new key, then drop the old one.
DO $$
DECLARE
  v_dupes bigint;
BEGIN
  SELECT count(*) INTO v_dupes
  FROM (
    SELECT 1 FROM public.learner_mastery
    GROUP BY company_id, user_id, objective_key
    HAVING count(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION
      'learner_mastery has % duplicate (company_id, user_id, objective_key) groups. Merge them (keep the row with the latest last_evidence_at) before applying 20261125000201.',
      v_dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS learner_mastery_company_user_key_uidx
  ON public.learner_mastery (company_id, user_id, objective_key);

ALTER TABLE public.learner_mastery
  DROP CONSTRAINT IF EXISTS learner_mastery_user_id_objective_key_key;

CREATE INDEX IF NOT EXISTS learner_mastery_objective_idx
  ON public.learner_mastery (objective_id)
  WHERE objective_id IS NOT NULL;

-- Review scheduler lookups: "what is due for this learner in this tenant".
CREATE INDEX IF NOT EXISTS learner_mastery_due_idx
  ON public.learner_mastery (company_id, user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- ------------------------------------------------------------
-- record_evidence(): the only write path for evidence + mastery
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_evidence(
  p_user_id         text,
  p_company_id      text,
  p_objective_key   text,
  p_objective_text  text,
  p_result          text,
  p_source          text DEFAULT 'teacher_judgement',
  p_server_verified boolean DEFAULT false,
  p_score           numeric DEFAULT NULL,
  p_difficulty      smallint DEFAULT NULL,
  p_objective_id    uuid DEFAULT NULL,
  p_course_id       uuid DEFAULT NULL,
  p_scenario_id     uuid DEFAULT NULL,
  p_session_id      uuid DEFAULT NULL,
  p_item_ref        text DEFAULT NULL,
  p_detail          text DEFAULT NULL,
  p_at              timestamptz DEFAULT now()
)
RETURNS public.learner_mastery
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key      text;
  v_text     text := left(btrim(coalesce(p_objective_text, '')), 500);
  v_obj_co   text;
  v_row      public.learner_mastery;
  v_w        double precision;
  v_o        double precision;
  v_gap      double precision;
  v_mass     double precision;
  v_conf     double precision;
  v_p        double precision;
  v_base     double precision;
  v_alpha    double precision;
  v_first    boolean;
  v_stab     double precision;
  v_spaced   integer;
  v_sources  text[];
  v_status   text;
  v_secured  timestamptz;
  v_next     timestamptz;
  v_level    integer;
  v_at       timestamptz := coalesce(p_at, now());
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'record_evidence: user_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_company_id IS NULL OR btrim(p_company_id) = '' THEN
    RAISE EXCEPTION 'record_evidence: company_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_result IS NULL OR p_result NOT IN ('correct', 'partial', 'misconception') THEN
    RAISE EXCEPTION 'record_evidence: invalid result %', p_result USING ERRCODE = '22023';
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('quiz', 'interaction', 'widget', 'viva_check', 'teacher_judgement', 'self_report', 'legacy_ai') THEN
    RAISE EXCEPTION 'record_evidence: invalid source %', p_source USING ERRCODE = '22023';
  END IF;

  -- Registered objectives are keyed by id and must belong to the same tenant.
  IF p_objective_id IS NOT NULL THEN
    SELECT company_id INTO v_obj_co FROM public.learning_objectives WHERE id = p_objective_id;
    IF v_obj_co IS NULL OR v_obj_co <> p_company_id THEN
      RAISE EXCEPTION 'record_evidence: objective % is not in tenant %', p_objective_id, p_company_id
        USING ERRCODE = '42501';
    END IF;
    v_key := lower(p_objective_id::text);
  ELSE
    v_key := left(btrim(coalesce(p_objective_key, '')), 300);
  END IF;
  IF v_key = '' THEN
    RAISE EXCEPTION 'record_evidence: objective key is required' USING ERRCODE = '22023';
  END IF;
  IF v_text = '' THEN
    v_text := v_key;
  END IF;

  -- w = sourceWeight × difficultyFactor × (verified ? 1 : 0.6)
  v_w := (CASE p_source
            WHEN 'quiz' THEN 1.0 WHEN 'interaction' THEN 1.0 WHEN 'widget' THEN 1.0 WHEN 'viva_check' THEN 1.0
            WHEN 'teacher_judgement' THEN 0.5 WHEN 'self_report' THEN 0.1 ELSE 0.4 END)
         * (CASE p_difficulty WHEN 1 THEN 0.8 WHEN 2 THEN 1.0 WHEN 3 THEN 1.2 ELSE 1.0 END)
         * (CASE WHEN p_server_verified THEN 1.0 ELSE 0.6 END);
  -- o = score (clamped) or correct 1 / partial 0.5 / misconception 0
  v_o := CASE
           WHEN p_score IS NOT NULL THEN greatest(0, least(1, p_score::double precision))
           WHEN p_result = 'correct' THEN 1.0
           WHEN p_result = 'partial' THEN 0.5
           ELSE 0.0
         END;

  INSERT INTO public.learner_evidence (
    user_id, company_id, course_id, scenario_id, session_id, objective_key, objective_text, objective_id,
    result, detail, source, server_verified, score, difficulty, item_ref, weight, created_at
  ) VALUES (
    p_user_id, p_company_id, p_course_id, p_scenario_id, p_session_id, v_key, v_text, p_objective_id,
    p_result, left(p_detail, 240), p_source, coalesce(p_server_verified, false), round(v_o::numeric, 6),
    CASE WHEN p_difficulty BETWEEN 1 AND 3 THEN p_difficulty ELSE NULL END,
    left(p_item_ref, 200), round(v_w::numeric, 6), v_at
  );

  -- Make sure the mastery row exists, then lock it: concurrent writers for the same objective serialise here.
  INSERT INTO public.learner_mastery (user_id, company_id, course_id, objective_key, objective_text, objective_id)
  VALUES (p_user_id, p_company_id, p_course_id, v_key, v_text, p_objective_id)
  ON CONFLICT (company_id, user_id, objective_key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.learner_mastery
  WHERE company_id = p_company_id AND user_id = p_user_id AND objective_key = v_key
  FOR UPDATE;

  v_gap := CASE WHEN v_row.last_evidence_at IS NULL THEN 0
                ELSE greatest(0, extract(epoch FROM (v_at - v_row.last_evidence_at)) / 86400.0) END;
  v_mass := coalesce(v_row.evidence_mass, 0)::double precision * exp(-v_gap / 60.0) + v_w;
  v_conf := greatest(0, least(1, 1 - exp(-greatest(0, v_mass) / 3.0)));

  v_p := v_row.p_mastery::double precision;
  -- Legacy row not yet backfilled (has evidence, no v2 state): start from its legacy level.
  IF v_p IS NULL AND coalesce(v_row.evidence_count, 0) > 0 AND coalesce(v_row.evidence_mass, 0) = 0 THEN
    v_p := (ARRAY[0.15, 0.4, 0.65, 0.85])[greatest(0, least(3, coalesce(v_row.level, 0))) + 1];
  END IF;
  v_stab := least(365, greatest(1, coalesce(nullif(v_row.stability_days, 0), 1)::double precision));
  v_spaced := coalesce(v_row.spaced_reviews, 0);
  v_sources := coalesce(v_row.evidence_sources, '{}'::text[]);

  IF p_source <> 'self_report' THEN
    v_first := v_p IS NULL;
    v_base := coalesce(v_p, 0.3);
    v_alpha := CASE WHEN v_first THEN 0.35 ELSE 0.25 END;
    v_p := greatest(0, least(1, v_base + v_alpha * v_w * (v_o - v_base)));

    IF NOT v_first THEN
      IF v_o >= 0.75 AND v_gap >= 0.5 * v_stab THEN
        v_stab := v_stab * (2.0 + 0.5 * least(1, v_w));
        v_spaced := v_spaced + 1;
      ELSIF v_o < 0.5 THEN
        v_stab := greatest(1, v_stab * 0.5);
      END IF;
    END IF;
    v_stab := least(365, v_stab);

    IF p_source <> 'legacy_ai' AND NOT (p_source = ANY (v_sources)) THEN
      SELECT array_agg(s ORDER BY s COLLATE "C") INTO v_sources FROM unnest(v_sources || p_source) AS s;
    END IF;
  END IF;

  -- Status (p_eff = p at write time, t = 0)
  IF v_p IS NULL THEN
    v_status := 'unseen';
  ELSIF v_p >= 0.8 AND v_conf >= 0.5 AND (cardinality(v_sources) >= 2 OR v_spaced >= 1) THEN
    v_status := 'secure';
  ELSIF v_row.secured_at IS NOT NULL AND v_p >= 0.7 AND v_conf >= 0.5 THEN
    v_status := 'secure';
  ELSIF v_row.secured_at IS NOT NULL AND v_p < 0.7 THEN
    v_status := 'needs_review';
  ELSIF v_p < 0.4 THEN
    v_status := 'learning';
  ELSE
    v_status := 'practising';
  END IF;

  v_secured := coalesce(v_row.secured_at, CASE WHEN v_status = 'secure' THEN v_at ELSE NULL END);
  v_next := CASE WHEN v_p IS NULL THEN v_row.next_review_at
                 ELSE v_at + make_interval(secs => v_stab * ln(1 / 0.85) * 86400) END;
  v_level := CASE WHEN v_p IS NULL THEN 0
                  WHEN v_p < 0.25 THEN 0 WHEN v_p < 0.5 THEN 1 WHEN v_p < 0.8 THEN 2 ELSE 3 END;

  UPDATE public.learner_mastery SET
    objective_text   = v_text,
    objective_id     = coalesce(p_objective_id, objective_id),
    course_id        = coalesce(course_id, p_course_id),
    level            = v_level,
    evidence_count   = evidence_count + 1,
    last_result      = p_result,
    last_evidence_at = v_at,
    p_mastery        = CASE WHEN v_p IS NULL THEN NULL ELSE round(v_p::numeric, 6) END,
    confidence       = round(v_conf::numeric, 6),
    evidence_mass    = round(v_mass::numeric, 6),
    stability_days   = round(v_stab::numeric, 6),
    next_review_at   = v_next,
    status           = v_status,
    evidence_sources = v_sources,
    spaced_reviews   = v_spaced,
    secured_at       = v_secured
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.record_evidence(text, text, text, text, text, text, boolean, numeric, smallint, uuid, uuid, uuid, uuid, text, text, timestamptz) IS
  'Inserts one learner_evidence row and updates learner_mastery in the same transaction (row lock). Rule: Architecture §4.2; mirror of src/lib/tutor/learner/knowledge.ts.';

-- Many items in ONE transaction. Locks are taken in objective_key order (consistent ordering avoids
-- deadlocks between concurrent batches); within one key, items keep their given order. Returns the
-- mastery row after each item (the last row per key is the final state).
CREATE OR REPLACE FUNCTION public.record_evidence_batch(p_items jsonb)
RETURNS SETOF public.learner_mastery
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_row  public.learner_mastery;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'record_evidence_batch: p_items must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'record_evidence_batch: at most 200 items' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT t.value
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(value, ord)
    ORDER BY coalesce(lower(nullif(t.value ->> 'objective_id', '')), t.value ->> 'objective_key'), t.ord
  LOOP
    v_row := public.record_evidence(
      p_user_id         => v_item ->> 'user_id',
      p_company_id      => v_item ->> 'company_id',
      p_objective_key   => v_item ->> 'objective_key',
      p_objective_text  => v_item ->> 'objective_text',
      p_result          => v_item ->> 'result',
      p_source          => coalesce(v_item ->> 'source', 'teacher_judgement'),
      p_server_verified => coalesce((v_item ->> 'server_verified')::boolean, false),
      p_score           => (v_item ->> 'score')::numeric,
      p_difficulty      => (v_item ->> 'difficulty')::smallint,
      p_objective_id    => nullif(v_item ->> 'objective_id', '')::uuid,
      p_course_id       => nullif(v_item ->> 'course_id', '')::uuid,
      p_scenario_id     => nullif(v_item ->> 'scenario_id', '')::uuid,
      p_session_id      => nullif(v_item ->> 'session_id', '')::uuid,
      p_item_ref        => v_item ->> 'item_ref',
      p_detail          => v_item ->> 'detail',
      p_at              => coalesce((v_item ->> 'at')::timestamptz, now())
    );
    RETURN NEXT v_row;
  END LOOP;
  RETURN;
END;
$$;

-- Server-only: learners must never mint their own evidence through PostgREST.
REVOKE ALL ON FUNCTION public.record_evidence(text, text, text, text, text, text, boolean, numeric, smallint, uuid, uuid, uuid, uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_evidence_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_evidence(text, text, text, text, text, text, boolean, numeric, smallint, uuid, uuid, uuid, uuid, text, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_evidence_batch(jsonb) TO service_role;

COMMIT;
