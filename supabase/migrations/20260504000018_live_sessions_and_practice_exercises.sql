-- ============================================================
-- Live session booking and practice exercise foundations
-- ============================================================
-- This migration starts the replacement of static Zoom meeting blocks
-- with bookable live sessions, and adds first-class practice exercise
-- submissions with AI scoring and instructor review.
-- ============================================================

-- Keep the existing content block constraint in sync with the new
-- practice_exercise block type.
ALTER TABLE public.content_blocks
  DROP CONSTRAINT IF EXISTS content_blocks_type_check,
  ADD CONSTRAINT content_blocks_type_check
    CHECK (type IN (
      'video', 'text', 'quiz', 'resource',
      'image', 'callout', 'tool_spotlight', 'before_after',
      'ai_prompt', 'steps', 'checklist', 'key_takeaway',
      'expert_note', 'comparison_table', 'case_study', 'meeting',
      'practice_exercise'
    ));

-- The old practice_sessions table was introduced with Supabase Auth UUIDs
-- after the app moved to Clerk text IDs. Some environments do not have that
-- table, so this repair is optional.
DO $$
BEGIN
  IF to_regclass('public.practice_sessions') IS NOT NULL THEN
    ALTER TABLE public.practice_sessions
      DROP CONSTRAINT IF EXISTS practice_sessions_user_id_fkey;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'practice_sessions'
        AND column_name = 'user_id'
        AND data_type <> 'text'
    ) THEN
      ALTER TABLE public.practice_sessions
        ALTER COLUMN user_id TYPE text USING user_id::text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'practice_sessions_user_id_fkey'
        AND conrelid = 'public.practice_sessions'::regclass
    ) THEN
      ALTER TABLE public.practice_sessions
        ADD CONSTRAINT practice_sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
        NOT VALID;
    END IF;
  END IF;
END $$;

-- ============================================================
-- Live Sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.live_session_services (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id                       text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id                           uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id                           uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title                               text NOT NULL,
  description                         text,
  duration_minutes                    int NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 240),
  buffer_before_minutes               int NOT NULL DEFAULT 0 CHECK (buffer_before_minutes BETWEEN 0 AND 120),
  buffer_after_minutes                int NOT NULL DEFAULT 0 CHECK (buffer_after_minutes BETWEEN 0 AND 120),
  min_notice_hours                    int NOT NULL DEFAULT 12 CHECK (min_notice_hours BETWEEN 0 AND 720),
  max_booking_days                    int NOT NULL DEFAULT 30 CHECK (max_booking_days BETWEEN 1 AND 365),
  requires_instructor_confirmation    boolean NOT NULL DEFAULT true,
  is_active                           boolean NOT NULL DEFAULT true,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instructor_availability_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday        int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time     time NOT NULL,
  end_time       time NOT NULL,
  timezone       text NOT NULL DEFAULT 'Africa/Lusaka',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instructor_availability_rules_valid_window CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS public.instructor_availability_exceptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date           date NOT NULL,
  timezone       text NOT NULL DEFAULT 'Africa/Lusaka',
  start_time     time,
  end_time       time,
  kind           text NOT NULL CHECK (kind IN ('unavailable', 'extra_available')),
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instructor_availability_exceptions_valid_window
    CHECK (
      (start_time IS NULL AND end_time IS NULL)
      OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
    )
);

CREATE TABLE IF NOT EXISTS public.live_session_bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id        uuid NOT NULL REFERENCES public.live_session_services(id) ON DELETE CASCADE,
  course_id         uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  lesson_id         uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  instructor_id     text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_id        text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'requested'
                    CHECK (status IN (
                      'requested', 'confirmed', 'declined', 'reschedule_requested',
                      'cancelled_by_learner', 'cancelled_by_instructor',
                      'completed', 'no_show'
                    )),
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  timezone          text NOT NULL DEFAULT 'Africa/Lusaka',
  learner_notes     text,
  instructor_notes  text,
  meeting_agenda    jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at      timestamptz,
  declined_at       timestamptz,
  cancelled_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_session_bookings_valid_window CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS public.zoom_meetings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           uuid NOT NULL UNIQUE REFERENCES public.live_session_bookings(id) ON DELETE CASCADE,
  zoom_meeting_id      text NOT NULL,
  zoom_uuid            text,
  host_id              text,
  host_email           text,
  topic                text NOT NULL,
  start_url_encrypted  text,
  join_url             text,
  password_encrypted   text,
  settings             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_session_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.live_session_bookings(id) ON DELETE CASCADE,
  actor_id    text REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_session_attendance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid NOT NULL REFERENCES public.live_session_bookings(id) ON DELETE CASCADE,
  user_id           text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role              text NOT NULL CHECK (role IN ('learner', 'instructor', 'admin')),
  joined_at         timestamptz NOT NULL DEFAULT now(),
  left_at           timestamptz,
  duration_seconds  int CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  client_metadata   jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Prevent confirmed/requested active sessions from occupying the exact
-- same instructor start time. Full interval overlap checks stay in server
-- code because they must account for service buffers and proposed slots.
CREATE UNIQUE INDEX IF NOT EXISTS live_session_bookings_no_duplicate_active_start
  ON public.live_session_bookings(instructor_id, starts_at)
  WHERE status IN ('requested', 'confirmed', 'reschedule_requested');

CREATE INDEX IF NOT EXISTS live_session_services_instructor_idx
  ON public.live_session_services(instructor_id, is_active);

CREATE INDEX IF NOT EXISTS live_session_services_course_idx
  ON public.live_session_services(course_id);

CREATE INDEX IF NOT EXISTS instructor_availability_rules_instructor_idx
  ON public.instructor_availability_rules(instructor_id, weekday, is_active);

CREATE INDEX IF NOT EXISTS instructor_availability_exceptions_instructor_idx
  ON public.instructor_availability_exceptions(instructor_id, date);

CREATE INDEX IF NOT EXISTS live_session_bookings_instructor_idx
  ON public.live_session_bookings(instructor_id, starts_at);

CREATE INDEX IF NOT EXISTS live_session_bookings_learner_idx
  ON public.live_session_bookings(learner_id, starts_at);

CREATE INDEX IF NOT EXISTS live_session_bookings_status_idx
  ON public.live_session_bookings(status, starts_at);

CREATE INDEX IF NOT EXISTS live_session_events_booking_idx
  ON public.live_session_events(booking_id, created_at);

CREATE INDEX IF NOT EXISTS live_session_attendance_booking_idx
  ON public.live_session_attendance(booking_id, joined_at);

-- ============================================================
-- Practice Exercises
-- ============================================================

CREATE TABLE IF NOT EXISTS public.practice_exercise_submissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_block_id  uuid NOT NULL REFERENCES public.content_blocks(id) ON DELETE CASCADE,
  course_id          uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id          uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id            text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'submitted', 'scored', 'needs_review', 'reviewed')),
  attempt_number     int NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  text_response      text,
  studio_tool_id     text,
  studio_inputs      jsonb NOT NULL DEFAULT '{}'::jsonb,
  studio_output      text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at       timestamptz,
  scored_at          timestamptz,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_block_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.practice_exercise_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES public.practice_exercise_submissions(id) ON DELETE CASCADE,
  user_id        text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket_id      text NOT NULL DEFAULT 'practice-submissions',
  storage_path   text NOT NULL,
  file_name      text NOT NULL,
  mime_type      text NOT NULL,
  file_size      bigint NOT NULL CHECK (file_size >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, storage_path)
);

CREATE TABLE IF NOT EXISTS public.practice_exercise_scores (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id            uuid NOT NULL UNIQUE REFERENCES public.practice_exercise_submissions(id) ON DELETE CASCADE,
  score                    numeric(5,2) NOT NULL CHECK (score >= 0),
  max_score                numeric(5,2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  rubric_breakdown         jsonb NOT NULL DEFAULT '[]'::jsonb,
  feedback_summary         text,
  strengths                jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvements             jsonb NOT NULL DEFAULT '[]'::jsonb,
  model                    text,
  confidence               numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  needs_instructor_review  boolean NOT NULL DEFAULT false,
  raw_ai_response          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.practice_exercise_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES public.practice_exercise_submissions(id) ON DELETE CASCADE,
  reviewer_id     text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_override  numeric(5,2) CHECK (score_override IS NULL OR score_override >= 0),
  feedback        text,
  status          text NOT NULL DEFAULT 'reviewed' CHECK (status IN ('reviewed', 'resubmission_requested')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_exercise_submissions_user_idx
  ON public.practice_exercise_submissions(user_id, exercise_block_id);

CREATE INDEX IF NOT EXISTS practice_exercise_submissions_course_status_idx
  ON public.practice_exercise_submissions(course_id, status);

CREATE INDEX IF NOT EXISTS practice_exercise_submissions_lesson_idx
  ON public.practice_exercise_submissions(lesson_id, exercise_block_id);

CREATE INDEX IF NOT EXISTS practice_exercise_files_submission_idx
  ON public.practice_exercise_files(submission_id);

CREATE INDEX IF NOT EXISTS practice_exercise_scores_review_idx
  ON public.practice_exercise_scores(needs_instructor_review, created_at);

CREATE INDEX IF NOT EXISTS practice_exercise_reviews_submission_idx
  ON public.practice_exercise_reviews(submission_id, created_at);

-- Private storage bucket for practice exercise files.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'practice-submissions',
  'practice-submissions',
  false,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
    'application/pdf',
    'text/plain',
    'application/zip', 'application/x-zip-compressed',
    'application/x-rar-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage path convention:
-- practice-submissions/{user_id}/{exercise_block_id}/{submission_id}/{filename}
DROP POLICY IF EXISTS "Learners can upload practice submissions" ON storage.objects;
CREATE POLICY "Learners can upload practice submissions"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'practice-submissions'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "Learners can read own practice submissions" ON storage.objects;
CREATE POLICY "Learners can read own practice submissions"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'practice-submissions'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "Learners can delete own practice submissions" ON storage.objects;
CREATE POLICY "Learners can delete own practice submissions"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'practice-submissions'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "Service role can manage practice submissions" ON storage.objects;
CREATE POLICY "Service role can manage practice submissions"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'practice-submissions')
  WITH CHECK (bucket_id = 'practice-submissions');

-- ============================================================
-- Updated-at triggers
-- ============================================================

DROP TRIGGER IF EXISTS set_live_session_services_updated_at ON public.live_session_services;
CREATE TRIGGER set_live_session_services_updated_at
  BEFORE UPDATE ON public.live_session_services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_instructor_availability_rules_updated_at ON public.instructor_availability_rules;
CREATE TRIGGER set_instructor_availability_rules_updated_at
  BEFORE UPDATE ON public.instructor_availability_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_live_session_bookings_updated_at ON public.live_session_bookings;
CREATE TRIGGER set_live_session_bookings_updated_at
  BEFORE UPDATE ON public.live_session_bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_zoom_meetings_updated_at ON public.zoom_meetings;
CREATE TRIGGER set_zoom_meetings_updated_at
  BEFORE UPDATE ON public.zoom_meetings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_practice_exercise_submissions_updated_at ON public.practice_exercise_submissions;
CREATE TRIGGER set_practice_exercise_submissions_updated_at
  BEFORE UPDATE ON public.practice_exercise_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_practice_exercise_reviews_updated_at ON public.practice_exercise_reviews;
CREATE TRIGGER set_practice_exercise_reviews_updated_at
  BEFORE UPDATE ON public.practice_exercise_reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.live_session_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_exercise_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_exercise_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_exercise_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_exercise_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published live session services are readable"
  ON public.live_session_services FOR SELECT
  USING (is_active = true);

CREATE POLICY "Instructors manage own live session services"
  ON public.live_session_services FOR ALL
  USING (instructor_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (instructor_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Instructors manage own availability rules"
  ON public.instructor_availability_rules FOR ALL
  USING (instructor_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (instructor_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Instructors manage own availability exceptions"
  ON public.instructor_availability_exceptions FOR ALL
  USING (instructor_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (instructor_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Session participants can read bookings"
  ON public.live_session_bookings FOR SELECT
  USING (
    learner_id = (auth.jwt() ->> 'sub')
    OR instructor_id = (auth.jwt() ->> 'sub')
  );

CREATE POLICY "Learners can create own booking requests"
  ON public.live_session_bookings FOR INSERT
  WITH CHECK (
    learner_id = (auth.jwt() ->> 'sub')
    AND status = 'requested'
  );

CREATE POLICY "Learners can update own cancellable bookings"
  ON public.live_session_bookings FOR UPDATE
  USING (learner_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (learner_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Instructors can update own bookings"
  ON public.live_session_bookings FOR UPDATE
  USING (instructor_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (instructor_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Session participants can read zoom meetings"
  ON public.zoom_meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_session_bookings b
      WHERE b.id = zoom_meetings.booking_id
        AND (b.learner_id = (auth.jwt() ->> 'sub') OR b.instructor_id = (auth.jwt() ->> 'sub'))
    )
  );

CREATE POLICY "Instructors can manage zoom meetings for own bookings"
  ON public.zoom_meetings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.live_session_bookings b
      WHERE b.id = zoom_meetings.booking_id
        AND b.instructor_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_session_bookings b
      WHERE b.id = zoom_meetings.booking_id
        AND b.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Session participants can read session events"
  ON public.live_session_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_session_bookings b
      WHERE b.id = live_session_events.booking_id
        AND (b.learner_id = (auth.jwt() ->> 'sub') OR b.instructor_id = (auth.jwt() ->> 'sub'))
    )
  );

CREATE POLICY "Session participants can create session events"
  ON public.live_session_events FOR INSERT
  WITH CHECK (
    actor_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1 FROM public.live_session_bookings b
      WHERE b.id = live_session_events.booking_id
        AND (b.learner_id = (auth.jwt() ->> 'sub') OR b.instructor_id = (auth.jwt() ->> 'sub'))
    )
  );

CREATE POLICY "Session participants can read attendance"
  ON public.live_session_attendance FOR SELECT
  USING (
    user_id = (auth.jwt() ->> 'sub')
    OR EXISTS (
      SELECT 1 FROM public.live_session_bookings b
      WHERE b.id = live_session_attendance.booking_id
        AND b.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Users can create own attendance"
  ON public.live_session_attendance FOR INSERT
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Learners manage own practice submissions"
  ON public.practice_exercise_submissions FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Instructors read practice submissions for own courses"
  ON public.practice_exercise_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = practice_exercise_submissions.course_id
        AND c.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Learners read own practice files"
  ON public.practice_exercise_files FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Learners create own practice files"
  ON public.practice_exercise_files FOR INSERT
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Instructors read practice files for own courses"
  ON public.practice_exercise_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.practice_exercise_submissions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = practice_exercise_files.submission_id
        AND c.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Learners read own practice scores"
  ON public.practice_exercise_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.practice_exercise_submissions s
      WHERE s.id = practice_exercise_scores.submission_id
        AND s.user_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Instructors read practice scores for own courses"
  ON public.practice_exercise_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.practice_exercise_submissions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = practice_exercise_scores.submission_id
        AND c.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Instructors manage reviews for own course submissions"
  ON public.practice_exercise_reviews FOR ALL
  USING (
    reviewer_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1
      FROM public.practice_exercise_submissions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = practice_exercise_reviews.submission_id
        AND c.instructor_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    reviewer_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1
      FROM public.practice_exercise_submissions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = practice_exercise_reviews.submission_id
        AND c.instructor_id = (auth.jwt() ->> 'sub')
    )
  );
