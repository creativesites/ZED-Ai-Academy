-- AI Teacher P1-07: learner memories, global preferences and per-user habits (Architecture §4.4, D-17).
--
-- learner_memories    tenant-scoped, learner-visible typed memory the teacher reads through the learner brief.
-- learner_preferences global per person (device/accessibility), NOT tenant-scoped.
-- learner_habits      one row per person: streak and practice totals (replaces the per-language streak fields
--                     on learner_language_profiles, which split streaks by language).
--
-- Server code uses the service role, so RLS here is defence in depth: learners read and correct their own rows.
-- Staff visibility of memories (visible_to_staff) is enforced in app code; no staff policy is granted.
-- Additive and idempotent. Down (manual): drop table learner_habits, learner_preferences, learner_memories.

-- ============================================================
-- learner_memories
-- ============================================================
create table if not exists public.learner_memories (
  id                uuid primary key default gen_random_uuid(),
  company_id        text not null references public.companies(id) on delete cascade,
  user_id           text not null references public.profiles(id) on delete cascade,
  kind              text not null
                    check (kind in ('goal', 'background', 'preference', 'episode', 'misconception', 'note')),
  content           text not null check (char_length(content) between 1 and 500),
  source            text not null
                    check (source in ('learner_stated', 'session_summary', 'teacher_observed', 'staff_note')),
  -- Where the memory came from, e.g. "turn:3" (summariser) or "legacy:recentMistakes". Summariser items always cite a turn.
  source_ref        text check (source_ref is null or char_length(source_ref) <= 200),
  session_id        uuid references public.tutor_sessions(id) on delete set null,
  course_id         uuid,
  objective_key     text check (objective_key is null or char_length(objective_key) <= 200),
  confidence        numeric(3, 2) not null default 0.5 check (confidence between 0 and 1),
  -- Privacy first: staff never see a memory unless this is true AND the tenant policy allows it (app code).
  visible_to_staff  boolean not null default false,
  status            text not null default 'active' check (status in ('active', 'hidden', 'deleted')),
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.learner_memories is
  'Typed, learner-editable memory the AI teacher reads via the learner brief (P1-07). Tenant scoped.';

-- Brief read path: one learner in one tenant, active rows, newest first.
create index if not exists learner_memories_brief_idx
  on public.learner_memories (company_id, user_id, status, created_at desc);

-- "What my teacher knows" lists every tenant for the signed-in user; RLS filters on user_id.
create index if not exists learner_memories_user_idx
  on public.learner_memories (user_id, created_at desc);

create index if not exists learner_memories_session_idx
  on public.learner_memories (session_id)
  where session_id is not null;

drop trigger if exists set_learner_memories_updated_at on public.learner_memories;
create trigger set_learner_memories_updated_at
  before update on public.learner_memories
  for each row execute function public.handle_updated_at();

alter table public.learner_memories enable row level security;

drop policy if exists "Learners read own memories" on public.learner_memories;
create policy "Learners read own memories"
  on public.learner_memories for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Learners update own memories" on public.learner_memories;
create policy "Learners update own memories"
  on public.learner_memories for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Learners delete own memories" on public.learner_memories;
create policy "Learners delete own memories"
  on public.learner_memories for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- ============================================================
-- learner_preferences (global per person, D-17)
-- ============================================================
create table if not exists public.learner_preferences (
  user_id         text primary key references public.profiles(id) on delete cascade,
  preferred_mode  text check (preferred_mode is null or preferred_mode in ('voice', 'text')),
  speech_rate     numeric(3, 2) check (speech_rate is null or speech_rate between 0.5 and 2),
  captions        boolean,
  data_saver      boolean,
  reduced_motion  boolean,
  ui_language     text check (ui_language is null or char_length(ui_language) between 2 and 16),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.learner_preferences is
  'Global (not tenant-scoped) device and accessibility preferences for the AI teacher. Null = no choice.';

drop trigger if exists set_learner_preferences_updated_at on public.learner_preferences;
create trigger set_learner_preferences_updated_at
  before update on public.learner_preferences
  for each row execute function public.handle_updated_at();

alter table public.learner_preferences enable row level security;

drop policy if exists "Learners read own preferences" on public.learner_preferences;
create policy "Learners read own preferences"
  on public.learner_preferences for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Learners insert own preferences" on public.learner_preferences;
create policy "Learners insert own preferences"
  on public.learner_preferences for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Learners update own preferences" on public.learner_preferences;
create policy "Learners update own preferences"
  on public.learner_preferences for update to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));

-- ============================================================
-- learner_habits (one row per person; streak no longer split by language)
-- ============================================================
create table if not exists public.learner_habits (
  user_id              text primary key references public.profiles(id) on delete cascade,
  streak_days          integer not null default 0 check (streak_days >= 0),
  longest_streak_days  integer not null default 0 check (longest_streak_days >= 0),
  last_practice_date   date,
  total_practice_ms    bigint not null default 0 check (total_practice_ms >= 0),
  weekly_goal_minutes  integer not null default 15 check (weekly_goal_minutes between 5 and 600),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.learner_habits is
  'Per-person practice habits (streak, totals). Written by the server on session completion.';

drop trigger if exists set_learner_habits_updated_at on public.learner_habits;
create trigger set_learner_habits_updated_at
  before update on public.learner_habits
  for each row execute function public.handle_updated_at();

alter table public.learner_habits enable row level security;

drop policy if exists "Learners read own habits" on public.learner_habits;
create policy "Learners read own habits"
  on public.learner_habits for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
