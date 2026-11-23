-- ZAI Teacher Phase 2: Learner Mastery & Evidence Memory
-- Adds per-objective evidence log and rolled-up mastery state per learner,
-- plus Report Card v2 objective outcomes on tutor_reports.

create table if not exists public.learner_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  company_id text references public.companies(id) on delete cascade,
  course_id uuid,
  scenario_id uuid,
  session_id uuid references public.tutor_sessions(id) on delete set null,
  objective_key text not null,
  objective_text text not null,
  result text not null check (result in ('correct', 'partial', 'misconception')),
  detail text,
  created_at timestamptz not null default now()
);

comment on table public.learner_evidence is
  'Raw note_evidence checkpoints recorded by the AI teacher during sessions.';

create index if not exists learner_evidence_user_objective_idx
  on public.learner_evidence (user_id, objective_key, created_at desc);

create index if not exists learner_evidence_session_idx
  on public.learner_evidence (session_id)
  where session_id is not null;

create index if not exists learner_evidence_company_user_idx
  on public.learner_evidence (company_id, user_id, created_at desc)
  where company_id is not null;

alter table public.learner_evidence enable row level security;

drop policy if exists "Learners read own evidence" on public.learner_evidence;
create policy "Learners read own evidence"
  on public.learner_evidence
  for select
  to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Staff read company learner evidence" on public.learner_evidence;
create policy "Staff read company learner evidence"
  on public.learner_evidence
  for select
  to authenticated
  using (
    company_id is not null
    and public.is_company_staff(company_id)
  );

create table if not exists public.learner_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  company_id text references public.companies(id) on delete cascade,
  course_id uuid,
  objective_key text not null,
  objective_text text not null,
  level integer not null default 0 check (level between 0 and 3),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  last_result text check (last_result in ('correct', 'partial', 'misconception')),
  last_evidence_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, objective_key)
);

comment on table public.learner_mastery is
  'Rolled-up per-objective mastery level (0=unseen/weak .. 3=solid) per learner.';

create index if not exists learner_mastery_user_level_idx
  on public.learner_mastery (user_id, level asc, last_evidence_at desc);

create index if not exists learner_mastery_company_course_idx
  on public.learner_mastery (company_id, course_id, level asc)
  where company_id is not null;

drop trigger if exists learner_mastery_updated_at on public.learner_mastery;
create trigger learner_mastery_updated_at
  before update on public.learner_mastery
  for each row execute function public.handle_updated_at();

alter table public.learner_mastery enable row level security;

drop policy if exists "Learners read own mastery" on public.learner_mastery;
create policy "Learners read own mastery"
  on public.learner_mastery
  for select
  to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Staff read company learner mastery" on public.learner_mastery;
create policy "Staff read company learner mastery"
  on public.learner_mastery
  for select
  to authenticated
  using (
    company_id is not null
    and public.is_company_staff(company_id)
  );

-- Additive columns on tutor_reports for Report Card v2
alter table public.tutor_reports
  add column if not exists objectives jsonb not null default '[]'::jsonb,
  add column if not exists next_step text;

-- Optional synthetic scenario snapshot for 5-minute revision sprint sessions
alter table public.tutor_sessions
  add column if not exists sprint_context jsonb;
