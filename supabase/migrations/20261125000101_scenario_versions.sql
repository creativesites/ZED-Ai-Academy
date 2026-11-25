-- ============================================================
-- P1-04: flow (practice scenario) versioning, session pinning and soft delete.
-- Architecture §7.1.
--
--  * practice_scenario_versions: immutable content snapshots, one row per saved version.
--  * practice_scenarios.published_version: the version new sessions pin.
--  * practice_scenarios.archived_at: soft delete. Deleting a flow archives it (and sets
--    status = 'archived') so sessions and reports that reference it keep working.
--  * tutor_sessions.scenario_version: the version a session runs; the runtime loads that
--    snapshot, so editing a flow mid-session does not change the session.
--
-- Backfill of v1 for existing scenarios is a separate script:
--   scripts/sql/backfill-scenario-versions.sql
-- The app also creates v1 lazily the first time an unversioned flow is started or saved.
--
-- Conventions: Clerk user ids are text; current user is (auth.jwt() ->> 'sub').
-- Server code uses the service role; these policies cover direct client reads only.
-- Additive and idempotent. The app degrades to today's behaviour until this is applied.
-- ============================================================

create table if not exists public.practice_scenario_versions (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references public.practice_scenarios(id) on delete cascade,
  version      int not null,
  snapshot     jsonb not null,
  created_by   text references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  note         text,
  constraint practice_scenario_versions_version_check check (version >= 1),
  constraint practice_scenario_versions_scenario_version_key unique (scenario_id, version)
);

comment on table public.practice_scenario_versions is
  'Immutable content snapshots of a practice scenario (flow). Sessions pin one via tutor_sessions.scenario_version.';

alter table public.practice_scenarios
  add column if not exists published_version int,
  add column if not exists archived_at timestamptz;

alter table public.tutor_sessions
  add column if not exists scenario_version int;

create index if not exists practice_scenarios_company_live_idx
  on public.practice_scenarios (company_id, updated_at desc)
  where archived_at is null;

alter table public.practice_scenario_versions enable row level security;

-- Staff of the owning tenant read a flow's history. Writes go through the service role only.
drop policy if exists "Tenant staff read scenario versions" on public.practice_scenario_versions;
create policy "Tenant staff read scenario versions"
  on public.practice_scenario_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.practice_scenarios s
      where s.id = practice_scenario_versions.scenario_id
        and public.is_company_staff(s.company_id)
    )
  );

-- Learners read the snapshot their own sessions are pinned to.
drop policy if exists "Learners read versions pinned by own sessions" on public.practice_scenario_versions;
create policy "Learners read versions pinned by own sessions"
  on public.practice_scenario_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tutor_sessions t
      where t.scenario_id = practice_scenario_versions.scenario_id
        and t.scenario_version = practice_scenario_versions.version
        and t.user_id = (select auth.jwt() ->> 'sub')
    )
  );
