-- P1-06: lesson Ask dock on the Teacher Runtime (`ask` session origin).
--
-- The `ask` origin itself needs no schema change: tutor_sessions_origin_check (20261101000000_zai_tutor.sql) has
-- allowed 'ask' since the first tutor migration, and `ask` sessions stay private to the learner under the existing
-- staff-visibility rule (only lesson/assignment, shared or flagged sessions are staff-visible).
--
-- This migration only adds:
--   1. a lookup index for "the learner's open Ask conversation for this lesson";
--   2. a partial unique index so two tabs opening the dock at once cannot create two open conversations
--      (the app re-reads the existing one on a unique violation).
-- Additive and idempotent. No `ask` rows exist before this feature, so the unique index cannot conflict.
-- The app works before this is applied (it then relies on "newest open session wins").

CREATE INDEX IF NOT EXISTS tutor_sessions_ask_lookup_idx
  ON public.tutor_sessions (user_id, lesson_id, started_at DESC)
  WHERE origin = 'ask';

CREATE UNIQUE INDEX IF NOT EXISTS tutor_sessions_one_open_ask_per_lesson_idx
  ON public.tutor_sessions (user_id, lesson_id)
  WHERE origin = 'ask' AND status = 'active';
