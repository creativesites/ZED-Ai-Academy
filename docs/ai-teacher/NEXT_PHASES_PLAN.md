# ZAI Teacher: plan after Phase 0

Status on 2026-11-21. The approved design (artifact "ZAI Teacher", 15 artboards) set four phases. Phase 0 is live.
This file is the shared plan; `AGENT_A_TEACHER_AUTHORING.md` and `AGENT_B_STUDENT_MEMORY.md` are the two
implementation briefs, written so two agents can work at the same time without touching the same files.

## Where things stand

Live on main (zed-ai-academy.vercel.app):

- **Event contract v2** (`src/lib/tutor/events.ts`): board, reveal_step, ask_choice, ask_confidence,
  show_lesson_ref, play_clip, note_evidence, advance_step, switch_scene, award. Language-only events
  (show_card, trace_tone, note_mistake) are taught only to language packs. The model emits events; `EventPlayer`
  plays them; `TeachingBoard` renders board/choice/confidence/refs/clip/award as HTML.
- **General teacher**: skill pack `general-tutor` ("any subject"), Tinashe as the default course teacher
  (`src/lib/tutor/course-teacher.ts`), "Ask Tinashe" dock in the lesson player.
- **Scenes**: Scene_Classroom and Scene_Studio (contract 1.2.0) next to TeaHouse, Cafe, Rooftop, Clinic. The .riv
  is published with a Rive plan that adds the splash screen; accepted.
- **Lite / data saver**: lighter visuals; the teacher still speaks.
- **Renames**: Teacher's Room, AI Teacher Flows, Teacher (mobile nav).
- **Test content**: Glory Academy has Tinashe and Maureen, three published flows and the free course
  "AI Teacher Test Drive" (`scripts/seed-glory-teacher.mjs`, re-runnable).

AI runs on **Gemini** (`src/lib/ai/models.ts`): turns `gemini-3.8-flash`, speech `gemini-3.8-flash-lite-tts`,
transcription `gemini-3.5-transcribe`. Two things broke in Phase 0 and are now guarded; keep them that way:

1. Gemini rejects a structured-output schema with too many constraint states (`400 too many states for serving`),
   which fails every turn. `src/lib/tutor/turn-schema.ts` carries no number bounds or array length limits;
   `turn-schema.test.ts` enforces it. Bounds belong in the Zod schemas in `events.ts`.
2. Never mute the teacher automatically. Voice is the lesson.

Database: production has every migration in `supabase/migrations` up to and including
`20261120000000_classroom_phase1_security_hardening.sql`. New schema goes in new migration files; the owner
applies them (Supabase SQL editor or `supabase db push`). Agents never apply migrations to production.

## Phase 0 leftovers

- Merge the old AiTutor drawer fully into the teacher dock (one teacher, one surface). **Agent B.**
- Daylight repaint of the language scenes (`docs/rive/DAYLIGHT_SCENES_BRIEF.md`). Needs the Rive CLI signed in;
  not assigned to either agent.

## Phase 1: Teachers (AI co-author). Agent A

Goal: a teacher with a finished lesson gets a working AI Teacher flow in under two minutes, without writing a prompt.

1. **AI Teacher panel in the lesson editor**: "Add an AI teacher to this lesson" → objectives → draft flow → review.
2. **Objective extraction**: from the lesson's blocks (text, glossary, video title/description, quiz) to 2–5
   measurable objectives the teacher can edit.
3. **Flow builder storyboard + AI edit bar**: steps as cards (goal, board content, check question), drag to
   reorder, and a one-line instruction bar ("make step 2 easier", "add a kwacha example") that rewrites the flow.
4. **Test as student**: run the draft in a preview session without publishing and without counting usage
   against learners.
5. **Six templates**: Explain & check, Worked example, Role-play, Oral check (viva), Debate/defend, Revision sprint.
6. **teacher_moments** (schema): a lesson can hold several short teacher moments at chosen points (after a video,
   before a quiz) instead of one block at the end.

## Phase 2: Students (memory everywhere). Agent B

Goal: the teacher remembers what each learner knows and acts on it.

1. **learner_mastery + evidence**: persist `note_evidence` (objective, result, detail) per learner and objective;
   roll up to a mastery level.
2. **Report card v2**: objectives met / partial / to review, with the evidence, next step and a "practise this"
   button.
3. **Dashboard daily plan**: "Today with Tinashe": 1–3 short items picked from weak objectives and unfinished lessons.
4. **Lesson-aware dock**: `show_lesson_ref` seeks the lesson video to `seconds`; the dock uses the board.
5. **Revision sprint**: a 5-minute session built from the learner's weakest objectives.
6. Quiz host and new scenes (Office desk, Boardroom, Quiz stage, Market) come after this phase; not in scope.

## Phase 3: Scale (later, not assigned)

Academy-branded teacher, insights and misconceptions for teachers, course autopilot, certificate viva, new faces
(Maureen, Banda, Amina, Chanda), more scenes and packs.

## Decisions still open (owner)

- Provider: stay on Gemini for everything (current), or Claude for authoring? The briefs assume Gemini via the
  existing helpers; keep provider calls behind `src/lib/ai/` so this can change later.
- Local languages (Bemba, Nyanja, Tonga) at launch or later.
- Certificate viva: optional per course or required.

## How the two agents avoid collisions

| Area | Agent A (authoring) | Agent B (learner) |
|---|---|---|
| `src/components/creator/**`, `src/components/tutor/studio/**` | owns | no |
| `src/actions/tutor-authoring.ts`, `src/actions/tutor-scenarios.ts`, `src/app/api/ai/generate-tutor-scenario/**` | owns | no |
| `src/components/learner/**`, `src/components/tutor/practice/**`, dashboards | no | owns |
| `src/lib/tutor/finalize.ts`, `report-model.ts`, `src/lib/tutor/server/report.ts` | no | owns |
| `events.ts`, `turn-schema.ts`, `src/lib/tutor/server/prompt.ts`, `skill-packs.ts` | read only | owns; additive changes only, tell A |
| New files | `src/lib/tutor/authoring/**` | `src/lib/tutor/mastery/**` |
| Migrations | `2026112200000x_…` | `2026112300000x_…` |

Each agent works on its own branch from `origin/main`, opens a PR, and does not push to `main` (pushing `main`
deploys production).
