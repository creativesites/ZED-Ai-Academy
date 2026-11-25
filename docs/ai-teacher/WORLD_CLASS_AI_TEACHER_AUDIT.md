# World-Class AI Teacher — Audit of the current system

Status: 2026-11-24. Audited against `main` at `911a069` **plus the uncommitted working tree** (17 modified files,
mostly avatar, `/try`, dock and quiz player). The code is the source of truth; where docs disagree the code wins and
the discrepancy is listed in §9.

Legend: **[V]** verified by reading the code (file:line given), **[I]** inferred, **[U]** unverifiable from the repo
(needs production access).

Companion documents: [Product vision](WORLD_CLASS_AI_TEACHER_PRODUCT_VISION.md) ·
[Architecture](WORLD_CLASS_AI_TEACHER_ARCHITECTURE.md) · [Roadmap & backlog](WORLD_CLASS_AI_TEACHER_ROADMAP.md) ·
[UX spec](WORLD_CLASS_AI_TEACHER_UX_SPEC.md) · [Decisions](WORLD_CLASS_AI_TEACHER_DECISIONS.md)

---

## 0. Executive summary

CS Learn already has more AI-teacher capability than most commercial platforms: a typed event contract that
drives a speaking avatar and a teaching board, three conversational modes (Gemini Live, voice turns, text turns),
per-objective evidence and mastery, report cards, revision sprints, a daily plan, AI-assisted authoring with
objectives → storyboard → test-as-student, Course Autopilot, Certificate Viva, teacher insights and misconception
analysis, local-language skill packs, and a lite/data-saver mode. 397 unit tests pass.

The problem is not missing features. It is that **the features do not yet add up to one teacher with one memory**,
and that the speed of delivery has left **security and data-integrity debt** that must be paid before scaling to
institutions.

The five findings that matter most:

1. **Security and tenant isolation (blocker for B2B scale).** All server code uses the Supabase service role
   (`src/lib/supabase/server.ts:7-12`), so isolation depends entirely on application checks — and several are missing.
   Verified: cross-tenant scenario writes via `upsertScenario`; learners can mint mastery for any course; learners can
   write vocabulary into any tenant; the daily plan lists other tenants' flows; stress-test is open to any signed-in
   user; public `/try` report calls bypass the rate limiter. See §6.
2. **Two teachers, not one.** The lesson dock (`/api/ai/tutor`) is a completely separate AI stack — its own prompt, its
   own `:::directive:::` markup, no event contract, no server-side history, no metering, no caching, no evidence
   capture. Its chat history lives only in `localStorage`. The Practice Room is a different engine; the vocab deck uses a
   third (browser) voice stack. See §3.
3. **Mastery is built on unstable foundations.** Objective keys are derived from free model text
   (`mastery/evidence.ts:44-64`), so the same concept fragments into many rows, non-Latin objectives collapse to
   `general-objective`, and creator-authored objectives are never persisted. All evidence is AI- or client-reported;
   quiz results never feed mastery; there is no decay; the unique key ignores tenant. See §4.
4. **No quality assurance worth the name.** The "stress test" is three single-turn probes with regex heuristics at
   temperature 0.8, no lesson grounding, results not saved. Autopilot and Fix-It publish straight to learners on live
   courses. No versioning: in-flight sessions re-read the live scenario every turn. See §5.
5. **Deployment state is unknowable from the repo.** The production baseline migration cited by the plan
   (`20261120000000_classroom_phase1_security_hardening.sql`) does not exist in any branch; two migrations share version
   `20261124000000`; recent tutor migrations degrade silently when missing, so a missing migration looks like an empty
   feature rather than an error. See §7.

Recommended stance: **consolidate before expanding.** Phase 0 (security + deployment truth + docs) and Phase 1 (one
teacher, one memory) unlock everything else. Nothing in this audit argues for a rewrite; the engine core
(`runTutorTurn`, event contract, pure tested modules) is sound and should be the foundation.

---

## 1. Inventory: what exists

### 1.1 Status matrix

| Capability | State | Evidence |
|---|---|---|
| Event contract v2 (20 event types, 9 board kinds) | **Working** | `src/lib/tutor/events.ts:21-143` [V] |
| Voice & text turn sessions | **Working** | `api/tutor/sessions/**`, `turn-pipeline.ts:89-178` [V] |
| Gemini Live sessions | **Working on client**, server trusts client transcripts | `live-client.ts`, `TutorSession.tsx:719-805` [V]. Docs say "not built" — stale |
| Lesson dock ("Ask Tinashe") | **Working, separate stack** | `api/ai/tutor/route.ts`, `components/learner/ai-tutor.tsx` [V] |
| Teacher moments in lessons | **Working** (needs migration `20261122…`) | `lesson-player-client.tsx:728-823` [V]; prod state [U] |
| Required moments gate completion | **Working**, server-enforced | `actions/certificates.ts:164`, `required-tutor-blocks.ts` [V] |
| Evidence → mastery | **Working, weak model** | `mastery/evidence.ts`, `mastery/server.ts` [V] |
| Report card v2 | **Working, stored levels wrong** | `finalize.ts:137` stores `nextMasteryLevel(0,…)` [V] |
| Daily plan ("Today with …") | **Working, tenant leak** | `dashboard/page.tsx:546` passes no `companyId` [V] |
| Revision sprint | **Working** | `mastery/sprint.ts`, `/practice/sprint` [V] |
| Certificate Viva | **Working**, AI-only pass/fail, fail-open | `lib/tutor/viva.ts`, `server/viva.ts:45-77` [V] |
| Vocab SRS (SM-2 variant) | **Working, vocab only** | `srs.ts:38-97` [V] |
| Teacher insights / misconceptions | **Working, sampled (400 rows), no cohort filter, privacy issue** | `insights/server.ts` [V] |
| AI authoring (objectives → draft → revise → preview) | **Working** | `lesson-ai-teacher-panel.tsx`, `api/ai/teacher/*` [V] |
| Six templates | **Working** | `authoring/templates.ts` [V] |
| Course Autopilot | **Working, unsafe publish defaults** | `api/ai/teacher/autopilot/route.ts:320` [V] |
| Stress test / QA | **Prototype** | `authoring/stress-test.ts` [V] |
| Fix-It flows | **Prototype**, auto-publishes, not targeted | `tutor-authoring.ts:652-706` [V] |
| Personas (look, voice, glossary, engine) | **Working** | `PersonaStudio.tsx`, `persona-presets.ts` [V] |
| Skill packs (8) | **7 have prompts**; `health-sim` falls back | `skill-packs.ts:28-79` [V] |
| Local languages (bem, ny, tog) | **Packs exist, quality unvalidated** | `skill-packs.ts`, `speech-lang.ts` [V]; quality [U] |
| Speaking assignments, review queue, gradebook metrics | **Working, tenant-wide, unscoped refs** | `tutor-authoring.ts:1169-1748` [V] |
| AI usage dashboard | **Working, under-counts** (most generation routes unmetered) | `tutor-authoring.ts:1637` [V] |
| Public `/try` mini-lessons, `/ai-tutor` showcase | **Working**, anonymous, in-memory limits | `public-try.ts`, `api/tutor/try` [V] |
| Avatars: Rive, Three.js, SVG placeholder | **Working**, three render paths | `avatar/Teacher.tsx:12-75` [V] |
| Lite / data-saver mode | **Working in session & dock; ignored by block card, deck, start panel** | `use-lite-mode.ts` [V] |
| Prompt caching | **Partial**: per-session only | `server/prompt-cache.ts` [V] |
| Learner-visible memory / correction / deletion | **Not built** | — |
| Scenario/persona versioning | **Not built** | — |
| Quiz → mastery | **Not built** | `quiz-player.tsx` [V] |
| Concept-level spaced repetition | **Not built** | — |
| `ask` and `placement` session origins | **Not built** | `TUTOR_API.md` [V] |
| Observability (traces, metrics, alerts) | **Not built** (console logs only) | — |

### 1.2 Size and health

- `npm run test:tutor`: **397 pass / 0 fail**, 25 suites, 61 test files [V]. Coverage is pure modules only; no route,
  `turn-runner`, `session-context`, `access.ts`, `mastery/server.ts`, `live-client`, `EventPlayer` or RLS tests for the
  new tables.
- `npx tsc --noEmit`: **passes** on the current working tree [V]. (A first run during concurrent editing reported 15
  errors in `public-try.ts`; the file changed mid-run and a second run was clean.)
- God components (lines): `TutorSession.tsx` 1622 (91 hooks), `ThreeTeacher.tsx` 1025, `lesson-player-client.tsx`
  1017, `VocabDeckReview.tsx` 965, `Composer.tsx` 948 (~40 props), `ScenarioEditorModal.tsx` 936,
  `TutorStudioHub.tsx` 906, `PersonaStudio.tsx` 826, `TeachingBoard.tsx` 809 [V].

---

## 2. The teaching engine

### 2.1 Session lifecycle [V]

```
POST /api/tutor/sessions ─ Clerk auth → 30 starts/h (DB) → resolveTutorAccess → chooseStartMode
   │                        → insert tutor_sessions (service role) → loadSessionContext
   ├─ live  → mintLiveToken (single-use, model+prompt+tools locked) → browser ↔ Gemini Live
   │          → POST /events (client-posted transcript + events, batched, upsert on (session_id, idx))
   └─ voice/text → opening turn idx 0 (deferTts) → POST /turn … (one-pass audio→JSON; TTS fetched lazily via /api/tutor/tts)
POST /complete → finalizeTutorSession: idempotent report claim → usage → profile/streak → vocab SRS → mastery
```

Strengths: the pure `runTutorTurn(deps)` pipeline with dependency injection (`turn-pipeline.ts:89-178`) — time box,
60-turn cap, tolerant parsing (drops invalid events, never throws, 12 events max), spoken fallback, debug raw output
stored but stripped from history. Idempotent finalize with a claim row and 23505 race handling. Model fallback chains.
Lazy TTS for fast first audio.

Weaknesses:
- **Full transcript re-sent every turn** (`turn-pipeline.ts:223-245`), no summarisation → token cost grows
  ~quadratically to the 60-turn cap.
- **No server-side teaching state.** Beat position, confidence, evidence so far are not tracked or fed back; the model
  re-infers everything from history each turn. `shouldDowngrade` (`mode-policy.ts:77`) is used only in tests.
- **Scenario re-read on every turn** (`session-context.ts:190-197`): editing or deleting a flow changes or breaks
  in-flight sessions.
- **Failed Live connect leaves an `active` orphan session**; client falls back to a new voice session. No stale-session
  sweeper.
- **Image upload during Live** goes to `/turn`, which returns 409 for Live sessions [I, strong].
- Side effects after the report claim (usage, streak, vocab, mastery) are fire-and-forget with no outbox; a failure is
  lost permanently. `persistSessionMastery` swallows its own errors.
- Routes set no `maxDuration`; `/complete` generates the report synchronously.

### 2.2 Prompt assembly [V]

`buildSystemPrompt` (`prompt.ts:147-166`) layers: platform rules + mode contract + safety → skill-pack fragment →
persona → scenario (beats, targets, time box) → learner memory (≤10 mistakes, ≤10 notes) → lesson text (≤24k chars,
fenced in `<lesson_content>` with an "ignore instructions" guard).

- **Caching defeats itself.** Explicit Gemini caches (`server/prompt-cache.ts`) are created for prompts ≥4,800 chars
  with a 15-minute TTL, but the cached unit is the *whole* system prompt including learner memory, so it never hits
  across learners. The registry is in-process, so cold instances duplicate caches; creation is awaited on the first
  turn. Only session voice/text turns use it.
- Persona `personality_prompt` and scenario fields (tenant-authored) enter the prompt unfenced. Persisted
  model-derived strings (recent mistakes containing learner words, mastery notes) re-enter future prompts — a
  cross-session prompt-injection persistence path [I].

### 2.3 Event contract [V]

20 types. v1: `say, gesture, mood, show_card, show_text, trace_tone, listen, note_mistake, advance_scene, end_session`.
v2: `show_board` (bullets, steps, equation, code, table, note, diagram, chart, compare), `reveal_step, ask_choice,
ask_confidence, show_lesson_ref, play_clip, note_evidence, advance_step, switch_scene, award`. V1 events are kept
forever for replay; aliases (`note_mistake→note_evidence`, `advance_scene→advance_step`) are informational and both
names still play.

Problems:
- **Three hand-maintained copies** of the vocabulary: the Zod union (`events.ts`), the loose Gemini JSON schema
  (`turn-schema.ts:11-32`, deliberately bound-free to avoid `400 too many states`), and the Live tool declarations
  (`events.ts:291-527`). No drift test.
- **No version field** on stored turns or the wire.
- **Interactions not in the contract.** Ordering, fill-in-the-blank and inferred choices are regex-guessed from speech
  (`turn-interaction.ts:18-150`) — fragile, unauthorable, untestable as contract.
- **Board kinds are a closed enum** rendered by an `if/else` chain (`TeachingBoard.tsx:221-455`). Adding a subject widget
  touches ~6 places. The dock has a *second, narrower* board vocabulary (`lesson-seek.ts:64-73` degrades chart, diagram
  and compare to `note`) and a *third* widget vocabulary (`:::directive:::` in `chat-components/MessageContent.tsx`).

### 2.4 Model and provider layer [V]

`src/lib/ai/` is a 3-line `GoogleGenAI` singleton plus `models.ts` (task → model, env-overridable via
`GEMINI_MODEL_<TASK>`). Defaults: turns/reports/authoring `gemini-3.8-flash`, dock `gemini-3.5-flash-lite`, Live
`gemini-3.8-live`, TTS `gemini-3.8-flash-lite-tts`, transcription `gemini-3.5-transcribe`.

- **No provider abstraction.** ~15 call sites use Gemini-specific config directly (`responseJsonSchema`,
  `thinkingLevel`, `cachedContent`, modalities, browser-side Live tokens). Model swaps are an env change; provider swaps
  are a rewrite.
- **No Anthropic code remains**, contrary to `CLAUDE.md` and `docs/ARCHITECTURE.md`.
- Only teacher-authoring uses schema-constrained JSON with fallback (`authoring/server.ts:26-70`); ~9 other generation
  routes hand-roll regex JSON extraction. `generate-tutor-scenario` duplicates `teacher/draft` with a weaker parser.

---

## 3. Fragmentation: how many teachers?

### 3.1 Runtime paths [V]

| # | Path | Prompt | Pipeline | History | Metered | Limits |
|---|---|---|---|---|---|---|
| 1 | Session voice/text | `buildSystemPrompt` | `runTutorTurn` (DB deps) | DB, full | yes | 30 starts/h (DB) |
| 2 | Gemini Live | `buildSystemPrompt('live')` in token | browser ↔ Gemini | Gemini sliding window; client posts transcript | client-reported seconds | 30-min token |
| 3 | `/ai-tutor` showcase | shared + wrap-up | `runTutorTurn` (memory deps) | client | **no** | 40/h in-memory |
| 4 | Public `/try` | shared (DB scenario) | as 3, separate transcription | client (16) | **no** | 24/h/IP in-memory; **report bypasses** |
| 5 | Teacher preview | shared | `runTutorTurn` (own deps) | client | yes | staff check |
| 6 | **Lesson dock** | **separate inline prompt** | `generateContentStream`, plain text + `:::directive:::` | **localStorage**, last 12 | **no** | guests 20/h/IP; **signed-in unlimited** |

Paths 1, 3, 4 and 5 share the core — good. Path 6 shares only `blocksToText`, mastery notes and the teacher name.

### 3.2 Learner-facing surfaces [V]

Lesson dock · lesson `tutor_session` card · teacher moments · Certificate Viva card · Practice library · Practice Room
(`TutorSession`, used by 6 call sites) · Revision sprint · Vocab deck · Speaking history · `/try` · `/ai-tutor` · two
dashboards (platform `/dashboard` with `TutorSpotlightBanner` + `DailyPlanCard`; academy dashboard with three
hand-built tiles + `DailyPlanCard`) · a third summary inside `PracticeLibrary` · `PracticeStudio` (prompt tools, a
different product sharing the word "practice").

Voice stacks: dock `TeacherAudio` with hard-coded voice `"Kore"`/`"en"` (`ai-tutor.tsx:114-117`); session persona voice;
deck uses browser `speechSynthesis` (`VocabDeckReview.tsx:94-172`). The deck picks Tinashe by array index
(`PERSONA_PRESETS[4]`).

**Verdict:** one brand, two to three teachers in practice. The NEXT_PHASES_PLAN goal "one teacher, one surface" is
unmet.

### 3.3 Naming [V]

"AI Teacher" (87 strings), "AI Tutor" (13), "Teacher's Room" (12), "ZAI" (10), "Practice Room" (8), "Tinashe" (7),
plus "ZAI Tutor", "ZAI Teacher", "Practice Studio", "Teacher". Guest nav "AI Tutor" → `/ai-tutor`; signed-in nav
"Teacher" → `/practice`.

---

## 4. Learner memory and mastery

### 4.1 Stores [V]

| Store | Scope | Contents | Learner can view/correct/delete? |
|---|---|---|---|
| `learner_language_profiles.memory` | tenant × user × **language** | ≤10 recent mistakes; `notes` never written (only carried) | no |
| `learner_evidence` | user, company, course, scenario, session | objective key/text, result, detail | no |
| `learner_mastery` | **unique (user_id, objective_key)** — no tenant | level 0–3, count, last result | no |
| `learner_vocab` | user × company | SM-2 state | delete only |
| Dock chat | **browser localStorage** per lesson+section | messages | device only; survives logout on shared devices |
| Warm-up | derived | first recent mistake or note | — |

Non-language subjects fall into the persona's first language profile (usually `en`), so streaks and memory mix across
subjects (`progress.ts:57-59`). There is no learner profile (goals, background, preferences), no episodic summary of
past sessions, no retention policy, and mastery/evidence `user_id` has no FK, so they do not cascade on user deletion.

### 4.2 The mastery rule [V]

`evidence.ts:66-85`: correct +1, partial 0, misconception −1, clamp 0..3. Key = `course:<id>:` | `scenario:<id>:` |
`global:` + slug of the objective text (lowercased, `[^a-z0-9]` stripped, 96 chars).

Problems:
- **Keys from free AI text** → paraphrases fragment; non-Latin text → `general-objective`; dock checks use
  `"<lessonTitle>: <question>"` and never merge with flow objectives.
- **Authored objectives are not persisted** (`scenarioInputSchema` has no objectives field) — the creator's objectives
  and the analytics' objectives are disconnected.
- **"Unseen" and "failed" are both level 0.** Three correct answers in one session → level 3 forever (loaders filter
  `level ≤ 2`, so it is never resurfaced). No recency, decay, difficulty, transfer, or source weighting.
- **All evidence is self-reported** by the model (or by the client for the dock and Live). A learner could talk the
  model into `correct` [I] or call `recordDockKnowledgeCheck` three times [V].
- **Quiz attempts and lesson progress never feed mastery** [V].
- Non-transactional read-modify-write; concurrent writes lose updates.
- Stored report objectives carry wrong levels (`finalize.ts:137`); correct levels exist only in the first HTTP response.
- `global:`/`scenario:` keys are shared across tenants and each upsert overwrites `company_id`.

### 4.3 Derived features [V]

Daily plan, sprint, viva and insights all read `learner_mastery` but each scopes it differently. Viva ignores mastery
and decides on session-only objectives or `scores.task ≥ 65`. Sprint scenarios can drift if `sprint_context` is
missing (rebuilt every turn). SRS covers vocabulary only.

---

## 5. Authoring, QA and institution

### 5.1 Creator journey [V]

Lesson editor → `LessonAITeacherPanel` → objectives (`/api/ai/teacher/objectives`) → draft → storyboard with drag
reorder → one-line edit bar with diff and one-level undo → test as student (real prompt and pipeline, no learner
session) → "Add to lesson" (scenario + `tutor_session` block) → teacher moments. This is genuinely good and close to
the Phase 1 goal of "a working flow in under two minutes".

Gaps: objectives not saved; no draft/live split for published courses (saving overwrites the live row); preview and
stress-test live in different editors.

### 5.2 Five places to edit a flow [V]

(a) lesson panel (preview, no stress test) · (b) `ScenarioEditorModal` (templates, legacy generator, revise, stress
test, **no preview, defaults to published**) · (c) creator `tutor-session-block` · (d) Autopilot in the course tab ·
(e) Fix-It from insights. Two hub routes (`/creator/ai-teachers`, `/academy/[domain]/admin/ai-teachers`). Two placement
models (`tutor_session` blocks and `teacher_moments`). Five different publish semantics.

### 5.3 Autopilot [V]

Dry-run preview, batch of 6 (max 12), template by title regex. **On a live course it publishes regardless of
`publish=false`** (`route.ts:320-321`); `attachBlock` and the UI auto-publish default to true; no per-flow review gate;
no batch undo; "Publish all drafts" also republishes **archived** flows; no `maxDuration` for up to 12 sequential LLM
calls.

### 5.4 QA [V]

Three fixed single-turn probes (struggling, off-topic, confident), empty lesson text, heuristics (word count ≤85, a
football regex for drift, `listen` counts as a check so "confident" almost always passes), temperature 0.8, results not
persisted, no datasets, no regression. Not fit as a publish gate.

### 5.5 Versioning [V]

None. One-level client undo; hard delete with `ON DELETE SET NULL` on sessions and **cascade on assignments**.

### 5.6 Institution [V]

Insights: per-objective mastery and top misconceptions, sampled from 400 rows, company or course only — no cohort or
group filter, no per-learner drill-down. Review queue: last 40, no filters, notes stored inside
`tutor_reports.tone_stats.teacher_review`. Gradebook speaking metrics: tenant-wide, mean of all numeric scores. Usage
dashboard: sums the ledger, which most generation routes never write to. Intervention: only untargeted Fix-It.

---

## 6. Security and privacy findings

The model is "service role everywhere, authorise in app code" (`src/lib/supabase/server.ts:4-12`, documented in
`docs/SECURITY_RLS.md` §1). RLS protects only direct PostgREST callers. That makes every missing app-level check a real
hole. All items below are **[V]** by reading code; none were exploited.

| ID | Severity | Finding | Location |
|---|---|---|---|
| SEC-1 | **High** | `upsertScenario` authorises on `courseId` then writes with the client-supplied `companyId`; a course manager in tenant A can create or overwrite scenarios in tenant B. `personaId`, `lessonId` unchecked | `actions/tutor-authoring.ts:792-850` |
| SEC-2 | **High** | `recordDockKnowledgeCheck` takes `courseId`, `isCorrect`, question text from the client with no enrollment check or rate limit; writes evidence and mastery into that course's tenant (feeds staff insights) | `actions/tutor-learner.ts:268-314` |
| SEC-3 | **High** | `resolveLearnerCompanyId` trusts a supplied `companyId`; `addManualVocabCard` / `saveSessionWordsToDeck` insert into any tenant | `actions/tutor-learner.ts:24-36, 86, 169` |
| SEC-4 | Medium | Daily plan queries published scenarios across all tenants (no `companyId`, no visibility filter); dock with no course passes `null`, pulling other tenants' weak objectives into the prompt | `dashboard/page.tsx:546`, `mastery/server.ts:400-409`, `api/ai/tutor/route.ts:123` |
| SEC-5 | Medium | `preview/turn` loads any lesson's content and any persona by id after authorising on the flow's course | `api/ai/teacher/preview/turn/route.ts:208-215` |
| SEC-6 | Medium | Unchecked references: `createTutorAssignment` (scenario, group), `upsertTeacherMoment` (scenario), `updateCourseVivaConfig` (scenario), `createFixItFlowFromMisconception` (course); Autopilot/draft `personaId` | `tutor-authoring.ts` various |
| SEC-7 | Medium | `/api/ai/teacher/stress-test` requires only sign-in (learners get free unmetered LLM calls); `generate-course-blueprint`, `edit-block-content`, `branding-assistant`, `generate-image` have no role check; `generate-image` reads any `media_assets` row | `api/ai/**` |
| SEC-8 | Medium | Public `/try` `action=report` returns before the rate limiter; turn and time caps derive from client `history`/`elapsedMs`; any published `tenant_library` scenario is publicly reachable by UUID with no opt-in | `api/tutor/try/[scenarioId]/route.ts:96-129`, `public-try.ts:33` |
| SEC-9 | Medium | `/api/tutor/tts` lets any signed-in user synthesise arbitrary text into a public bucket and attributes cost to a body-supplied `companyId`/`sessionId` | `api/tutor/tts/route.ts:38-55` |
| SEC-10 | Medium | Metering and quotas are client-reported (speaking ms, Live audio seconds); Live transcripts and evidence posted by the client feed reports and mastery | `access.ts:166,353`, `finalize.ts:193-205`, `events/route.ts` |
| PRIV-1 | Medium | Staff insights read evidence from private practice and sprint sessions, bypassing the session privacy rule that limits staff to lesson/assignment/shared/flagged sessions | `20261123000000_learner_mastery.sql:44-52`, `insights/server.ts:38-41` |
| PRIV-2 | Medium | Dock history in `localStorage` persists after sign-out on shared devices (common in Zambian schools and cafés) | `ai-tutor.tsx:78-91` |
| PRIV-3 | Low | No learner view, correction or deletion of mastery/evidence/memory; no retention policy; mastery not deleted with the user | — |
| SEC-11 | Low | Prompt-injection surfaces: unfenced persona/scenario text, dock lesson content without a "treat as data" guard, persisted learner text re-entering prompts | `prompt.ts`, `api/ai/tutor/route.ts:143-188` |
| SEC-12 | Low | All limiters except session starts are in-process (per serverless instance); no per-turn rate limit (~1,800 turns/h possible); no global AI kill switch or spend cap | various |
| SEC-13 | Low | Uncommitted change sends quiz answer keys to guests on free published courses for client-side grading | `learn/page.tsx:225-233`, `quiz-player.tsx:112-134` |

---

## 7. Database and deployment

- **Every table the tutor code queries exists in a migration** (27 tables) [V].
- **Duplicate version `20261124000000`** (`teacher_phase3_scale` and `upgrade_tutor_demo_and_scenarios`), and an older
  `014_*` pair. The Supabase CLI keys `schema_migrations` by version; `db push` will fail or skip one [I]. Fix: rename to
  `20261124000001_…` *after* checking which (if either) is recorded in production.
- **The cited production baseline `20261120000000_classroom_phase1_security_hardening.sql` does not exist** in any
  branch (`git log --all` empty) [V]. The baseline is therefore unknown.
- **Self-declared unapplied:** `20261028000000_rls_hardening.sql` and `20261102000000_tutor_session_block.sql` headers
  say "NOT APPLIED" [V]. Whether that is still true is [U].
- **Unknown prod state** [U]: `20261121000001`, `20261122000000` (teacher moments), `20261123000000` (mastery), both
  `20261124000000` files. Code tolerates missing schema silently (`isSchemaUnavailableError`, `mastery/server.ts:56-75`).
  Partial application is dangerous: with `20261123` but not phase3, viva report inserts fail on `viva_passed` and the
  fallback also drops `objectives`/`next_step` (`report.ts:127-129`).
- **Irreversible data migration:** `upgrade_tutor_demo_and_scenarios` appends `'text'` to `allowed_modes` on every
  tenant's scenarios and overwrites customised preset personas via `ON CONFLICT DO UPDATE`.
- `src/types/database.ts` is not regenerated for the new tables; code uses `LooseSupabase` casts, so the type checker
  validates nothing there.
- `supabase/tests/tutor/rls_test.sql` covers none of `learner_mastery`, `learner_evidence`, `teacher_moments`.
- Production deploys on push to `main`. The working tree is currently dirty on `main` with 17 modified files.

---

## 8. Learner UX and performance

- **Practice Room header:** ~10 controls on desktop, ~8 on mobile, all 32px (below the 44px touch target). Composer has
  30 buttons and ~40 props.
- **Accessibility:** good captions (native, romanisation, translation, `aria-live`), slow replay, Space-to-talk. Gaps:
  transcript drawer and dock lack Escape and a focus trap; the dock has no `role="dialog"` and no `aria-live` on streamed
  replies; `SpeakingHistoryView` has no aria attributes; the dock avatar ignores reduced motion.
- **Low-end devices:** `@rive-app/canvas` is statically imported with every `Teacher` (~616 KB JS + 2.17 MB wasm + 391 KB
  `.riv` on first teacher view), including on the lesson page, deck and block card, which ignore lite mode. Three.js is
  lazy (good) but runs high-performance WebGL, antialiasing, DPR 2 and no FPS guard. `onLowPerformance` is not wired to
  lite mode. Lite auto-detect depends on `navigator.connection`.
- **Tenant context lost:** academy pages link to platform `/courses/[slug]/learn`; the lesson card derives tenant from the
  URL, so academy learners land in platform `/practice`. `ReportCard` hard-codes `/practice/deck`; the academy dashboard
  hard-codes a WhatsApp number.
- **Dead code:** `TutorSessionBlock.onComplete` is declared but never called, so four completion toasts never fire;
  `learner/content-blocks/index.tsx` is an unimported duplicate `BlockRenderer`.
- **Quiz player** never talks to the teacher: a failed quiz offers no "ask your teacher" and does not feed the plan.

---

## 9. Documentation discrepancies

| Doc | Says | Code |
|---|---|---|
| `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md` | Supabase Auth, Anthropic Claude (`claude-sonnet-4-6`), `middleware.ts`, AI tutor not persisted | Clerk, Gemini only, `src/proxy.ts`, Next 16.2 |
| `CLAUDE.md` | "All DB access goes through Supabase with RLS" | Service role everywhere; RLS only guards PostgREST |
| `docs/TUTOR_API.md:27,157` | Live client not built | Built and chosen by default |
| `docs/TUTOR_API.md:131` | 10 v1 events | 20 events |
| `docs/TUTOR_API.md:71,89` | webm/ogg/wav | + mp4, images |
| `docs/TUTOR_API.md:90` | TTS failure → 502 | TTS deferred to `/api/tutor/tts` (undocumented) |
| `docs/TUTOR_API.md:155` | `next_scenario_id` always null | Set by `resolveRecommendedNextScenario` |
| `docs/TUTOR_API.md` | — | Undocumented: `/try`, preview, stress-test, insights, TTS routes, caching |
| Commit `911a069` | "timezone streaks" | Hard-coded `Africa/Lusaka` (`report.ts:245`, `progress.ts:4`), learner timezone never passed |
| `NEXT_PHASES_PLAN.md` | Prod baseline `20261120000000_…` | File does not exist |
| `AGENT_B_STUDENT_MEMORY.md` | `lesson_id`, `said`, `correct` columns; key = objective+scenario; daily plan reads with learner's client | No such columns; course→scenario→global prefix; service role |
| `docs/ROADMAP.md` | Phase checklists unchecked | Most items shipped |

---

## 10. Keep, consolidate, improve, retire

| Keep (foundations) | Consolidate | Improve | Retire |
|---|---|---|---|
| `runTutorTurn(deps)` pipeline | Dock → session engine (`origin: "ask"`) | Mastery model (objective registry, weighted evidence, decay) | `/api/ai/tutor` inline prompt and `:::directive:::` markup (after migration) |
| Event contract + v1 replay | Three event-vocabulary copies → one generated source | Prompt caching (stable prefix) | `generate-tutor-scenario` (→ `teacher/draft`) |
| Idempotent finalize | Two dashboards' teacher entries → one Teacher card | History summarisation | Unimported `learner/content-blocks/index.tsx` |
| Pure, tested `lib/tutor` modules | Five flow editors → one Flow Editor with preview + QA | Stress test → Simulation Lab | Regex-inferred order/fill-blank (→ contract events) |
| Lesson-panel authoring flow | Four staff-check copies → one helper | Board → widget registry | Index-based persona lookup |
| Lite mode store, avatar fallback | Teacher moments vs `tutor_session` blocks → one placement model (moments) | Insights: cohorts, drill-down, exact counts | `PracticeStudio` name collision (rename) |
| Report card v2, daily plan, sprint, viva concepts | Voice stacks → one `TeacherVoice` | Autopilot/Fix-It → drafts with review | |
| Persona look/voice system, skill packs | Gemini helpers → `src/lib/ai` provider interface | Observability, metering, budgets | |
