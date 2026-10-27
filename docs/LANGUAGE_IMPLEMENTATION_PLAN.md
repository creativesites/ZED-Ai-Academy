# AI Teacher & Language Learning — End-to-End Implementation Plan

Version 1.0 · 2026-10-27
Builds on: `docs/LANGUAGE_LEARNING_PLAN.md` (the why and what), `docs/rive/TEACHER_RIVE_BRIEF.md` + `docs/rive/teacher.contract.json` (the character), `docs/prototypes/speaking-room.html` (the target experience).

## 0. Decisions so far

| Decision | Choice |
|---|---|
| Languages | Mandarin first, then Spanish and French |
| Avatar platform | Rive, half-body characters, Duolingo-like warm style, original characters |
| AI | Gemini 3.8 family now (Live, Flash, Flash TTS) + 3.5 Transcribe, behind a provider registry |
| Tiers | **Not tiered yet.** Build Text, Voice and Live as **modes** of one engine. Modes double as automatic fallbacks. Tiers can later map plans to allowed modes. |
| Exams | Align to HSK (with HSKK speaking), DELE and DELF/DALF |
| Mobile | Later. **Web (Next.js) first**: everything must be testable and showcased on the site before the mobile app starts. The Expo app (M3) reuses the same Rive file and engine code. |
| Name | **ZAI Tutor** (code: `tutor`). It absorbs today's text AI tutor (`/api/ai/tutor`), which becomes ZAI Tutor's Text mode. |
| Two ways to use it | **Tutor-led lessons** set by a teacher inside a course, and **Practice Room** free practice. Both run on the same session engine (§2.5). |
| Scope beyond languages | The system is called **ZAI Tutor**; its engine is subject-agnostic, so healthcare, mining safety and other programs can reuse it |

## 1. Architecture at a glance

```
            ┌───────────────────────────── packages/tutor-core (shared TS) ─────────────────────────────┐
            │ contract (from teacher.contract.json) · TeacherEvent types · scenario schema (zod)           │
            │ viseme-from-audio analyser · pitch tracker · mode policy · skill packs (zh, es, fr, health)  │
            └───────────────▲───────────────────────────────────────────────────────▲─────────────────────┘
                            │                                                       │
   Next.js web app (this repo root)                                     apps/mobile (Expo, React Native)
   - Practice Room, lesson player, studio                                - Practice Room, deck, progress
   - <RiveTeacher> via @rive-app/react-*                                 - <RiveTeacher> via rive-react-native
   - API routes: sessions, turns, tokens, reports                        - same API routes (Clerk session token)
                            │                                                       │
                            ▼                                                       ▼
            Supabase (Postgres + Storage, RLS on Clerk `sub`)          Gemini APIs (browser/device ↔ Live via
            personas · scenarios · sessions · turns · feedback          ephemeral token; server ↔ Flash, TTS,
            profiles · vocab/SRS · exam maps · usage ledger              Transcribe)
```

**Showcase (decided 2026-10-27):** a public `/ai-tutor` page (scripted demo for anyone, live demo for signed-in users, no DB needed) plus a seeded free demo course "ZAI Tutor Showcase: Speak from Day One" using the `tutor_session` block once the tutor schema is applied.

**Code location (decided 2026-10-27):** the shared core starts as `src/lib/tutor/` (pure TS, relative imports only, `node --test` tests) so the web build doesn't change yet. It moves to `packages/tutor-core` with npm workspaces at the start of M3 (mobile), when a second consumer exists. New tables are prefixed `tutor_` (e.g. `tutor_sessions`), and the old broken `practice_sessions` table is left alone until it's dropped.

Rules that carry over from the existing codebase:
- Auth is **Clerk**; DB writes go through server actions/routes using the service client with explicit authorization checks (same pattern as `src/actions/practice-exercises.ts`).
- New RLS policies use `(auth.jwt() ->> 'sub')`, **never `auth.uid()`** (Clerk IDs are text). Several existing policies still use `auth.uid()` (e.g. `20260508000000_company_branding.sql`); audit them in WS0.
- Every new table has `company_id` (tenant) and is scoped by `company_members`.
- No API keys in the client. Live uses short-lived ephemeral tokens minted per session.

## 2. ZAI Tutor engine (subject-agnostic core)

### 2.1 Concepts

| Concept | What it is | Example |
|---|---|---|
| **Persona** | A teacher character: Rive variant (colours, hair, outfit, prop), Gemini voice, personality prompt, languages, default scene | Lín Lǎoshī, Sofía, Camille, Nurse Tendai |
| **Skill pack** | Subject-specific tools, prompt fragments, feedback rubric and UI widgets | `language-zh` (tones, pinyin, hanzi), `language-es`, `language-fr`, `health-sim` (case cards, Calgary-Cambridge rubric), `general-tutor` |
| **Scenario** | A scene to practise: goal, persona role, beats, target items, level, time box, skill pack, scene backdrop | "Greetings at the tea house" (HSK1), "Ordering coffee" (A1), "Taking a patient history" |
| **Session** | One run of a scenario by a learner in a mode | 6-minute Live session |
| **Turn** | One exchange (learner input + teacher output + events) | — |
| **TeacherEvent** | The only thing the avatar and UI listen to, identical across modes | `gesture`, `say`, `show_card`, `trace_tone` |
| **Report** | Post-session feedback, scores (guidance only), new items for the deck | Report card |

### 2.2 Event contract (shared by all modes, web and mobile)

```ts
// packages/tutor-core/src/events.ts
export type TeacherEvent =
  | { type: "say"; text: string; romanization?: string; translation?: string; audio?: AudioRef }
  | { type: "gesture"; name: Gesture; toneShape?: ToneShape; countTo?: number }
  | { type: "mood"; mood: Mood; intensity?: number }
  | { type: "show_card"; item: { text: string; pron?: string; meaning?: string; audio?: AudioRef; vocabId?: string } }
  | { type: "show_text"; text: string; highlight?: string[] }           // whiteboard
  | { type: "trace_tone"; tones: ToneShape[]; labels?: string[] }       // zh tones, es/fr intonation
  | { type: "listen"; expect?: string; hint?: string }                  // learner's turn
  | { type: "note_mistake"; said: string; correct: string; category: string } // silent, for the report
  | { type: "advance_scene"; beat: string }
  | { type: "end_session"; summary?: string };
// Gesture, ToneShape, Mood are generated from docs/rive/teacher.contract.json
```

- **Live mode:** these are Gemini Live **function declarations** (non-blocking); `say` comes from native audio + output transcription.
- **Voice/Text modes:** Gemini 3.8 Flash returns **structured JSON** `{ events: TeacherEvent[] }` (response schema enforced); `say` text goes to TTS.
- A single `EventPlayer` turns events into Rive view-model writes and UI actions, so the avatar never knows which mode is running.

### 2.3 Modes, not tiers

| Mode | Pipeline | Used when |
|---|---|---|
| **Live** | Device ↔ `gemini-3.8-live` (ephemeral token), tool calls → events | Default when network is good and the scenario allows it |
| **Voice** | Hold-to-talk → `gemini-3.5-transcribe` → `gemini-3.8-flash` (JSON events) → `gemini-3.8-flash-lite-tts` | Fallback when Live latency/packet loss is high, or Live quota is used up |
| **Text** | Typed input → `gemini-3.8-flash` → TTS (optional) | Mic denied, quiet places, very low data |

`ModePolicy` (in `tutor-core`) picks the starting mode from tenant config + device capability + measured RTT, and downgrades mid-session without losing context (the transcript so far seeds the next mode). Later, a plan → allowed modes mapping turns this into tiers with no new code.

### 2.4 Prompt architecture (cached)

```
[system, cached]  platform rules · safety · event/tool contract
[system, cached]  skill pack (e.g. language-zh: tone teaching method, sandhi rules, correction style)
[system, cached]  persona (personality, catchphrases, language policy: % target language by level)
[system]          scenario (goal, beats, target items, level, time box)
[system]          learner memory (name, goals, recent mistakes, level estimate)
[history]         turns so far
```

Course content is injected via the shared `blockToText()` (WS0) so the teacher stays grounded in what the course actually teaches.

### 2.5 How ZAI Tutor is used: teacher-led and free practice

Every session has an **origin**. Origin decides who sets the rules; the engine, avatar and report are the same for all of them.

| Origin | Who starts it | Where | Who controls content | Counts toward | Teacher sees it |
|---|---|---|---|---|---|
| `lesson` (**Tutor-led lesson**) | Learner, from a `tutor_session` block the teacher placed in a lesson | Lesson player (full-screen overlay) | **Teacher**: picks persona and scenario, sets strictness, time box, allowed modes, target items. Can mark it required. | Lesson completion (finishing counts; no pass mark) | Yes: gradebook + review queue |
| `assignment` | Teacher assigns a scenario to a class or group with a due date (e.g. warm-up before a live class) | Learner dashboard + Practice Room "Assigned" shelf | Teacher | Assignment completion | Yes |
| `practice` (**Practice Room**) | Learner, any time | Practice Room (`/practice`, tenant `academy/[domain]/practice`) | **Learner** picks from the library (tenant scenarios + platform starter packs) or "free talk"; the engine adapts to their level, course progress and mistakes | Streak, speaking minutes, deck, level progress | Aggregates only (minutes, level, common mistakes), unless the learner shares a session or it's flagged |
| `ask` (**Ask the Tutor**) | Learner, from any lesson | Lesson player side panel (replaces today's text AI tutor) | Learner question, grounded in the lesson via `blockToText` | Nothing | Aggregates only |
| `placement` | Learner, on joining a language course | Onboarding | Engine | Sets level estimate + plan | Result only |

**Tutor-led lesson styles** (set on the `tutor_session` block):
1. **Practice scene**: a role-play at the end of a lesson ("order at the tea house using today's words").
2. **Guided lesson**: the tutor *teaches* the lesson. The block points at the lesson's own blocks (vocab sets, dialogues, grammar notes); the tutor walks through them as beats, explains, checks understanding with quick spoken questions, and then runs a short practice scene. This lets a teacher turn any existing lesson into a tutor-led one without writing a script.
3. **Oral check**: an exam-style speaking task (HSKK, DELE, DELF formats) with a rubric.

**Rules that tie it together**
- **Scenarios are reusable.** A scenario lives in `practice_scenarios` with `visibility`: `course` (only via its lesson block/assignment), `tenant_library` (also in the Practice Room for the tenant's learners), or `platform` (ZAI starter packs any tenant can enable). A teacher can publish a lesson's scenario to the library with one switch.
- **Free practice is personalised from course data.** The Practice Room suggests scenes from the learner's enrolled courses, recent lessons and due deck items, so free practice reinforces what the teacher taught.
- **Entitlements without tiers.** Each tenant sets `tutor_settings`: Practice Room on/off, monthly free-practice minutes per learner, allowed modes, which personas are available. Tutor-led lessons are always allowed for enrolled learners (they're part of the course the learner paid for); their minutes are tracked but not capped by the free-practice allowance. Paid tiers later just change these settings per plan.
- **Privacy split.** Lesson and assignment sessions are visible to the course's teachers. Practice Room sessions are private by default, except aggregates and safety flags.
- **One memory.** The learner profile (level, mistakes, goals) is shared across all origins and personas, so the tutor that teaches a lesson remembers what you practised freely last night.

Schema additions for this: `practice_sessions_v2.origin`, `practice_sessions_v2.lesson_id`, `practice_sessions_v2.assignment_id`; `practice_scenarios.visibility` and `practice_scenarios.style` (`scene` | `guided_lesson` | `oral_check`); new tables `tutor_assignments` (scenario, class/group, due date) and `tutor_settings` (per tenant).

## 3. Data model (Supabase migrations)

Migration file: `supabase/migrations/2026110x000000_ai_teacher_engine.sql`. Sketch (columns abbreviated):

```sql
create table ai_personas (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  name text not null, display_name text, languages text[] not null,
  rive_variant jsonb not null,          -- {skinColor, hairColor, outfitPrimary, ..., hairStyle, outfitStyle, prop}
  voice jsonb not null,                 -- {provider:'gemini', voiceName, speakingRate}
  personality_prompt text not null, default_scene text,
  is_active boolean default true, created_at timestamptz default now()
);

create table practice_scenarios (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  course_id uuid references courses(id), lesson_id uuid references lessons(id),
  skill_pack text not null,             -- 'language-zh' | 'language-es' | 'language-fr' | 'health-sim' | 'general-tutor'
  persona_id uuid references ai_personas(id),
  title text not null, goal text not null, beats jsonb not null default '[]',
  target_items jsonb not null default '[]', level text,  -- 'HSK1', 'A1', ...
  exam_task text,                       -- e.g. 'HSKK-beginner-repeat', 'DELF-A1-oral-dialogue'
  max_minutes int default 8, allowed_modes text[] default '{live,voice,text}',
  scene text, status text default 'draft', created_by text, created_at timestamptz default now(),
  visibility text not null default 'course',   -- 'course' | 'tenant_library' | 'platform'
  style text not null default 'scene'          -- 'scene' | 'guided_lesson' | 'oral_check'
);

create table practice_sessions_v2 (     -- replaces the broken practice_sessions (uuid auth.users FK)
  id uuid primary key default gen_random_uuid(),
  company_id text not null, user_id text not null, scenario_id uuid references practice_scenarios(id),
  origin text not null,                 -- 'lesson' | 'assignment' | 'practice' | 'ask' | 'placement'
  lesson_id uuid references lessons(id), assignment_id uuid,
  mode text not null, mode_changes jsonb default '[]',
  started_at timestamptz default now(), ended_at timestamptz,
  learner_speaking_ms int default 0, teacher_speaking_ms int default 0,
  status text default 'active',         -- active | completed | abandoned | flagged
  audio_path text, consent_audio boolean default false
);

create table practice_turns (
  id bigserial primary key, session_id uuid references practice_sessions_v2(id) on delete cascade,
  idx int not null, learner_text text, learner_audio_ms int, teacher_events jsonb not null,
  latency_ms int, created_at timestamptz default now()
);

create table practice_reports (
  session_id uuid primary key references practice_sessions_v2(id) on delete cascade,
  scores jsonb,                          -- {fluency, accuracy, vocabulary, pronunciation, task} 0-100, guidance only
  strengths jsonb, mistakes jsonb, tone_stats jsonb, next_scenario_id uuid, created_at timestamptz default now()
);

create table learner_language_profiles (
  company_id text not null, user_id text not null, language text not null,
  level_estimate text, framework text,   -- 'HSK3' | 'CEFR'
  can_do jsonb default '[]', memory jsonb default '{}', streak_days int default 0,
  total_speaking_ms bigint default 0, updated_at timestamptz default now(),
  primary key (company_id, user_id, language)
);

create table vocab_items (
  id uuid primary key default gen_random_uuid(), company_id text not null, language text not null,
  text text not null, pron text, meaning text, level text, audio_path text, examples jsonb, tags text[]
);
create table learner_vocab (
  user_id text not null, vocab_id uuid references vocab_items(id), company_id text not null,
  due_at timestamptz, interval_days real, ease real default 2.5, reps int default 0, lapses int default 0,
  source text,                            -- 'lesson' | 'mistake' | 'manual'
  primary key (user_id, vocab_id)
);

create table exam_frameworks (            -- seed data: HSK 2.0 (1-6), HSK 3.0 (1-9), HSKK, CEFR (A1-C2) for DELE/DELF
  id text primary key, language text, levels jsonb, speaking_tasks jsonb
);

create table ai_usage_ledger (
  id bigserial primary key, company_id text not null, user_id text, session_id uuid,
  model text not null, kind text not null, -- 'live_audio_in' | 'live_audio_out' | 'tts' | 'transcribe' | 'llm'
  units bigint not null, unit text not null, est_cost_usd numeric(10,5), created_at timestamptz default now()
);
```

RLS: learners read/write their own rows (`user_id = auth.jwt() ->> 'sub'`); instructors/admins of the tenant read sessions and reports for their company; personas/scenarios are readable by tenant members, writable by tenant staff. Storage bucket `practice-audio` (private, signed URLs, 30-day lifecycle unless saved) and `tts-cache` (public-read by hash, immutable).

## 4. Workstreams

Each workstream lists the main files. Order and timing are in §6.

### WS0 — Foundations and course studio fixes
- `src/lib/ai/models.ts` (task → model registry) replacing `GEMINI_MODEL` in the 12 call sites; `src/lib/ai/providers/gemini.ts`.
- `src/lib/course-blocks/block-to-text.ts`: one function for all 22+ block types; used by tutor, quiz gen, teacher prompts.
- Remove `window.location.reload()` in `src/components/creator/ai-lesson-generator.tsx:80`; insert blocks into editor state.
- Audio as first-class media: upload, record in browser, TTS-generate in `src/components/admin/media-manager.tsx`.
- RLS audit: replace `auth.uid()` policies with `auth.jwt() ->> 'sub'`.
- Usage metering + per-user rate limits on all AI routes (writes `ai_usage_ledger`).
- Update `CLAUDE.md` / `docs/ROADMAP.md` model references to the registry.

### WS1 — ZAI Tutor engine (server)
- `packages/tutor-core/` (new npm workspace): `contract.ts` (generated from `docs/rive/teacher.contract.json` by `scripts/gen-contract.ts`), `events.ts`, `scenario.ts` (zod), `mode-policy.ts`, `skill-packs/*`.
- API routes:
  - `POST /api/tutor/sessions`: auth, enrollment + quota check, build prompt, pick mode, create session row, **mint Live ephemeral token** (single use, locked to model + config + tools), return `{ sessionId, mode, liveToken?, persona, scenario }`.
  - `POST /api/tutor/sessions/[id]/turn`: Voice/Text modes: audio or text in → Transcribe → Flash (JSON events) → TTS (cache by hash) → `{ events, audioUrl }`.
  - `POST /api/tutor/sessions/[id]/events`: client posts Live transcripts/events in batches (for history + reports).
  - `POST /api/tutor/sessions/[id]/complete`: finalize; enqueue report job.
  - `POST /api/tutor/tts`: pre-generate/cached TTS for scripted lines (studio and SRS).
- Report job: `src/lib/tutor/report.ts`: Transcribe (word timings) + Flash rubric → `practice_reports`, `learner_vocab` from mistakes, profile + streak update. Run via a Vercel cron/queue or Supabase function; must be idempotent.
- Live session management: context window compression + session resumption for > 10 min; scenes are designed for 5–10 min anyway.

### WS2 — Avatar runtime (Rive)
- `src/components/tutor/RiveTeacher.tsx` (client): loads `zai_teacher.riv` + scene, binds `TeacherVM`/`SceneVM`, exposes the `AvatarDriver` interface; reads `gesturePeak`/`traceStart`/`traceEnd` events.
- `packages/tutor-core/src/lipsync.ts`: audio → viseme (Web Audio `AnalyserNode` energy + band ratios, smoothed, 30–60 Hz updates). Works on TTS `<audio>` and Live PCM output.
- `src/components/tutor/EventPlayer.ts`: TeacherEvent → avatar + UI (cards, captions, trail, mic state).
- `src/components/tutor/ToneTrail.tsx`: draws the glowing contour from contract paths, mapped from artboard to screen coordinates.
- `/dev/avatar-lab` page (staff only): every view-model property as a control, every gesture button, viseme scrubber, event log, fps meter. Used to accept the Rive agent's deliveries against the contract.
- Contract test (`npm run test:contract`): loads the `.riv` in a headless browser (Playwright, already available) and asserts every property, enum value and event in the contract exists.
- Until the Rive files land: the prototype's SVG character becomes a `PlaceholderTeacher` implementing the same `AvatarDriver`, so WS1/WS3/WS4 aren't blocked.

### WS3 — Language features
- **Mandarin (`language-zh`)**: tone-coloured pinyin component; tone sandhi rules in prompts and UI (3+3 → 2+3, 一/不 changes); **browser pitch tracker** (YIN/autocorrelation in an `AudioWorklet`, in `tutor-core/pitch.ts`) to draw learner vs model pitch lines; tone confusion stats in reports; hanzi stroke-order animation (open-source Hanzi Writer) in `vocab_set` blocks; measure-word and character-component tips.
- **Spanish/French (`language-es`, `language-fr`)**: stress and question intonation (same `trace_tone` shapes `rise`/`fall`), French liaison and nasal vowels, Spanish rr/ñ, gender agreement as a mistake category.
- **SRS deck**: SM-2-style scheduling in `tutor-core/srs.ts`; review UI with audio, spoken recall ("say it"), and cards from mistakes.
- **Exam alignment** (`exam_frameworks` seed + level tags on scenarios, vocab and blocks):
  - **HSK**: store both HSK 2.0 levels 1–6 and the HSK 3.0 standard's 9 levels; vocab lists per level; **HSKK** speaking task formats (repeat after recording, describe a picture, answer questions) as scenario templates.
  - **DELE** (Spanish) and **DELF/DALF** (French): CEFR A1–C2; oral tasks (guided interview, information exchange, role-play / monologue) as scenario templates.
  - Mock speaking exams: timed scenario runs with an exam-style rubric and a "predicted band" (guidance only, clearly labelled as an estimate).

### WS4 — Learner experience (web)
- **Practice Room**: `src/app/(learning)/practice/page.tsx` + tenant route `academy/[domain]/practice`. Scene + teacher + captions + cards + mic, as in the prototype. Persona greeting, today's scene, deck due count, streak, level progress.
- **Lesson integration**: `tutor_session` block renders a "Practise with Lín Lǎoshī" card in `lesson-player-client.tsx` that opens the Practice Room overlay with that scenario.
- **Report card**: transcript with corrections (tap to hear), tone chart (zh), new words, next scene.
- **Placement chat**: 5-minute adaptive conversation → level estimate (HSK/CEFR) + plan.
- **Progress**: can-do statements per level, speaking minutes, words mastered, exam readiness.
- Accessibility: captions always on, `reducedMotion` respected, full keyboard support, text mode always available.

### WS5 — Course studio (creator)
- New block types (migration + `BLOCK_META` + editors + renderers + `blockToText`): `vocab_set`, `dialogue`, `pronunciation_drill`, `tutor_session`, `listening_check`, `grammar_note`, `shadowing`.
- **Scenario builder**: pick persona, skill pack, level, exam task; AI drafts beats and target items from the lesson; test-run it in a side panel with the real teacher.
- **Language course preset** in `course-domain-presets.ts` + generators (`generate-curriculum`, `generate-lesson-content`): "HSK1 Mandarin for healthcare workers" produces lessons with vocab sets, dialogues (TTS audio generated and cached), grammar notes and scenarios.
- **Lesson templates**: "Language lesson: warm-up → vocab → dialogue → grammar → speaking scene → review".
- Draft vs published lesson versions (so editing a live course doesn't change what learners see mid-lesson).

### WS6 — Teachers and tenant admins
- Classroom gradebook columns (`src/components/classroom/GradebookTab.tsx`): speaking minutes, scenes completed, weakest skill, tone accuracy (zh).
- Review queue: flagged sessions (low confidence, distress, safety) and learner-requested reviews; teacher can add a voice note.
- Assign scenarios before/after live classes (ties into `TimetableTab`).
- Persona manager for tenant admins (choose from the Rive cast, recolour within brand, pick voice, edit personality).
- Usage and cost dashboard per tenant from `ai_usage_ledger`.

### WS7 — Mobile app (Expo / React Native)
- Location: `apps/mobile` in this repo (npm workspaces: root Next app + `packages/*` + `apps/*`), sharing `tutor-core`.
- Auth: Clerk Expo SDK; API calls with Clerk session token to the same Next.js routes.
- Avatar: `rive-react-native` with the same `zai_teacher.riv`; same `EventPlayer` logic (platform adapters for audio and Rive).
- Audio: native module for 16 kHz PCM mic streaming and low-latency playback; Live connection from device with the ephemeral token; Voice/Text modes via the turn API.
- Screens: Today (scene + streak), Practice Room, Deck, Progress, Course lessons (light reader; full studio stays web).
- Offline: cache `.riv` files, TTS audio, deck; queue reports when offline.
- Push notifications: daily practice reminder with the persona's line ("Lín Lǎoshī: 6 minutes at the tea house today?").
- Release: internal testing (TestFlight / Play internal) → pilot tenant → store release.

### WS8 — Quality, safety, analytics
- **Tests**: unit (lipsync, pitch, SRS, mode policy, contract parsing), API integration (session lifecycle, quotas, RLS), Playwright (Practice Room happy path with a mocked Gemini, avatar lab contract test).
- **Prompt evals**: golden scenarios per skill pack with scripted learner inputs; LLM-judge rubric for staying in level, correction style, target-language ratio, safety; run on every prompt change.
- **Observability**: latency p50/p95 per mode (learner stops speaking → teacher audio starts), mode fallback rate, error rate, cost per session.
- **Safety & privacy**: consent for audio retention, minors defaults, AI disclosure badge, content filters, data processing agreement with tenants (Zimbabwe Cyber and Data Protection Act 2021).
- **Success metrics**: weekly speaking minutes per learner, D7/D30 retention, scenes per week, deck review completion, level progress, NPS from the pilot.

## 5. Generalizing beyond languages

The engine is the product; languages are the first skill packs.

| Program | Skill pack | Persona | What changes |
|---|---|---|---|
| Healthcare | `health-sim` | Nurse Tendai (trainer) + patient personas | Case cards (hidden symptoms/history), communication rubric, clinical guardrails, `Scene_Clinic` |
| Mining safety | `safety-drill` | Safety officer | Hazard-spotting scenes, procedure checklists as beats, `show_text` for steps |
| Any course | `general-tutor` | Course's chosen persona | "Ask the teacher" voice tutor grounded in lessons via `blockToText` |
| Exam prep (any) | `exam-coach` | Persona per subject | Timed mock oral exams with rubric |

Adding a program = a skill pack (prompt + tools + rubric + optional widgets) + scenarios. No new avatar or engine code.

## 6. Milestones and sequencing

Solo founder + coding agents + a Rive agent working in parallel. Weeks are targets.

| Milestone | Weeks | Scope | Definition of done |
|---|---|---|---|
| **M0 Spikes + art kickoff** | 1–2 | Live voice loop with ephemeral token from Harare/Lusaka; Voice-mode turn loop; browser pitch tracker spike; Mandarin tone recognition test; cost logging. **Rive agent steps 1–2** (style frames, character sheets). | Measured latency and cost per mode; style frame chosen; contract v1 frozen |
| **M1 Web MVP: Mandarin greetings** | 3–6 | WS0 essentials (registry, blockToText, reload fix, metering); WS1 sessions/turn/report; WS2 RiveTeacher + EventPlayer + avatar lab (placeholder teacher until Rive lands); Practice Room; report card; 3 HSK1 scenarios; `tutor_session` block. **Rive agent steps 3–5** (rig, visemes, gestures). | A learner completes a 6-minute Mandarin scene in Live mode with Lín Lǎoshī (real Rive), falls back to Voice on bad network, gets a report; staff can author a scenario in the studio |
| **M2 Language toolkit + cast** | 7–10 | Blocks (vocab_set, dialogue, drill, listening, grammar, shadowing); SRS deck; tone chart; HSK/HSKK framework + exam templates; Spanish and French skill packs; placement chat; gradebook columns, review queue, assignments, persona manager. **Rive agent steps 6–8** (variants, bust, scenes, QA). | One complete HSK1 unit authored in the studio with AI help; Sofía and Camille live; teachers see speaking data in the gradebook |
| **M3 Mobile beta** | 11–14 | Expo app with Practice Room, deck, progress, push; offline caching; internal test builds. | Same Mandarin scene runs on a mid-range Android at 60 fps with Live/Voice modes |
| **M4 Pilot + healthcare** | 15–18 | Pilot with the client's Mandarin cohort; DELE/DELF templates; `health-sim` pack with Nurse Tendai; mock oral exams; cost dashboard; store release prep. | Pilot cohort using it weekly; retention and speaking-minute baselines; client sign-off for rollout |

Critical path: contract freeze (M0) → Rive rig + visemes (M1) → RiveTeacher integration. The placeholder teacher keeps everything else moving if the art slips.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Rive art quality or timing slips | Placeholder teacher behind the same interface; checkpoints in the brief; budget a human animator polish pass for the hero character |
| Live latency from Zimbabwe/Zambia | Measure in M0; Voice mode fallback; regional endpoint choice; short scenes |
| Tone feedback accuracy | Client-side pitch tracking for the numbers, Gemini only for coaching words; teacher review for flagged cases |
| Costs grow with usage | Usage ledger + quotas per tenant; cached TTS; Voice/Text modes; prompt caching |
| React Native Rive data binding gaps | Brief requires state machine input mirrors as a fallback |
| Model/API changes (3.x previews retire) | Provider registry; pin GA models; contract tests |
| Learner trust/safety (minors, health content) | Disclosure, consent, guardrails, review queue, no medical advice framing |

## 8. This week

1. Send the Rive agent `docs/rive/TEACHER_RIVE_BRIEF.md` + `docs/rive/teacher.contract.json` + the prototype; ask for step 1 (3 style frames).
2. M0 spikes: Live ephemeral-token loop and Voice turn loop in a throwaway branch; record latency and cost.
3. WS0 PRs: model registry, `blockToText`, reload fix (small, low-risk, unblock everything).
4. Reach out to the client owner: confirm HSK version their learners sit (2.0 vs 3.0), cohort size for the pilot, and devices.
