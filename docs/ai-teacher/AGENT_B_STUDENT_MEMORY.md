# Agent B brief: learner memory and the teacher dock (ZAI Teacher, Phase 2)

You are implementing Phase 2 of the ZAI Teacher in the CS Learn repo (Next.js 16 App Router, TypeScript,
Tailwind v4 + shadcn/ui, Clerk auth, Supabase with RLS, Gemini via `@google/genai`). Read these first:

- `docs/ai-teacher/NEXT_PHASES_PLAN.md` (the plan, current state, and which files are yours)
- `AGENTS.md` and `CLAUDE.md` (this Next.js has breaking changes: read the guide in `node_modules/next/dist/docs/`
  before using any Next API you are unsure of)
- `docs/TUTOR_API.md`, `src/lib/tutor/events.ts` (event contract v2), `src/lib/tutor/finalize.ts`,
  `src/lib/tutor/report-model.ts`, `src/components/tutor/EventPlayer.ts`

Another agent (Agent A) is building the teacher authoring side at the same time. Stay inside the files listed as yours.

## Goal

The teacher remembers what each learner knows and acts on it: evidence from every session becomes mastery per
objective, the report shows it, the dashboard plans the next 10 minutes, and the lesson dock is one teacher.

## What exists

- Sessions: `tutor_sessions`, `tutor_turns` (events per turn), `tutor_reports`, `learner_language_profiles`,
  `learner_vocab` (`supabase/migrations/20261101000000_zai_tutor.sql`).
- The model emits `note_evidence {objective, result: correct|partial|misconception, detail?, said?, correct?}`
  during a session (contract v2). Today `report-model.ts` (`collectNoteMistakes`) only folds non-correct evidence
  into the mistakes list; nothing stores mastery.
- Finalising: `src/lib/tutor/finalize.ts`, `src/lib/tutor/server/report.ts`, route
  `src/app/api/tutor/sessions/[id]/complete/route.ts`. Report UI: `src/components/tutor/practice/ReportCard.tsx`.
- Session UI: `src/components/tutor/practice/TutorSession.tsx`, `TeachingBoard.tsx`, `teacher-audio.ts`.
- Lesson player: `src/components/learner/lesson-player-client.tsx` with the "Ask Tinashe" dock
  (`src/components/learner/ai-tutor.tsx`, chat route `src/app/api/ai/tutor/route.ts`) and the `tutor_session` block.
- Dashboards: `src/app/(learner)/dashboard/page.tsx`, `src/app/(marketing)/academy/[domain]/dashboard/page.tsx`.
- Test data: Glory Academy flows `910e0000-0000-4000-8000-000000000101..103` (fractions, prompts, oral check);
  open `/practice/<id>`. Each flow has step goals that map naturally to objectives.

## Build, in this order

1. **learner_mastery migration** `supabase/migrations/20261123000000_learner_mastery.sql`:
   - `learner_evidence` (id, user_id, company_id, session_id, scenario_id, course_id, lesson_id, objective text,
     result, detail, said, correct, created_at).
   - `learner_mastery` (user_id, company_id, objective_key, objective text, course_id, lesson_id, level 0–3,
     evidence_count, last_result, updated_at; unique on user_id + objective_key).
   - RLS: learners read their own rows; tenant staff read their tenant's; only the server writes
     (follow the patterns in the tutor migration and `20261120000000_classroom_phase1_security_hardening.sql`,
     which uses `(select auth.jwt() ->> 'sub')` and SECURITY DEFINER helpers). Write it; do **not** apply it.
2. **Persist evidence at finalize** (`src/lib/tutor/mastery/**` + `finalize.ts`): collect `note_evidence` from the
   session's turns, insert `learner_evidence`, update `learner_mastery` with a small pure rule (e.g. correct +1,
   partial 0, misconception −1, clamp 0–3, objective_key = normalised objective + scenario). Unit-test the rule.
   Make finalize tolerate the tables not existing yet (log and continue) so production keeps working before the
   migration is applied.
3. **Report card v2** (`ReportCard.tsx`, `report-model.ts`): objectives met / partial / to review, each with the
   evidence line, one next step, and "Practise this" (starts the same flow again). Keep the language-pack report
   (mistakes, vocab) for language sessions.
4. **Dashboard daily plan**: a "Today with <teacher>" card with 1–3 items: weakest objectives (revision), the next
   unfinished lesson with a teacher block, a flow not tried. Server Component, reads mastery with the learner's
   own Supabase client.
5. **One teacher in the lesson player**: merge the old AiTutor drawer into the teacher dock (same teacher name,
   data-saver toggle, quick actions), and make `show_lesson_ref` with `seconds` seek the lesson's YouTube video.
6. **Revision sprint**: a 5-minute session built from the learner's 3 weakest objectives (a synthetic flow on the
   server, `general-tutor`, style `guided_lesson`, `Scene_Classroom`), started from the report or the daily plan.

## Rules

- Your files: `src/components/learner/**`, `src/components/tutor/practice/**`, `src/components/tutor/EventPlayer.ts`,
  dashboards, `src/lib/tutor/finalize.ts`, `report-model.ts`, `src/lib/tutor/server/report.ts`,
  `src/app/api/tutor/**`, `src/app/api/ai/tutor/**`, new `src/lib/tutor/mastery/**`, your migration.
- You own `src/lib/tutor/events.ts`, `turn-schema.ts`, `server/prompt.ts`, `skill-packs.ts`: additive changes only,
  keep the v1 aliases, and keep `turn-schema.ts` free of number bounds and array length limits (Gemini returns
  `400 too many states` otherwise; `turn-schema.test.ts` guards it). Note any contract change in your PR for Agent A.
- Never mute the teacher automatically; Lite saves data on visuals only.
- Server Components by default; RLS on every new table; never use the service role from the client.
- Accessible UI: labels, focus states, `aria-live` for new teacher content, no emoji as icons.
- Tests: `node --test` unit tests for the mastery rule and report model (`npm run test:tutor`). Before each commit:
  `npm run test:tutor`, `npx tsc --noEmit`, `npx eslint <changed files>`.
- Git: branch `feat/teacher-memory` from `origin/main`; small commits; open a PR. Never push to `main`
  (it deploys production). Never apply migrations to production.
- Done = in Glory Academy, finishing "Fractions with Tinashe" (after the migration is applied on a dev/branch
  database) shows report v2 with objectives, the dashboard shows "Today with Tinashe", and "Practise this" /
  revision sprint start a session. Without the migration, sessions still finish normally. Screenshots and test
  steps in the PR.
