-- RLS, constraint and trigger behaviour tests for 20261101000000_zai_tutor.sql.
-- Runs in one transaction and rolls back. Seeds as the superuser (bypasses RLS), then
-- impersonates roles the way PostgREST does: SET ROLE + request.jwt.claims.
BEGIN;

GRANT ALL ON storage.objects TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

CREATE OR REPLACE FUNCTION pg_temp.chk(label text, got bigint, want bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'FAIL %: got %, want %', label, got, want;
  END IF;
  RAISE NOTICE 'PASS %', label;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.chk_like(label text, got text, pattern text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS NULL OR got NOT LIKE pattern THEN
    RAISE EXCEPTION 'FAIL %: message % does not match %', label, got, pattern;
  END IF;
  RAISE NOTICE 'PASS %', label;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.as_count(p_role text, p_sub text, p_sql text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', coalesce(json_build_object('sub', p_sub)::text, '{}'), false);
  EXECUTE format('SET ROLE %I', p_role);
  EXECUTE p_sql INTO v;
  RESET ROLE;
  RETURN v;
END $$;

-- True when the statement raises an error as the given role.
CREATE OR REPLACE FUNCTION pg_temp.as_error(p_role text, p_sub text, p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', coalesce(json_build_object('sub', p_sub)::text, '{}'), false);
  EXECUTE format('SET ROLE %I', p_role);
  BEGIN
    EXECUTE p_sql;
    RESET ROLE;
    RETURN false;
  EXCEPTION WHEN others THEN
    RESET ROLE;
    RETURN true;
  END;
END $$;

-- True when the statement raises an error as the superuser (CHECK / UNIQUE / trigger tests).
CREATE OR REPLACE FUNCTION pg_temp.err(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RETURN false;
  EXCEPTION WHEN others THEN
    RETURN true;
  END;
END $$;

-- The error message raised by the statement as the superuser (NULL when it succeeds).
CREATE OR REPLACE FUNCTION pg_temp.err_msg(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN SQLERRM;
END $$;

-- ---------- SEED (superuser) ----------
INSERT INTO public.profiles (id) VALUES
  ('admin_x'), ('teacher_t'), ('instructor_i'), ('learner_a'), ('learner_b'),
  ('learner_c'), ('learner_d'), ('outsider_o'), ('platform_admin');

INSERT INTO public.companies (id, name, slug) VALUES
  ('co_a', 'Academy A', 'co-a'),
  ('co_b', 'Academy B', 'co-b'),
  ('org_platform', 'Zed AI Academy', 'zedai');

INSERT INTO public.company_members (company_id, profile_id, status, role) VALUES
  ('co_a', 'admin_x', 'active', 'company_admin'),
  ('co_a', 'teacher_t', 'active', 'teacher'),
  ('co_a', 'instructor_i', 'active', 'instructor'),
  ('co_a', 'learner_a', 'active', 'learner'),
  ('co_a', 'learner_b', 'active', 'learner'),
  ('co_a', 'learner_d', 'deactivated', 'learner'),
  ('co_b', 'learner_c', 'active', 'learner'),
  ('org_platform', 'platform_admin', 'active', 'company_admin');

INSERT INTO public.classroom_groups (id, company_id, name) VALUES
  ('11111111-0000-0000-0000-000000000001', 'co_a', 'Group A1'),
  ('11111111-0000-0000-0000-000000000002', 'co_b', 'Group B1');

INSERT INTO public.classroom_group_members (group_id, profile_id) VALUES
  ('11111111-0000-0000-0000-000000000001', 'learner_a');

INSERT INTO public.courses (id, company_id, slug, title, instructor_id) VALUES
  ('22222222-0000-0000-0000-000000000001', 'co_a', 'mandarin-1', 'Mandarin 1', 'admin_x');
INSERT INTO public.modules (id, course_id, title, position) VALUES
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'M1', 1);
INSERT INTO public.lessons (id, module_id, title, position) VALUES
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'L1', 1);

INSERT INTO public.ai_personas (id, company_id, name, personality_prompt) VALUES
  ('55555555-0000-0000-0000-000000000001', 'co_a', 'Lin', 'Tea-house teacher'),
  ('55555555-0000-0000-0000-000000000002', 'org_platform', 'Sofia', 'Market teacher');

INSERT INTO public.practice_scenarios (id, company_id, skill_pack, persona_id, title, goal, visibility, status) VALUES
  ('66666666-0000-0000-0000-000000000001', 'co_a', 'language-zh', '55555555-0000-0000-0000-000000000001', 'Tea house', 'Order tea', 'tenant_library', 'published'),
  ('66666666-0000-0000-0000-000000000002', 'co_a', 'language-zh', NULL, 'Draft one', 'Draft', 'tenant_library', 'draft'),
  ('66666666-0000-0000-0000-000000000003', 'org_platform', 'general-tutor', '55555555-0000-0000-0000-000000000002', 'Market', 'Buy fruit', 'platform', 'published');

INSERT INTO public.tutor_assignments (id, company_id, scenario_id, group_id) VALUES
  ('77777777-0000-0000-0000-000000000001', 'co_a', '66666666-0000-0000-0000-000000000001', NULL),
  ('77777777-0000-0000-0000-000000000002', 'co_a', '66666666-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001');

INSERT INTO public.tutor_sessions (id, company_id, user_id, origin, mode, status, shared_with_teacher, lesson_id, assignment_id) VALUES
  ('88888888-0000-0000-0000-000000000001', 'co_a', 'learner_a', 'practice',   'text', 'active',    false, NULL, NULL),
  ('88888888-0000-0000-0000-000000000002', 'co_a', 'learner_a', 'lesson',     'voice', 'completed', false, '44444444-0000-0000-0000-000000000001', NULL),
  ('88888888-0000-0000-0000-000000000003', 'co_a', 'learner_b', 'practice',   'text', 'active',    false, NULL, NULL),
  ('88888888-0000-0000-0000-000000000004', 'co_a', 'learner_a', 'practice',   'live', 'active',    true,  NULL, NULL),
  ('88888888-0000-0000-0000-000000000005', 'co_a', 'learner_a', 'practice',   'live', 'flagged',   false, NULL, NULL),
  ('88888888-0000-0000-0000-000000000006', 'co_a', 'learner_a', 'assignment', 'text', 'active',    false, NULL, '77777777-0000-0000-0000-000000000001'),
  ('88888888-0000-0000-0000-000000000007', 'co_b', 'learner_c', 'practice',   'text', 'active',    false, NULL, NULL);

INSERT INTO public.tutor_turns (session_id, idx, learner_text) VALUES
  ('88888888-0000-0000-0000-000000000001', 1, 'a1'),
  ('88888888-0000-0000-0000-000000000002', 1, 'a2'),
  ('88888888-0000-0000-0000-000000000003', 1, 'b1'),
  ('88888888-0000-0000-0000-000000000004', 1, 'a4'),
  ('88888888-0000-0000-0000-000000000005', 1, 'a5'),
  ('88888888-0000-0000-0000-000000000006', 1, 'a6'),
  ('88888888-0000-0000-0000-000000000007', 1, 'c7');

INSERT INTO public.tutor_reports (session_id, scores) VALUES
  ('88888888-0000-0000-0000-000000000001', '{"fluency":70}'),
  ('88888888-0000-0000-0000-000000000002', '{"fluency":80}');

INSERT INTO public.learner_language_profiles (company_id, user_id, language, level_estimate) VALUES
  ('co_a', 'learner_a', 'zh', 'HSK2'),
  ('co_a', 'learner_b', 'zh', 'HSK1'),
  ('co_b', 'learner_c', 'zh', 'HSK1');

INSERT INTO public.vocab_items (id, company_id, language, term) VALUES
  ('99999999-0000-0000-0000-000000000001', 'co_a', 'zh', 'nihao');

INSERT INTO public.learner_vocab (user_id, vocab_id, company_id, source) VALUES
  ('learner_a', '99999999-0000-0000-0000-000000000001', 'co_a', 'manual');

INSERT INTO public.tutor_settings (company_id, free_practice_minutes_per_month) VALUES
  ('co_a', 60);

INSERT INTO public.ai_usage_ledger (company_id, user_id, model, kind, units, unit) VALUES
  ('co_a', 'learner_a', 'gemini-test', 'llm', 100, 'tokens'),
  ('co_b', 'learner_c', 'gemini-test', 'llm', 50, 'tokens');

-- Storage objects (superuser). Real Supabase creates these via the storage API.
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('tutor-audio', 'learner_a/88888888-0000-0000-0000-000000000001/clip.webm'), -- practice: private
  ('tutor-audio', 'learner_a/88888888-0000-0000-0000-000000000002/clip.webm'), -- lesson: staff-visible
  ('tutor-audio', 'learner_a/not-a-uuid/clip.webm'),                           -- malformed folder
  ('tutor-audio', 'learner_a/99999999-9999-4999-8999-999999999999/clip.webm'), -- uuid, no such session
  ('tutor-tts-cache', 'hash/abc.mp3');

-- ---------- READ TESTS ----------
DO $$
BEGIN
  -- Sessions: own rows for learners, privacy split for staff.
  PERFORM pg_temp.chk('learner_a sees own 5 sessions', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.tutor_sessions'), 5);
  PERFORM pg_temp.chk('learner_b sees only own 1 session', pg_temp.as_count('authenticated','learner_b','SELECT count(*) FROM public.tutor_sessions'), 1);
  PERFORM pg_temp.chk('learner_c sees only co_b session', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM public.tutor_sessions'), 1);
  PERFORM pg_temp.chk('outsider sees 0 sessions', pg_temp.as_count('authenticated','outsider_o','SELECT count(*) FROM public.tutor_sessions'), 0);
  PERFORM pg_temp.chk('deactivated learner_d sees 0 sessions', pg_temp.as_count('authenticated','learner_d','SELECT count(*) FROM public.tutor_sessions'), 0);
  PERFORM pg_temp.chk('teacher sees lesson/assignment/shared/flagged = 4', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_sessions'), 4);
  PERFORM pg_temp.chk('instructor sees same 4', pg_temp.as_count('authenticated','instructor_i','SELECT count(*) FROM public.tutor_sessions'), 4);
  PERFORM pg_temp.chk('admin sees same 4', pg_temp.as_count('authenticated','admin_x','SELECT count(*) FROM public.tutor_sessions'), 4);
  PERFORM pg_temp.chk('teacher of co_a cannot see co_b session', pg_temp.as_count('authenticated','admin_x','SELECT count(*) FROM public.tutor_sessions WHERE company_id = ''co_b'''), 0);
  PERFORM pg_temp.chk('teacher cannot see private practice session of learner_a', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_sessions WHERE id = ''88888888-0000-0000-0000-000000000001'''), 0);

  -- Turns follow the same split.
  PERFORM pg_temp.chk('learner_a sees own 5 turns', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.tutor_turns'), 5);
  PERFORM pg_temp.chk('learner_b sees own 1 turn', pg_temp.as_count('authenticated','learner_b','SELECT count(*) FROM public.tutor_turns'), 1);
  PERFORM pg_temp.chk('outsider sees 0 turns', pg_temp.as_count('authenticated','outsider_o','SELECT count(*) FROM public.tutor_turns'), 0);
  PERFORM pg_temp.chk('teacher sees 4 turns (privacy split)', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_turns'), 4);
  PERFORM pg_temp.chk('teacher cannot read private practice turn', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_turns WHERE learner_text = ''a1'''), 0);

  -- Reports.
  PERFORM pg_temp.chk('learner_a sees own 2 reports', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.tutor_reports'), 2);
  PERFORM pg_temp.chk('teacher sees 1 report (lesson only)', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_reports'), 1);
  PERFORM pg_temp.chk('learner_b sees 0 reports', pg_temp.as_count('authenticated','learner_b','SELECT count(*) FROM public.tutor_reports'), 0);

  -- Scenarios.
  PERFORM pg_temp.chk('learner_a sees published tenant + platform scenarios = 2', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.practice_scenarios'), 2);
  PERFORM pg_temp.chk('teacher sees tenant drafts too + platform = 3', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.practice_scenarios'), 3);
  PERFORM pg_temp.chk('outsider sees only platform scenario = 1', pg_temp.as_count('authenticated','outsider_o','SELECT count(*) FROM public.practice_scenarios'), 1);
  PERFORM pg_temp.chk('learner_c (other tenant) sees only platform scenario = 1', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM public.practice_scenarios'), 1);
  PERFORM pg_temp.chk('learner_a sees no draft scenario', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.practice_scenarios WHERE status = ''draft'''), 0);
  PERFORM pg_temp.chk('anon sees 0 scenarios (authenticated only)', pg_temp.as_count('anon', NULL, 'SELECT count(*) FROM public.practice_scenarios'), 0);

  -- Personas.
  PERFORM pg_temp.chk('learner_a sees own persona + platform persona = 2', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.ai_personas'), 2);
  PERFORM pg_temp.chk('outsider sees only the platform persona = 1', pg_temp.as_count('authenticated','outsider_o','SELECT count(*) FROM public.ai_personas'), 1);
  PERFORM pg_temp.chk('learner_c sees platform persona only = 1', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM public.ai_personas'), 1);

  -- Assignments.
  PERFORM pg_temp.chk('learner_a sees both assignments = 2', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.tutor_assignments'), 2);
  PERFORM pg_temp.chk('learner_b sees academy-wide assignment only = 1', pg_temp.as_count('authenticated','learner_b','SELECT count(*) FROM public.tutor_assignments'), 1);
  PERFORM pg_temp.chk('learner_c (other tenant) sees 0 assignments', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM public.tutor_assignments'), 0);
  PERFORM pg_temp.chk('teacher sees both assignments = 2', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_assignments'), 2);

  -- Vocab and learner SRS rows. Staff have NO access to learner_vocab.
  PERFORM pg_temp.chk('learner_a sees own SRS row = 1', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.learner_vocab'), 1);
  PERFORM pg_temp.chk('learner_b sees 0 SRS rows', pg_temp.as_count('authenticated','learner_b','SELECT count(*) FROM public.learner_vocab'), 0);
  PERFORM pg_temp.chk('teacher sees 0 learner_vocab rows (no staff access)', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.learner_vocab'), 0);
  PERFORM pg_temp.chk('admin sees 0 learner_vocab rows (no staff access)', pg_temp.as_count('authenticated','admin_x','SELECT count(*) FROM public.learner_vocab'), 0);
  PERFORM pg_temp.chk('learner_a reads vocab items of tenant = 1', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.vocab_items'), 1);
  PERFORM pg_temp.chk('outsider reads vocab items = 0', pg_temp.as_count('authenticated','outsider_o','SELECT count(*) FROM public.vocab_items'), 0);

  -- Learner language profiles: learners read own; tenant staff read profiles of their tenant's learners.
  PERFORM pg_temp.chk('learner_a reads own language profile = 1', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.learner_language_profiles'), 1);
  PERFORM pg_temp.chk('learner_b cannot read learner_a profile', pg_temp.as_count('authenticated','learner_b','SELECT count(*) FROM public.learner_language_profiles WHERE user_id = ''learner_a'''), 0);
  PERFORM pg_temp.chk('teacher reads co_a learner profiles = 2', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.learner_language_profiles'), 2);
  PERFORM pg_temp.chk('instructor reads co_a learner profiles = 2', pg_temp.as_count('authenticated','instructor_i','SELECT count(*) FROM public.learner_language_profiles'), 2);
  PERFORM pg_temp.chk('teacher cannot read co_b learner profile = 0', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.learner_language_profiles WHERE company_id = ''co_b'''), 0);
  PERFORM pg_temp.chk('learner_c cannot read co_a profiles = 0', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM public.learner_language_profiles WHERE company_id = ''co_a'''), 0);
  PERFORM pg_temp.chk('outsider reads profiles = 0', pg_temp.as_count('authenticated','outsider_o','SELECT count(*) FROM public.learner_language_profiles'), 0);

  -- Settings and usage ledger.
  PERFORM pg_temp.chk('learner_a reads tutor settings = 1', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.tutor_settings'), 1);
  PERFORM pg_temp.chk('outsider reads tutor settings = 0', pg_temp.as_count('authenticated','outsider_o','SELECT count(*) FROM public.tutor_settings'), 0);
  PERFORM pg_temp.chk('teacher reads co_a usage ledger = 1', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.ai_usage_ledger'), 1);
  PERFORM pg_temp.chk('admin reads usage ledger = 1', pg_temp.as_count('authenticated','admin_x','SELECT count(*) FROM public.ai_usage_ledger'), 1);
  PERFORM pg_temp.chk('learner_a reads own ledger row = 1', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.ai_usage_ledger'), 1);
  PERFORM pg_temp.chk('learner_b reads ledger = 0', pg_temp.as_count('authenticated','learner_b','SELECT count(*) FROM public.ai_usage_ledger'), 0);
  PERFORM pg_temp.chk('learner_c reads own co_b ledger row = 1', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM public.ai_usage_ledger'), 1);
  PERFORM pg_temp.chk('learner_c cannot read co_a ledger rows = 0', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM public.ai_usage_ledger WHERE company_id = ''co_a'''), 0);

  -- Exam frameworks: signed-in read only.
  PERFORM pg_temp.chk('authenticated reads 5 exam frameworks', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.exam_frameworks'), 5);
  PERFORM pg_temp.chk('anon reads 0 exam frameworks', pg_temp.as_count('anon', NULL, 'SELECT count(*) FROM public.exam_frameworks'), 0);

  -- Storage: tutor-audio per learner folder, plus staff read for staff-visible sessions only.
  PERFORM pg_temp.chk('learner_a sees own tutor audio = 4', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-audio'''), 4);
  PERFORM pg_temp.chk('learner_b sees no tutor audio of learner_a = 0', pg_temp.as_count('authenticated','learner_b','SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-audio'''), 0);
  PERFORM pg_temp.chk('teacher reads audio of staff-visible lesson session only = 1', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-audio'''), 1);
  PERFORM pg_temp.chk('teacher cannot read audio of private practice session = 0', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-audio'' AND name LIKE ''%88888888-0000-0000-0000-000000000001%'''), 0);
  PERFORM pg_temp.chk('instructor reads audio of staff-visible lesson session = 1', pg_temp.as_count('authenticated','instructor_i','SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-audio'''), 1);
  PERFORM pg_temp.chk('learner_c (other tenant) reads no tutor audio = 0', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-audio'''), 0);
  PERFORM pg_temp.chk('anon reads tts cache = 1', pg_temp.as_count('anon', NULL, 'SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-tts-cache'''), 1);
  PERFORM pg_temp.chk('anon cannot read tutor audio = 0', pg_temp.as_count('anon', NULL, 'SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-audio'''), 0);
END $$;

-- ---------- WRITE DENIALS ----------
DO $$
BEGIN
  PERFORM pg_temp.chk('learner_a cannot insert session for learner_b', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO public.tutor_sessions (company_id, user_id, origin, mode) VALUES ('co_a','learner_b','practice','text')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_c cannot insert session into co_a (not a member)', pg_temp.as_error('authenticated','learner_c', $q$INSERT INTO public.tutor_sessions (company_id, user_id, origin, mode) VALUES ('co_a','learner_c','practice','text')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_a can insert own session in co_a', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO public.tutor_sessions (company_id, user_id, origin, mode) VALUES ('co_a','learner_a','practice','text')$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('learner_a cannot insert turn into learner_b session', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO public.tutor_turns (session_id, idx) VALUES ('88888888-0000-0000-0000-000000000003', 9)$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_a cannot write a report', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO public.tutor_reports (session_id) VALUES ('88888888-0000-0000-0000-000000000001')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_b cannot insert SRS row for learner_a', pg_temp.as_error('authenticated','learner_b', $q$INSERT INTO public.learner_vocab (user_id, vocab_id, company_id, source) VALUES ('learner_a','99999999-0000-0000-0000-000000000001','co_a','manual')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_c cannot insert SRS row with co_b tenant pointing at co_a item', pg_temp.as_error('authenticated','learner_c', $q$INSERT INTO public.learner_vocab (user_id, vocab_id, company_id, source) VALUES ('learner_c','99999999-0000-0000-0000-000000000001','co_b','manual')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('teacher cannot write learner language profiles (staff read only)', pg_temp.as_error('authenticated','teacher_t', $q$INSERT INTO public.learner_language_profiles (company_id, user_id, language) VALUES ('co_a','learner_b','fr')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('teacher cannot update learner profile (silently 0 rows)', pg_temp.as_error('authenticated','teacher_t', $q$UPDATE public.learner_language_profiles SET streak_days = 99$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('learner_a profile streak unchanged after teacher update', (SELECT streak_days::bigint FROM public.learner_language_profiles WHERE user_id = 'learner_a'), 0);
  PERFORM pg_temp.chk('learner_a cannot write a learner profile for learner_b', pg_temp.as_error('authenticated','learner_a', $q$UPDATE public.learner_language_profiles SET streak_days = 5 WHERE user_id = 'learner_b'$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('learner_b profile unchanged by learner_a', (SELECT streak_days::bigint FROM public.learner_language_profiles WHERE user_id = 'learner_b'), 0);
  PERFORM pg_temp.chk('learner_a cannot insert exam framework', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO public.exam_frameworks (id, language, label) VALUES ('x','zh','x')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_a cannot insert usage ledger row', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO public.ai_usage_ledger (company_id, model, kind, units, unit) VALUES ('co_a','m','llm',1,'t')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('admin cannot insert usage ledger row (server only)', pg_temp.as_error('authenticated','admin_x', $q$INSERT INTO public.ai_usage_ledger (company_id, model, kind, units, unit) VALUES ('co_a','m','llm',1,'t')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_a cannot update own usage ledger row (silently 0 rows)', pg_temp.as_error('authenticated','learner_a', $q$UPDATE public.ai_usage_ledger SET units = 1$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('usage ledger unchanged after learner update', (SELECT units FROM public.ai_usage_ledger WHERE company_id = 'co_a'), 100);
  PERFORM pg_temp.chk('learner_a cannot create a scenario', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal) VALUES ('co_a','language-zh','t','g')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('teacher can create a scenario in co_a', pg_temp.as_error('authenticated','teacher_t', $q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal) VALUES ('co_a','language-zh','t','g')$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('admin cannot create a scenario in co_b', pg_temp.as_error('authenticated','admin_x', $q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal) VALUES ('co_b','language-zh','t','g')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('admin can assign to a co_a group', pg_temp.as_error('authenticated','admin_x', $q$INSERT INTO public.tutor_assignments (company_id, scenario_id, group_id) VALUES ('co_a','66666666-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001')$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('admin cannot assign to a co_b group', pg_temp.as_error('authenticated','admin_x', $q$INSERT INTO public.tutor_assignments (company_id, scenario_id, group_id) VALUES ('co_a','66666666-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_a cannot write tutor settings (silently filtered: 0 rows changed)', pg_temp.as_error('authenticated','learner_a', $q$UPDATE public.tutor_settings SET free_practice_minutes_per_month = 999$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('settings unchanged after learner update', (SELECT free_practice_minutes_per_month::bigint FROM public.tutor_settings WHERE company_id = 'co_a'), 60);
  PERFORM pg_temp.chk('admin can update tutor settings', pg_temp.as_error('authenticated','admin_x', $q$UPDATE public.tutor_settings SET free_practice_minutes_per_month = 90$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('settings updated by admin', (SELECT free_practice_minutes_per_month::bigint FROM public.tutor_settings WHERE company_id = 'co_a'), 90);
  PERFORM pg_temp.chk('learner_a cannot upload tutor audio into learner_b folder', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('tutor-audio','learner_b/x/clip.webm')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_a can upload tutor audio into own folder', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('tutor-audio','learner_a/x/clip.webm')$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('teacher cannot upload tutor audio (staff read only)', pg_temp.as_error('authenticated','teacher_t', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('tutor-audio','learner_a/88888888-0000-0000-0000-000000000002/teacher.webm')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('learner_a cannot write tts cache', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('tutor-tts-cache','hash/new.mp3')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('anon cannot write tts cache', pg_temp.as_error('anon', NULL, $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('tutor-tts-cache','hash/anon.mp3')$q$)::int::bigint, 1);
END $$;

-- ---------- PLATFORM-TENANT GUARD ----------
DO $$
BEGIN
  -- Trigger message checks run as the superuser so only the trigger decides.
  PERFORM pg_temp.chk_like('tenant cannot create a platform scenario (trigger message)',
    pg_temp.err_msg($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, visibility) VALUES ('co_a','x','t','g','platform')$q$),
    '%platform tenant%');
  PERFORM pg_temp.chk_like('tenant cannot promote its scenario to platform (trigger message)',
    pg_temp.err_msg($q$UPDATE public.practice_scenarios SET visibility = 'platform' WHERE id = '66666666-0000-0000-0000-000000000001'$q$),
    '%platform tenant%');
  PERFORM pg_temp.chk_like('platform scenario cannot use a co_a persona (trigger message)',
    pg_temp.err_msg($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, visibility, persona_id) VALUES ('org_platform','x','t','g','platform','55555555-0000-0000-0000-000000000001')$q$),
    '%persona%');
  PERFORM pg_temp.chk('platform scenario with platform persona is accepted (superuser)',
    (SELECT CASE WHEN pg_temp.err_msg($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, visibility, persona_id) VALUES ('org_platform','x','t','g','platform','55555555-0000-0000-0000-000000000002')$q$) IS NULL THEN 1 ELSE 0 END)::bigint, 1);
  PERFORM pg_temp.chk('teacher cannot create a platform scenario (RLS or trigger)', pg_temp.as_error('authenticated','teacher_t', $q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, visibility) VALUES ('co_a','x','t','g','platform')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('platform admin can create a platform scenario', pg_temp.as_error('authenticated','platform_admin', $q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, visibility, persona_id) VALUES ('org_platform','x','t2','g','platform','55555555-0000-0000-0000-000000000002')$q$)::int::bigint, 0);
  PERFORM pg_temp.chk('platform admin cannot use co_a persona in platform scenario', pg_temp.as_error('authenticated','platform_admin', $q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, visibility, persona_id) VALUES ('org_platform','x','t3','g','platform','55555555-0000-0000-0000-000000000001')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('platform guard trigger is installed', (SELECT count(*)::bigint FROM pg_trigger WHERE tgname = 'guard_platform_scenarios' AND NOT tgisinternal), 1);
END $$;

-- ---------- CHECK / UNIQUE CONSTRAINTS (superuser) ----------
DO $$
BEGIN
  PERFORM pg_temp.chk('max_minutes 31 rejected', pg_temp.err($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, max_minutes) VALUES ('co_a','x','t','g',31)$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('max_minutes 0 rejected', pg_temp.err($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, max_minutes) VALUES ('co_a','x','t','g',0)$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('allowed_modes with video rejected', pg_temp.err($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, allowed_modes) VALUES ('co_a','x','t','g',ARRAY['video'])$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('empty allowed_modes rejected', pg_temp.err($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, allowed_modes) VALUES ('co_a','x','t','g','{}')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('bad visibility rejected', pg_temp.err($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, visibility) VALUES ('co_a','x','t','g','public')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('bad style rejected', pg_temp.err($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, style) VALUES ('co_a','x','t','g','lecture')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('bad scenario status rejected', pg_temp.err($q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal, status) VALUES ('co_a','x','t','g','live')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('bad origin rejected', pg_temp.err($q$INSERT INTO public.tutor_sessions (company_id, user_id, origin, mode) VALUES ('co_a','learner_a','homework','text')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('bad mode rejected', pg_temp.err($q$INSERT INTO public.tutor_sessions (company_id, user_id, origin, mode) VALUES ('co_a','learner_a','practice','video')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('bad session status rejected', pg_temp.err($q$INSERT INTO public.tutor_sessions (company_id, user_id, origin, mode, status) VALUES ('co_a','learner_a','practice','text','done')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('duplicate (session, idx) turn rejected', pg_temp.err($q$INSERT INTO public.tutor_turns (session_id, idx) VALUES ('88888888-0000-0000-0000-000000000001', 1)$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('bad learner_vocab source rejected', pg_temp.err($q$INSERT INTO public.learner_vocab (user_id, vocab_id, company_id, source) VALUES ('learner_b','99999999-0000-0000-0000-000000000001','co_a','guess')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('bad ledger kind rejected', pg_temp.err($q$INSERT INTO public.ai_usage_ledger (company_id, model, kind, units, unit) VALUES ('co_a','m','video',1,'t')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('negative ledger units rejected', pg_temp.err($q$INSERT INTO public.ai_usage_ledger (company_id, model, kind, units, unit) VALUES ('co_a','m','llm',-1,'t')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('negative free minutes rejected', pg_temp.err($q$UPDATE public.tutor_settings SET free_practice_minutes_per_month = -5$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('exam frameworks seeded with 5 rows (superuser)', (SELECT count(*) FROM public.exam_frameworks)::bigint, 5);
  PERFORM pg_temp.chk('hsk3 speaking tasks empty', (SELECT jsonb_array_length(speaking_tasks)::bigint FROM public.exam_frameworks WHERE id = 'hsk3'), 0);
  PERFORM pg_temp.chk('hskk seeded with 3 speaking tasks', (SELECT jsonb_array_length(speaking_tasks)::bigint FROM public.exam_frameworks WHERE id = 'hskk'), 3);
  PERFORM pg_temp.chk('duplicate exam framework id rejected', pg_temp.err($q$INSERT INTO public.exam_frameworks (id, language, label) VALUES ('hsk2','zh','changed')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('trigger count for updated_at (9 tables)', (SELECT count(*)::bigint FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE t.tgname LIKE 'set_%_updated_at' AND c.relname IN ('exam_frameworks','ai_personas','practice_scenarios','tutor_assignments','tutor_sessions','learner_language_profiles','vocab_items','learner_vocab','tutor_settings')), 9);
  PERFORM pg_temp.chk('all 12 new tables have RLS enabled', (SELECT count(*)::bigint FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('exam_frameworks','ai_personas','practice_scenarios','tutor_assignments','tutor_sessions','tutor_turns','tutor_reports','learner_language_profiles','vocab_items','learner_vocab','tutor_settings','ai_usage_ledger') AND c.relrowsecurity), 12);
  PERFORM pg_temp.chk('practice_sessions untouched (not created here)', (SELECT count(*)::bigint FROM pg_class WHERE relname = 'practice_sessions'), 0);
  PERFORM pg_temp.chk('helper is_company_staff(NULL) is false', (SELECT CASE WHEN public.is_company_staff(NULL) THEN 1 ELSE 0 END)::bigint, 0);
END $$;

-- ---------- SUSPENSION (companies.status, 20260527000000) ----------
DO $$
BEGIN
  UPDATE public.companies SET status = 'suspended' WHERE id = 'co_a';

  PERFORM pg_temp.chk('suspended: helper is_company_member false', (SELECT CASE WHEN public.is_company_member('co_a') THEN 1 ELSE 0 END)::bigint, 0);
  PERFORM pg_temp.chk('suspended: helper is_company_staff false', (SELECT CASE WHEN public.is_company_staff('co_a') THEN 1 ELSE 0 END)::bigint, 0);
  PERFORM pg_temp.chk('suspended: teacher sees 0 sessions', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_sessions'), 0);
  PERFORM pg_temp.chk('suspended: teacher sees 0 turns', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_turns'), 0);
  PERFORM pg_temp.chk('suspended: teacher reads 0 learner profiles', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.learner_language_profiles'), 0);
  PERFORM pg_temp.chk('suspended: teacher reads 0 tutor audio', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM storage.objects WHERE bucket_id = ''tutor-audio'''), 0);
  PERFORM pg_temp.chk('suspended: learner_a reads co_a published scenarios = 0 (platform 1 left)', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.practice_scenarios'), 1);
  PERFORM pg_temp.chk('suspended: learner_a cannot insert a session in co_a', pg_temp.as_error('authenticated','learner_a', $q$INSERT INTO public.tutor_sessions (company_id, user_id, origin, mode) VALUES ('co_a','learner_a','practice','text')$q$)::int::bigint, 1);
  PERFORM pg_temp.chk('suspended: teacher cannot write a scenario in co_a', pg_temp.as_error('authenticated','teacher_t', $q$INSERT INTO public.practice_scenarios (company_id, skill_pack, title, goal) VALUES ('co_a','x','t','g')$q$)::int::bigint, 1);
  -- Own rows are still readable by the learner, because that policy does not check membership.
  PERFORM pg_temp.chk('suspended: learner_a still reads own 6 sessions (own-row policy; 5 seeded + 1 inserted above)', pg_temp.as_count('authenticated','learner_a','SELECT count(*) FROM public.tutor_sessions'), 6);
  PERFORM pg_temp.chk('suspended: co_b unaffected (learner_c sees own session)', pg_temp.as_count('authenticated','learner_c','SELECT count(*) FROM public.tutor_sessions'), 1);

  UPDATE public.companies SET status = 'active' WHERE id = 'co_a';
  PERFORM pg_temp.chk('restored: teacher sees 4 sessions again', pg_temp.as_count('authenticated','teacher_t','SELECT count(*) FROM public.tutor_sessions'), 4);
END $$;

-- Cascade: deleting a session removes its turns and report.
DO $$
BEGIN
  DELETE FROM public.tutor_sessions WHERE id = '88888888-0000-0000-0000-000000000002';
  PERFORM pg_temp.chk('session delete cascades to turns and reports', (SELECT count(*)::bigint FROM public.tutor_turns WHERE session_id = '88888888-0000-0000-0000-000000000002') + (SELECT count(*)::bigint FROM public.tutor_reports WHERE session_id = '88888888-0000-0000-0000-000000000002'), 0);
END $$;

ROLLBACK;
