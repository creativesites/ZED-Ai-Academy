-- SQL/TS parity + behaviour test for record_evidence() (AI Teacher P2-02).
--
-- UNVERIFIED: written without a local Postgres. Runs on the throwaway harness from README.md, after the
-- mastery and v2 migrations:
--
--   createdb zai_tutor_test
--   psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/tests/tutor/00_stubs.sql
--   psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/tests/tutor/01_baseline.sql
--   psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/migrations/20261101000000_zai_tutor.sql
--   psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/migrations/20261123000000_learner_mastery.sql
--   psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/migrations/20261125000200_learning_objectives.sql
--   psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/migrations/20261125000201_evidence_v2.sql
--   psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/migrations/20261125000201_evidence_v2.sql   # idempotency
--   psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/tests/tutor/knowledge_parity_test.sql   # run from repo root
--   dropdb zai_tutor_test
--
-- The fixtures are the same file the TS tests use (src/lib/tutor/learner/knowledge.test.ts).
-- Concurrency (no lost updates) needs two sessions; see the manual check at the bottom.

\set ON_ERROR_STOP on
\set fixtures `cat supabase/tests/tutor/fixtures/knowledge_parity.json`

BEGIN;

INSERT INTO public.profiles (id) VALUES ('u_parity'), ('u_other') ON CONFLICT DO NOTHING;
INSERT INTO public.companies (id, name, slug) VALUES ('co_parity', 'Parity', 'parity'), ('co_other', 'Other', 'other-parity')
  ON CONFLICT DO NOTHING;

CREATE TEMP TABLE parity_fixtures AS SELECT :'fixtures'::jsonb AS doc;

DO $$
DECLARE
  v_doc   jsonb := (SELECT doc FROM parity_fixtures);
  v_tol   double precision := (v_doc ->> 'tolerance')::double precision;
  v_case  jsonb;
  v_ev    jsonb;
  v_idx   integer := 0;
  v_key   text;
  v_row   public.learner_mastery;
  v_exp   jsonb;
  v_fail  integer := 0;
BEGIN
  FOR v_case IN SELECT value FROM jsonb_array_elements(v_doc -> 'cases') LOOP
    v_idx := v_idx + 1;
    v_key := 'parity:' || v_idx;
    v_exp := v_case -> 'expected';

    FOR v_ev IN SELECT value FROM jsonb_array_elements(v_case -> 'evidence') LOOP
      PERFORM public.record_evidence(
        p_user_id => 'u_parity',
        p_company_id => 'co_parity',
        p_objective_key => v_key,
        p_objective_text => v_case ->> 'name',
        p_result => v_ev ->> 'result',
        p_source => v_ev ->> 'source',
        p_server_verified => (v_ev ->> 'serverVerified')::boolean,
        p_score => (v_ev ->> 'score')::numeric,
        p_difficulty => (v_ev ->> 'difficulty')::smallint,
        p_at => (v_ev ->> 'at')::timestamptz
      );
    END LOOP;

    SELECT * INTO v_row FROM public.learner_mastery
    WHERE company_id = 'co_parity' AND user_id = 'u_parity' AND objective_key = v_key;

    IF jsonb_array_length(v_case -> 'evidence') = 0 THEN
      IF v_row.id IS NOT NULL THEN
        RAISE WARNING 'FAIL %: expected no mastery row', v_case ->> 'name'; v_fail := v_fail + 1;
      ELSE
        RAISE NOTICE 'PASS %', v_case ->> 'name';
      END IF;
      CONTINUE;
    END IF;

    IF NOT (
      ((v_exp -> 'pMastery') = 'null'::jsonb AND v_row.p_mastery IS NULL
        OR abs(v_row.p_mastery - (v_exp ->> 'pMastery')::numeric) <= v_tol)
      AND abs(v_row.confidence - (v_exp ->> 'confidence')::numeric) <= v_tol
      AND abs(v_row.evidence_mass - (v_exp ->> 'evidenceMass')::numeric) <= v_tol
      AND abs(v_row.stability_days - (v_exp ->> 'stabilityDays')::numeric) <= v_tol
      AND v_row.evidence_count = (v_exp ->> 'evidenceCount')::integer
      AND v_row.evidence_sources = ARRAY(SELECT jsonb_array_elements_text(v_exp -> 'evidenceSources'))
      AND v_row.spaced_reviews = (v_exp ->> 'spacedReviews')::integer
      AND v_row.status = v_exp ->> 'status'
      AND v_row.secured_at IS NOT DISTINCT FROM (v_exp ->> 'securedAt')::timestamptz
      AND (v_exp -> 'nextReviewAt' = 'null'::jsonb AND v_row.next_review_at IS NULL
        OR abs(extract(epoch FROM v_row.next_review_at - (v_exp ->> 'nextReviewAt')::timestamptz)) < 1)
      AND v_row.level = (v_exp ->> 'legacyLevel')::integer
    ) THEN
      RAISE WARNING 'FAIL %: got p=% conf=% mass=% stab=% n=% src=% spaced=% status=% secured=% next=% level=%, want %',
        v_case ->> 'name', v_row.p_mastery, v_row.confidence, v_row.evidence_mass, v_row.stability_days,
        v_row.evidence_count, v_row.evidence_sources, v_row.spaced_reviews, v_row.status, v_row.secured_at,
        v_row.next_review_at, v_row.level, v_exp;
      v_fail := v_fail + 1;
    ELSE
      RAISE NOTICE 'PASS %', v_case ->> 'name';
    END IF;
  END LOOP;

  IF v_fail > 0 THEN
    RAISE EXCEPTION '% parity case(s) failed', v_fail;
  END IF;
END $$;

-- Behaviour checks beyond the fixtures.
DO $$
DECLARE
  v_obj uuid;
  v_row public.learner_mastery;
  v_n   bigint;
  v_err boolean;
BEGIN
  -- Registered objectives are keyed by id; a foreign tenant's objective is refused.
  INSERT INTO public.courses (company_id, slug, title) VALUES ('co_parity', 'parity-course', 'Parity course');
  INSERT INTO public.learning_objectives (company_id, course_id, code, text)
    SELECT 'co_parity', id, 'O1', '学习者能够数到十' FROM public.courses WHERE slug = 'parity-course'
    RETURNING id INTO v_obj;

  v_row := public.record_evidence(
    p_user_id => 'u_parity', p_company_id => 'co_parity', p_objective_key => 'ignored', p_objective_text => '学习者能够数到十',
    p_result => 'correct', p_source => 'quiz', p_server_verified => true, p_objective_id => v_obj, p_item_ref => 'q-1');
  IF v_row.objective_key <> v_obj::text OR v_row.objective_id <> v_obj THEN
    RAISE EXCEPTION 'FAIL registered objective keyed by id (got %)', v_row.objective_key;
  END IF;
  SELECT count(*) INTO v_n FROM public.learner_evidence
    WHERE objective_id = v_obj AND source = 'quiz' AND server_verified AND weight = 1 AND score = 1 AND item_ref = 'q-1';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL evidence row v2 columns (%)', v_n; END IF;
  RAISE NOTICE 'PASS registered objective keyed by id with v2 evidence row';

  BEGIN
    PERFORM public.record_evidence(
      p_user_id => 'u_other', p_company_id => 'co_other', p_objective_key => 'x', p_objective_text => 'x',
      p_result => 'correct', p_source => 'quiz', p_objective_id => v_obj);
    v_err := false;
  EXCEPTION WHEN others THEN v_err := true;
  END;
  IF NOT v_err THEN RAISE EXCEPTION 'FAIL cross-tenant objective accepted'; END IF;
  RAISE NOTICE 'PASS cross-tenant objective refused';

  -- Invalid source / result are refused.
  BEGIN
    PERFORM public.record_evidence('u_parity', 'co_parity', 'k', 't', 'correct', 'opinion');
    v_err := false;
  EXCEPTION WHEN others THEN v_err := true;
  END;
  IF NOT v_err THEN RAISE EXCEPTION 'FAIL invalid source accepted'; END IF;
  RAISE NOTICE 'PASS invalid source refused';

  -- Same legacy key in two tenants is now allowed (unique key includes company_id).
  PERFORM public.record_evidence('u_parity', 'co_other', 'parity:1', 't', 'correct', 'quiz', true);
  SELECT count(*) INTO v_n FROM public.learner_mastery WHERE user_id = 'u_parity' AND objective_key = 'parity:1';
  IF v_n <> 2 THEN RAISE EXCEPTION 'FAIL per-tenant mastery rows (%)', v_n; END IF;
  RAISE NOTICE 'PASS unique key includes company_id';

  -- Legacy (not backfilled) row starts from its level, not from the prior.
  INSERT INTO public.learner_mastery (user_id, company_id, objective_key, objective_text, level, evidence_count)
    VALUES ('u_parity', 'co_parity', 'legacy:1', 'legacy', 2, 3);
  v_row := public.record_evidence('u_parity', 'co_parity', 'legacy:1', 'legacy', 'correct', 'quiz', true);
  IF abs(v_row.p_mastery - 0.7375) > 1e-6 OR v_row.evidence_count <> 4 THEN
    RAISE EXCEPTION 'FAIL legacy seeding (p=% n=%)', v_row.p_mastery, v_row.evidence_count;
  END IF;
  RAISE NOTICE 'PASS legacy row seeded from level';

  -- Batch: one transaction, final state per key; order within a key preserved.
  PERFORM * FROM public.record_evidence_batch(jsonb_build_array(
    jsonb_build_object('user_id', 'u_parity', 'company_id', 'co_parity', 'objective_key', 'batch:b', 'objective_text', 'b',
                       'result', 'correct', 'source', 'quiz', 'server_verified', true, 'at', '2026-01-01T09:00:00Z'),
    jsonb_build_object('user_id', 'u_parity', 'company_id', 'co_parity', 'objective_key', 'batch:a', 'objective_text', 'a',
                       'result', 'misconception', 'source', 'quiz', 'server_verified', true, 'at', '2026-01-01T09:00:00Z'),
    jsonb_build_object('user_id', 'u_parity', 'company_id', 'co_parity', 'objective_key', 'batch:b', 'objective_text', 'b',
                       'result', 'misconception', 'source', 'quiz', 'server_verified', true, 'at', '2026-01-01T09:01:00Z')
  ));
  SELECT * INTO v_row FROM public.learner_mastery WHERE company_id = 'co_parity' AND user_id = 'u_parity' AND objective_key = 'batch:b';
  IF v_row.evidence_count <> 2 OR v_row.last_result <> 'misconception' THEN
    RAISE EXCEPTION 'FAIL batch order within key (n=% last=%)', v_row.evidence_count, v_row.last_result;
  END IF;
  RAISE NOTICE 'PASS batch';
END $$;

-- Learners cannot call the functions through PostgREST.
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.record_evidence_batch(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.record_evidence_batch(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL record_evidence_batch executable by client roles';
  END IF;
  RAISE NOTICE 'PASS record_evidence functions are server-only';
END $$;

ROLLBACK;

-- Manual concurrency check (no lost updates), two psql sessions against the same test DB:
--   A: BEGIN; SELECT public.record_evidence('u_parity','co_parity','race:1','r','correct','quiz',true);
--   B: SELECT public.record_evidence('u_parity','co_parity','race:1','r','correct','quiz',true);  -- blocks on the row lock
--   A: COMMIT;   -- B now proceeds on A's committed state
--   SELECT evidence_count FROM learner_mastery WHERE objective_key = 'race:1';  -- expect 2
