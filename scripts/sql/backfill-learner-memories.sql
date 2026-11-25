-- P1-07 backfill: run ONCE right after applying supabase/migrations/20261125000300_learner_memory.sql.
-- Idempotent: safe to re-run (rows are matched on their legacy source_ref + content; habits use ON CONFLICT).
--
-- 1. learner_language_profiles.memory.recentMistakes → learner_memories (kind = misconception).
--    After this, the legacy memory column is read-only: new mistakes are written to learner_memories.
--    Until it runs, sessions on a migrated database do not see legacy mistakes in the learner brief.
-- 2. Per-language streaks → one learner_habits row per person (most recently practised language's streak,
--    totals summed). Rows that already exist (created by a session since the migration) are left alone.

begin;

-- 1. Misconceptions -----------------------------------------------------------------------------------
with legacy as (
  select
    p.company_id,
    p.user_id,
    p.language,
    p.updated_at,
    nullif(btrim(m ->> 'said'), '')     as said,
    nullif(btrim(m ->> 'correct'), '')  as correct,
    nullif(btrim(m ->> 'category'), '') as category,
    m_ord
  from public.learner_language_profiles p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.memory -> 'recentMistakes') = 'array' then p.memory -> 'recentMistakes' else '[]'::jsonb end
  ) with ordinality as e(m, m_ord)
  where jsonb_typeof(m) = 'object'
),
shaped as (
  -- Same text as mistakeToMemoryContent() in src/lib/tutor/learner/memory.ts.
  select distinct on (company_id, user_id, content)
    company_id,
    user_id,
    content,
    -- Keep the legacy order: first mistake = newest.
    updated_at - make_interval(secs => m_ord::double precision) as created_at
  from (
    select
      company_id, user_id, updated_at, m_ord,
      left(
        case
          when said is not null then 'Said "' || said || '" instead of "' || correct || '"'
          else 'Needs practice with "' || correct || '"'
        end
        || case when category is not null then ' (' || category || ')' else '' end,
        500
      ) as content
    from legacy
    where correct is not null
  ) x
  order by company_id, user_id, content, created_at desc
)
insert into public.learner_memories
  (company_id, user_id, kind, content, source, source_ref, confidence, created_at, updated_at)
select
  s.company_id, s.user_id, 'misconception', s.content, 'teacher_observed', 'legacy:language_profile', 0.5,
  s.created_at, s.created_at
from shaped s
where not exists (
  select 1 from public.learner_memories lm
  where lm.company_id = s.company_id
    and lm.user_id = s.user_id
    and lm.kind = 'misconception'
    and lm.content = s.content
);

-- 2. Habits ------------------------------------------------------------------------------------------
with ranked as (
  select
    user_id,
    streak_days,
    last_practice_date,
    row_number() over (
      partition by user_id
      order by last_practice_date desc nulls last, streak_days desc
    ) as rn,
    max(streak_days) over (partition by user_id)        as longest,
    sum(total_speaking_ms) over (partition by user_id)  as total_ms
  from public.learner_language_profiles
)
insert into public.learner_habits (user_id, streak_days, longest_streak_days, last_practice_date, total_practice_ms)
select
  user_id,
  case when last_practice_date is null then 0 else greatest(streak_days, 0) end,
  greatest(longest, 0),
  last_practice_date,
  greatest(coalesce(total_ms, 0), 0)
from ranked
where rn = 1
on conflict (user_id) do nothing;

commit;
