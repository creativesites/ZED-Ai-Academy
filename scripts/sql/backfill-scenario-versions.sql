-- Backfill v1 for every practice scenario that has no version yet (P1-04).
-- Run after supabase/migrations/20261125000101_scenario_versions.sql.
-- Idempotent: re-running creates nothing new. The app also creates v1 lazily, so this is optional,
-- but it gives every existing flow a history entry and lets new sessions pin without a write.
--
-- The snapshot keys must match SCENARIO_SNAPSHOT_FIELDS in src/lib/tutor/authoring/versions.ts.
-- Archived (soft-deleted) scenarios are included so their history is complete.

begin;

insert into public.practice_scenario_versions (scenario_id, version, snapshot, created_by, note)
select
  s.id,
  1,
  jsonb_build_object(
    'skill_pack', s.skill_pack,
    'persona_id', s.persona_id,
    'title', s.title,
    'goal', s.goal,
    'beats', s.beats,
    'target_items', s.target_items,
    'level', s.level,
    'exam_task', s.exam_task,
    'max_minutes', s.max_minutes,
    'allowed_modes', to_jsonb(s.allowed_modes),
    'scene', s.scene,
    'style', s.style
  ),
  s.created_by,
  'Initial version (backfill)'
from public.practice_scenarios s
where not exists (
  select 1 from public.practice_scenario_versions v where v.scenario_id = s.id
)
on conflict (scenario_id, version) do nothing;

update public.practice_scenarios s
set published_version = (
  select max(v.version) from public.practice_scenario_versions v where v.scenario_id = s.id
)
where s.published_version is null
  and exists (select 1 from public.practice_scenario_versions v where v.scenario_id = s.id);

commit;
