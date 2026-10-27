# ZAI Tutor demo course

A free, published course, "ZAI Tutor Showcase: Speak from Day One" (slug `zai-tutor-showcase`), with one lesson per language. Each lesson has a short text intro, a glossary of target phrases, and a `tutor_session` block that opens a speaking practice with the AI tutor.

Nothing here runs automatically. The migrations are written for review and have not been applied to any database.

## What it contains

| Thing | Id (fixed) | Notes |
|---|---|---|
| Course | `7a1e0000-0000-4000-8000-000000000201` | Free, published, owned by the `zedai` tenant, instructor = its `admin_id` |
| Module | `7a1e0000-0000-4000-8000-000000000301` | "Speak from Day One" |
| Lesson 1 | `…0401` | Ordering tea in Mandarin (scenario `…0101`, Lín Lǎoshī) |
| Lesson 2 | `…0402` | Ordering a coffee in Spanish (scenario `…0102`, Sofía) |
| Lesson 3 | `…0403` | Buying bread in French (scenario `…0103`, Camille) |
| Lesson 4 | `…0404` | Patient intake in English (scenario `…0104`, Nurse Tendai) |
| Personas | `…0001` to `…0004` | `ai_personas` in the `zedai` tenant. Looks copied from `design/rive/presets.json`. |

Each lesson has 3 blocks: `text`, `glossary`, `tutor_session` (`style: scene`, `required: false`). The `tutor_session` block points at its scenario by id. The four scenarios are `visibility = platform`, `status = published`, with `max_minutes = 6` and modes voice, text and live.

All ids are fixed UUIDs (prefix `7a1e0000-0000-4000-8000-`). Every insert uses `ON CONFLICT DO NOTHING`, so running the seed again adds nothing.

## Apply order

Run these in the Supabase SQL editor or with the Supabase CLI, against the target database only, in this order:

1. `supabase/migrations/20261101000000_zai_tutor.sql`: tutor schema (personas, scenarios, sessions, RLS, platform guard).
2. `supabase/migrations/20261102000000_tutor_session_block.sql`: adds `tutor_session` to `content_blocks_type_check`.
3. `supabase/migrations/20261102000001_tutor_demo_course.sql`: the demo course.

Each file is idempotent and can be re-run.

Step 3 needs a company with `slug = 'zedai'` (the platform tenant). If there is none, the file only prints a NOTICE and inserts nothing.

## Before learners can use it

The tutor API checks access before it starts a session (`src/lib/tutor/server/access.ts`). For this demo:

- A learner must have an **active enrollment** in the course to start a lesson session. Free courses still need an enrollment row.
- A platform scenario is only usable when the learner's own `profiles.company_id` is an **active member** of that tenant (`company_members.status = 'active'`). Learners with no tenant get `not_tenant_member`.
- Teachers who preview the block are checked the same way, so a teacher who is not enrolled in the course gets `not_enrolled` in the preview.

## Removing the demo

Run this against the database you seeded. It removes the course and its lessons and blocks (cascade), then the four platform scenarios and personas. Completed demo sessions are kept as history with their lesson and scenario links cleared.

```sql
BEGIN;

DELETE FROM public.courses WHERE id = '7a1e0000-0000-4000-8000-000000000201';

DELETE FROM public.practice_scenarios
WHERE id IN (
  '7a1e0000-0000-4000-8000-000000000101',
  '7a1e0000-0000-4000-8000-000000000102',
  '7a1e0000-0000-4000-8000-000000000103',
  '7a1e0000-0000-4000-8000-000000000104'
);

DELETE FROM public.ai_personas
WHERE id IN (
  '7a1e0000-0000-4000-8000-000000000001',
  '7a1e0000-0000-4000-8000-000000000002',
  '7a1e0000-0000-4000-8000-000000000003',
  '7a1e0000-0000-4000-8000-000000000004'
);

COMMIT;
```

To keep the personas and scenarios but hide the course, set the course to draft instead: `UPDATE public.courses SET status = 'draft' WHERE id = '7a1e0000-0000-4000-8000-000000000201';`

## Local check

The migrations were tested on a throwaway Postgres 16 with the stubs and baseline in `supabase/tests/tutor/`. The checks are: the course, 1 module, 4 lessons, 12 blocks, 4 `tutor_session` blocks and 4 scenarios each exist once after two runs; the constraint rejects an unknown block type; and the persona looks match `design/rive/presets.json`.
