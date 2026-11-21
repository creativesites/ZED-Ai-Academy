# Agent A brief: AI co-author for teachers (ZAI Teacher, Phase 1)

You are implementing Phase 1 of the ZAI Teacher in the Zed AI Academy repo (Next.js 16 App Router, TypeScript,
Tailwind v4 + shadcn/ui, Clerk auth, Supabase with RLS, Gemini via `@google/genai`). Read these first:

- `docs/ai-teacher/NEXT_PHASES_PLAN.md` (the plan, current state, and which files are yours)
- `AGENTS.md` and `CLAUDE.md` (this Next.js has breaking changes: read the guide in `node_modules/next/dist/docs/`
  before using any Next API you are unsure of)
- `docs/TUTOR_API.md`, `src/lib/tutor/events.ts` (event contract v2), `src/lib/tutor/scenario.ts`,
  `src/lib/tutor/skill-packs.ts`, `src/lib/tutor/server/prompt.ts`

Another agent (Agent B) is building the learner side at the same time. Stay inside the files listed as yours.

## Goal

A teacher with a finished lesson adds a working AI Teacher to it in under two minutes, without writing a prompt:
objectives are pulled from the lesson, a flow is drafted, the teacher tweaks it in plain words, tests it as a
student, and publishes.

## What exists

- Flows are rows in `practice_scenarios` (title, goal, `beats` = steps `{id, goal, targetItems}`, `target_items`,
  `skill_pack`, `persona_id`, `scene`, `style` scene|guided_lesson|oral_check, `visibility`, `status`).
  Teachers are `ai_personas`. Schema: `supabase/migrations/20261101000000_zai_tutor.sql`.
- Server actions: `src/actions/tutor-authoring.ts` (`upsertScenario`, `updateScenarioQuick`, `listScenariosForCourseStudio`,
  `upsertPersona`, `seedStarterPersonas`...), `src/actions/tutor-scenarios.ts`.
- AI drafting today: `src/app/api/ai/generate-tutor-scenario/route.ts`, called from
  `src/components/tutor/studio/ScenarioEditorModal.tsx` (works only inside a course or lesson).
- Studio UI: `src/components/tutor/studio/TutorStudioHub.tsx`, `ScenarioEditorModal.tsx`, `PersonaStudio.tsx`;
  course tab `src/components/creator/course-tutor-tab.tsx`.
- Lesson editor: `src/components/creator/lesson-editor-client.tsx` (block types; `tutor_session` is still labelled
  "Speaking Practice" there), `src/components/creator/blocks/tutor-session-block.tsx`,
  `src/components/creator/lesson-studio-view.tsx`.
- Learner side plays a flow through `/practice/[scenarioId]` and the `tutor_session` lesson block.
- Test data: Glory Academy (`glory-academy`) has two teachers, three flows and the course `ai-teacher-test-drive`
  (`scripts/seed-glory-teacher.mjs`).

## Build, in this order

1. **Rename in the lesson editor**: the `tutor_session` block reads "AI Teacher" ("Your AI teacher teaches and checks
   this lesson"), not "Speaking Practice". User-facing text only.
2. **Objective extraction** (`src/lib/tutor/authoring/objectives.ts` + a route under `src/app/api/ai/teacher/`):
   input = the lesson's blocks (text, glossary, video title/description, quiz questions); output = 2–5 objectives
   `{id, text, evidence}` ("Learner can …", with what counts as evidence). Gemini structured output through the
   existing `gemini` client and `modelFor()` (add an `AiTask` such as `teacherAuthoring` in `src/lib/ai/models.ts`).
   Keep the JSON schema loose: no number bounds, no array length limits (see the plan; Gemini rejects complex
   schemas). Validate with Zod after.
3. **Flow drafting from objectives**: one call that returns a full flow (title, goal, style, scene, 3–5 steps,
   each step with goal, board content and a check question, target items). Pick `general-tutor` for non-language
   lessons. Default teacher = the course teacher (`courseTeacher()` in `src/lib/tutor/course-teacher.ts`), default
   scene `Scene_Classroom` (or `Scene_Studio` for skills/coaching).
4. **AI Teacher panel in the lesson editor**: "Add an AI teacher to this lesson" → shows the objectives (editable) →
   "Draft the flow" → storyboard → "Add to lesson" inserts a `tutor_session` block linked to the saved flow
   (draft until the course is published).
5. **Storyboard + AI edit bar**: steps as cards (goal, board preview, check question), reorder with drag and drop
   (check what the repo already uses for DnD before adding a library), edit inline. A one-line bar takes an
   instruction ("make step 2 easier", "add a kwacha example") and returns the revised flow; show a diff/undo.
6. **Test as student**: a "Test as student" button opens the flow in a session that is marked as a preview
   (no learner progress, no report saved to the learner, usage logged against the teacher). Look at how
   `src/app/api/tutor/sessions/route.ts` and `src/lib/tutor/entitlements.ts` let staff preview; reuse that.
7. **Six templates** (`src/lib/tutor/authoring/templates.ts`): Explain & check, Worked example, Role-play,
   Oral check (viva), Debate/defend, Revision sprint. Each sets style, scene, step skeleton and prompt hints;
   the drafting call takes a template id.
8. **teacher_moments** (schema, last): a migration `supabase/migrations/20261122000000_teacher_moments.sql` for
   several short teacher moments per lesson at chosen positions (after block X). RLS like `practice_scenarios`
   (tenant staff write; enrolled learners read). Write the migration and the creator UI; do **not** apply it.
   Hand the learner-side rendering to Agent B through the PR description.

## Rules

- Your files: `src/components/creator/**`, `src/components/tutor/studio/**`, `src/actions/tutor-authoring.ts`,
  `src/actions/tutor-scenarios.ts`, `src/app/api/ai/generate-tutor-scenario/**`, new `src/app/api/ai/teacher/**`,
  new `src/lib/tutor/authoring/**`, `src/lib/ai/models.ts` (adding a task only), your migration.
- Read only: `src/lib/tutor/events.ts`, `turn-schema.ts`, `server/prompt.ts`, `skill-packs.ts` (Agent B owns them).
  If you need a contract change, describe it in your PR instead.
- Server Components by default; `"use client"` only for interactivity. RLS on every new table; never use the
  service role from the client. All AI calls server-side.
- Accessible UI: labels, keyboard reorder alternative, focus states, no emoji as icons.
- Tests: add `node --test` unit tests next to new pure logic (`*.test.ts`, run with `npm run test:tutor`).
  Before each commit: `npm run test:tutor`, `npx tsc --noEmit`, `npx eslint <changed files>`.
- Git: branch `feat/teacher-authoring` from `origin/main`; small commits; open a PR. Never push to `main`
  (it deploys production). Never apply migrations to production.
- Done = a teacher in Glory Academy can open a lesson of "AI Teacher Test Drive", click "Add an AI teacher",
  get objectives and a draft flow, edit it with one instruction, test it as a student, and see it in the lesson.
  Put screenshots and the test steps in the PR.
