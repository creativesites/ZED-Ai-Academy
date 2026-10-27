# Language Learning & AI Teacher Avatars — Plan

Date: 2026-10-27
Status: Draft for discussion (nothing here is built yet)

## 1. Why this exists

A Zimbabwean training company that runs **healthcare** and **language** courses may license or commission ZAI Academy. Language learning needs one thing the platform does not offer yet: **a lot of speaking practice with fast, kind feedback.** Live classes and course content already cover input. Practice is the gap.

This document covers:

1. The learner experience we want ("unforgettable", not "a chatbot with a face").
2. The AI stack (Gemini 3.8 family for now, behind a provider abstraction).
3. The avatar strategy (talking teacher with gestures and actions).
4. How it plugs into the existing tenant, course studio, lesson player, classroom and live session systems.
5. Course studio improvements we should make on the way.
6. A phased build plan, costs, risks, and open questions.

## 2. What we already have (and can reuse)

| Capability | Where | Reuse for languages |
|---|---|---|
| Multi-tenant academies (`companies`, `company_members`, tenant admin, branding) | `supabase/migrations/20260526000000_tenant_first_data_model.sql`, `src/lib/tenants/` | The Zimbabwean company becomes a tenant with its own branding, staff, learners and personas. No fork needed. |
| Block-based course studio (22 block types) | `src/components/creator/lesson-editor-client.tsx`, `src/components/creator/blocks/` | New language block types slot in the same way. |
| Course domain presets | `src/lib/course-domain-presets.ts` | Add `language` and `healthcare` presets that change AI generation and default blocks. |
| Lesson player + AI tutor (Gemini) | `src/components/learner/lesson-player-client.tsx`, `src/app/api/ai/tutor/route.ts` | Tutor gets a "speak" mode; player gets a Practice panel. |
| Practice exercises with AI scoring (no pass/fail) | `src/actions/practice-exercises.ts`, `practice_exercise` block | Same philosophy for speaking: score for guidance, not gating. |
| Classrooms, timetable, gradebook, attendance | `src/components/classroom/` | Teachers see speaking minutes and weak areas next to grades. |
| Live sessions (Zoom / Jitsi / Meet) | `src/components/live-sessions/`, `docs/LIVE_SESSIONS_AND_PRACTICE_STUDIO_PLAN.md` | Live classes stay human. AI does warm-up before class and homework after. |
| Gemini SDK already installed | `@google/genai`, `src/lib/ai/gemini.ts` | Same SDK covers Live, Transcribe and TTS. |

The foundation is good. Languages are mostly a **new practice engine plus new block types**, not a rewrite.

## 3. The experience: from abstract problem to unforgettable

### 3.1 The problem in one sentence

Learners don't become fluent because they rarely speak, they're scared of being wrong in front of people, and nobody gives them precise feedback at the moment they need it.

### 3.2 The design principles

1. **Speak in the first 60 seconds.** Every session opens with the learner talking, not reading.
2. **A teacher, not a tool.** Each academy has named teacher personas with a face, a voice, a personality and a memory of the learner ("Last time you struggled with the past tense. Let's warm up with that.").
3. **Safe to fail.** The AI never shames. Corrections are recasts ("Ah, you *went* to the clinic, nice!"), with detail saved for the end-of-session report.
4. **Real situations, not drills.** Practice is scenes: checking in at a hotel, a job interview, explaining symptoms to a nurse, a pharmacy counter.
5. **Visible progress.** Learners see CEFR "can-do" statements unlocking ("I can introduce myself and others"), speaking minutes, words mastered and a streak, not just "Lesson 4 complete".
6. **Short and daily.** 5–10 minute scenes fit Gemini Live session limits and mobile data budgets, and match how habits form.
7. **Works on a Zimbabwean phone connection.** Audio-first. Avatar rendering happens on the device, not as a video stream (see §5).

### 3.3 The core practice modes

| Mode | What happens | AI used |
|---|---|---|
| **Conversation Scene** (flagship) | Learner role-plays a scenario with the avatar teacher in real time. Teacher plays a character (receptionist, patient, interviewer), adapts difficulty, stays in the target language, gestures and reacts. Ends with a feedback report. | Gemini 3.8 Live (voice), 3.8 Flash (report) |
| **Pronunciation Gym** | Teacher models a word or phrase, learner repeats, gets per-word feedback with a slow replay and a mouth-shape hint. | 3.8 Flash TTS (model audio), audio analysis (see §4.4) |
| **Shadowing** | Learner speaks along with a native-speed audio clip, then compares. | TTS + Transcribe |
| **Listening Lab** | Short dialogues with comprehension questions; replay at 0.75x. | 3.8 Flash TTS multi-speaker, Flash for questions |
| **Vocabulary Deck** | Spaced repetition of words from the learner's lessons and from words they fumbled in conversations. | Flash (example sentences), TTS (audio) |
| **Ask the Teacher** | Free voice chat with the course tutor about lesson content (grammar questions in the learner's own language). | 3.8 Live |
| **Class Warm-up / Homework** | Instructor assigns a scene before or after a live class; results show in the classroom gradebook. | All of the above |

### 3.4 The "wow" moments we design for

- **First session:** a placement conversation. Five minutes of friendly chat, and the learner gets a CEFR estimate plus a personal plan. This is the demo that sells the platform to the Zimbabwean company.
- **Memory:** the teacher remembers names, goals and past mistakes across sessions.
- **The report card after each scene:** "You spoke for 4m 12s. 3 things you did well. 2 phrases to fix" (with tap-to-hear corrections). New words go into the deck automatically.
- **The teacher reacts physically:** nods while listening, leans in when the learner hesitates, waves at the start, thumbs-up on a good answer, points to a vocabulary card that appears on screen.
- **Code-switching help:** learner can say "how do I say…" in English (or Shona) and the teacher helps, then switches back.
- **Healthcare crossover:** the same engine runs a **simulated patient** for the healthcare courses (see §8). One build, two product lines.

### 3.5 A learner's day (target)

1. Push notification / WhatsApp: "Tariro is waiting: 6 minutes at the pharmacy today."
2. Opens the app, the avatar greets them by name, 30-second vocab warm-up by voice.
3. 5-minute Conversation Scene tied to this week's lesson.
4. Report card, 3 new words added to the deck, streak +1.
5. Thursday: live class with the human teacher, who already knows the class struggled with past tense from the gradebook.

## 4. AI stack (Gemini now, swappable later)

### 4.1 Model map

Verified against the Gemini API models page on 2026-10-27.

| Job | Model | Notes |
|---|---|---|
| Real-time spoken conversation | `gemini-3.8-live` | GA. Default low-latency voice model. Native audio in/out, input and output transcription, non-blocking tool calls, affective dialogue on by default. |
| Harder conversations (placement test, exam prep) | `gemini-3.8-live-extended-thinking` | More reasoning, more latency. Use selectively. |
| Post-session transcript with word timestamps | `gemini-3.5-transcribe` | Diarization and word-level timestamps power the report card and mistake highlighting. `gemini-3.5-transcribe-live` exists for live captions. |
| Feedback reports, scoring, content generation, lesson/quiz/scenario authoring | `gemini-3.8-flash` | Structured JSON output. Replaces today's `gemini-3.1-flash-lite` for quality-sensitive jobs. |
| Cheap high-volume jobs (example sentences, tagging) | `gemini-3.5-flash-lite` | |
| Model pronunciation audio, dialogues, vocabulary audio | `gemini-3.8-flash-tts` (studio quality, pre-generated and cached) / `gemini-3.8-flash-lite-tts` (on the fly) | Generate once, store in Supabase Storage, serve forever. Don't pay per play. |
| Live class captions / interpretation (later) | `gemini-3.5-live-translate-preview` | Preview. Speech-to-speech translation for live classes. Nice-to-have. |
| Photoreal avatar (optional premium tier) | Gemini 3.8 Live with `response_modalities=["VIDEO"]` (Live Avatar) | See §5. |

### 4.2 How a live conversation connects

```
Browser                         Next.js (our server)                  Gemini Live
  │ 1. POST /api/practice/sessions  │                                      │
  │ ───────────────────────────────▶│ auth (Clerk), check enrollment,      │
  │                                 │ quota, build system prompt from      │
  │                                 │ scenario + learner profile + memory  │
  │                                 │ 2. mint ephemeral token (1 use,      │
  │                                 │    locked to model + config) ───────▶│
  │ ◀─────────── token + session id │                                      │
  │ 3. WebSocket direct to Gemini with token (mic audio 16kHz PCM) ───────▶│
  │ ◀──────── audio out + transcripts + tool calls (gesture, show_card…) ──│
  │ 4. Avatar engine plays audio, lip-syncs, runs gestures                 │
  │ 5. POST /api/practice/sessions/:id/complete (transcripts, audio ref)   │
  │ ───────────────────────────────▶│ 6. background: Transcribe + Flash    │
  │                                 │    → report, scores, new vocab, SRS  │
```

Why this shape:

- **The API key never reaches the browser.** Ephemeral tokens are minted server-side per session, single-use, and constrained to the model and config we choose.
- **Audio goes browser ↔ Google directly**, so our Vercel functions don't proxy long-lived WebSockets (they're not built for it) and latency stays low.
- **Quota and billing checks happen before the token is minted**, so the tenant's plan limits apply (e.g. 60 speaking minutes per learner per month on the base plan).
- **Session limits:** Live API audio sessions cap around 15 minutes and connections reset around 10 minutes. We design scenes for 5–10 minutes and use session resumption + context window compression for longer free-talk.

### 4.3 Tool calls make the teacher feel alive

The Live model gets a small toolset. Calls are **non-blocking**, so the teacher keeps talking while the UI reacts:

| Tool | Effect |
|---|---|
| `gesture({ name })` | wave, nod, thumbs_up, point_left, think, shrug, clap, lean_in |
| `set_expression({ mood, intensity })` | happy, encouraging, curious, surprised, concerned |
| `show_card({ word, translation, image?, audio? })` | Flashcard appears next to the avatar |
| `show_text({ text, highlight? })` | Writes a phrase on the virtual whiteboard |
| `note_mistake({ said, correct, category })` | Silently logs a correction for the report (no interruption) |
| `adjust_difficulty({ direction })` | Slow down / simplify vocabulary |
| `advance_scene({ step })` | Moves through the scenario's beats (arrive → ask → resolve) |
| `end_session({ summary })` | Graceful wrap-up |

On top of tool calls, the client adds **ambient behaviour** that needs no AI: idle breathing, blinking, eye contact, listening nods triggered by the learner's voice activity, and talking gestures driven by speech rhythm. This is what makes a 3D teacher feel alive between explicit actions.

### 4.4 Pronunciation feedback (honest assessment)

Gemini is a strong listener but is **not a dedicated phoneme scoring engine**. Plan:

- **MVP:** send the learner's clip + target phrase to `gemini-3.8-flash` (audio input) and ask for structured, word-level qualitative feedback ("the 'th' in 'three' sounded like 't'"). Good enough for coaching, not for a numeric exam score.
- **Later, if tenants need numeric scores:** add a pronunciation provider behind `src/lib/speech/` (candidates: Azure Pronunciation Assessment, SpeechSuper, SpeechAce). Benchmark first: there are public reports of phoneme-level inaccuracies, so we test on real Zimbabwean learner audio before trusting any number.

### 4.5 Provider abstraction

Today there is one exported constant (`GEMINI_MODEL`) used in 12 files. Replace with:

```
src/lib/ai/
  models.ts            // task → model registry: "conversation", "report", "tts.studio", "transcribe", ...
  providers/
    gemini.ts          // GoogleGenAI client, ephemeral tokens, TTS, transcribe
  live/
    session-config.ts  // system prompt + tools for a scenario
    tools.ts           // gesture/show_card/... schemas, shared by server + client
src/lib/speech/        // pronunciation scoring provider (later)
src/lib/avatar/        // avatar provider interface (see §5)
```

Swapping to another model vendor later then means a new file in `providers/` plus registry changes, the same idea as `src/lib/payments/`.

## 5. Avatar strategy

### 5.1 The requirement

"Top-notch animated, with actions, talking head, gestures." There are three ways to get there. They differ a lot in realism, control, cost and **bandwidth**, and bandwidth matters most in Zimbabwe.

| Approach | Examples | Gestures & actions | Realism | Our cost per speaking minute | Learner data use |
|---|---|---|---|---|---|
| **A. 3D rigged avatar rendered in the browser**, driven by Gemini Live audio | Three.js + a TalkingHead-style engine; VRM / GLB characters; custom characters commissioned in Blender / Character Creator; Mixamo-style animation clips | **Full control**: hands, body, pointing, props, scene background, all triggered by tool calls | Stylised (Pixar-ish), can be very polished | ~0 extra (only Gemini audio) | Low: audio only |
| **B1. Gemini 3.8 Live Avatar** (native video output) | `response_modalities=["VIDEO"]`, stock avatars or custom reference image | Facial expressions + lip-sync. No documented hand/body gesture control. | Photoreal | ~$0.37/min avatar video on top of audio (third-party figures, introductory pricing until 31 Dec 2026, verify) | High: 24 FPS video stream |
| **B2. Streaming avatar vendors** | HeyGen LiveAvatar, Anam, Tavus, Simli, D-ID | Mostly face/upper body; limited scripted gestures | Photoreal | Roughly $0.05–$0.35/min depending on vendor (vendor-reported, verify) | High: video stream |
| **C. Pre-rendered avatar video** | HeyGen, Synthesia, Akool | Scripted | Photoreal | Per-video, one-off | Medium (cacheable) |

Notes:

- **Gemini Live Avatar** is GA as of September 2026 but is documented under Google Cloud / Gemini Enterprise. Custom faces need enterprise allowlisting. It is **face-only** as documented, so it does not meet the "gestures and actions" requirement by itself.
- I could not find a platform called "Thrive" in avatar search results. **Did you mean Tavus?** (It's a common premium choice.) If it's a different product, send me the link and I'll evaluate it against this table.

### 5.2 Recommendation

**Build Approach A as the default teacher, keep B as a premium "face-to-face" mode behind the same interface, and use C only for lecture-style course videos.**

Why A is the right default for this product:

1. **It's the only option that truly delivers gestures and actions.** We own the skeleton, so the teacher can wave, point at a card, hold a stethoscope, pick up a menu.
2. **Bandwidth.** Learners on Econet/NetOne mobile data can't afford a 24 FPS video stream for 10 minutes a day. Audio-only is roughly 10–20x lighter.
3. **Cost.** No per-minute avatar fee. At scale, photoreal streaming can cost more than the course price.
4. **Brand and culture.** We can commission characters that look and dress like Zimbabwean teachers and nurses, with tenant-specific uniforms and logos. Stock photoreal avatars rarely fit.
5. **No uncanny valley.** A polished stylised character is warmer for a language learner than an almost-real face, and safer with minors.
6. **Works offline-ish.** Character assets are cached once (target < 5 MB per character, compressed GLB + KTX2 textures).

Where B wins: a premium tier for corporate clients who want a photoreal "digital human", or marketing demos. Because the avatar sits behind an interface, adding it later is a contained job.

### 5.3 Avatar engine design

```ts
// src/lib/avatar/types.ts
interface AvatarDriver {
  mount(el: HTMLElement, persona: Persona): Promise<void>;
  speak(audio: AudioChunkStream, visemes?: VisemeStream): void; // lip-sync
  gesture(name: GestureName): void;
  setExpression(mood: Mood, intensity?: number): void;
  setListening(active: boolean): void;  // ambient nods / eye contact
  dispose(): void;
}
// Implementations: ThreeDAvatarDriver (default), GeminiVideoAvatarDriver, VendorStreamAvatarDriver
```

- **Lip-sync:** derive visemes from the audio amplitude/spectrum in real time on the client (works for any language, including Shona). Output transcription with timestamps can refine it.
- **Gestures:** a library of ~20 animation clips (greeting, nod, point, count-on-fingers, think, celebrate, concerned, explain-with-hands), blended over an idle loop.
- **Low-end fallback:** a 2D illustrated/Lottie or Rive version of the same character for older phones, and an "audio only" toggle. Detect device capability on first load.
- **Personas** (DB, per tenant): name, character model, voice (Gemini voice name), personality prompt, languages taught, default gestures, backdrop (classroom, clinic, market).

### 5.4 Character production

Options, cheapest first:
1. Start with open VRM/GLB characters to build and test the engine (weeks 1–3).
2. Commission 2–4 original characters (e.g. a language teacher, a nurse/doctor, a patient set) from a 3D artist: rigged, with ARKit blendshapes for facial animation. Budget roughly a few hundred to a couple of thousand USD per character, depending on quality. This is the single biggest lever on "feels top-notch".
3. Tenant custom characters as a paid add-on.

## 6. Language-specific risks to resolve first

1. **Shona and Ndebele are not on the Gemini Live API language list** (99 languages; nearby supported ones include Zulu, Swahili, Southern Sotho, Tswana, Afrikaans). Ndebele is close to Zulu, which helps with comprehension but is not the same.
   - If the company teaches **English, French, Portuguese, Chinese, Swahili** etc. to Zimbabweans → fully supported.
   - If the company teaches **Shona/Ndebele** (e.g. to expats, NGO staff, diaspora kids) → we need a spike: test Gemini Live + Transcribe on Shona anyway (unsupported ≠ unusable), and plan a fallback of human-recorded audio, scripted dialogues and teacher-reviewed speaking submissions.
   - The learner's **native** language being Shona/Ndebele matters less: explanations can be in English, and code-switching in input often still works. Test it.
2. **Accent fairness:** test recognition on Zimbabwean-accented English and French early. Use `custom_vocabulary` for names, places and medical terms.
3. **Hallucinated grammar rules:** the teacher's explanations must be grounded in the course content and a per-language reference (grammar notes per CEFR level injected into the system prompt). Keep the human teacher in the loop through flagged sessions.

## 7. How it integrates into the platform

### 7.1 Data model (new tables, all with `company_id` + RLS, Clerk user IDs as `text`)

| Table | Purpose |
|---|---|
| `ai_personas` | Per-tenant teacher/patient characters: name, avatar asset, voice, personality prompt, languages, gesture set. |
| `language_courses` (or columns on `courses`) | `target_language`, `support_language`, `cefr_from`, `cefr_to`, `default_persona_id`. |
| `practice_scenarios` | Reusable scenes: goal, setting, persona role, beats/steps, target vocab & grammar, CEFR level, max minutes. Authored in the studio or AI-generated. |
| `practice_conversations` | One row per session: learner, scenario, lesson, model used, started/ended, speaking seconds, transcript JSON, audio storage path (opt-in), status. |
| `practice_feedback` | Report per conversation: scores (fluency, accuracy, vocabulary, pronunciation, task completion, 0–100, guidance only), mistakes list, strengths, suggested next scene. |
| `learner_language_profiles` | Per learner per language: estimated CEFR, can-do statements achieved, streak, total speaking minutes, memory notes for the persona ("works as a nurse in Bulawayo"). |
| `vocab_items` / `learner_vocab` | Words with audio, examples, and SRS state (due date, ease, interval). |
| `pronunciation_attempts` | Clip path, target text, per-word feedback. |
| `ai_usage_ledger` | Minutes/tokens per learner per tenant per day → quotas, billing, cost dashboards. |

Also fix the old `practice_sessions` table (it still references `auth.users(id)` as `uuid` while the app uses Clerk `text` IDs), or replace it with `practice_conversations`.

### 7.2 New course studio blocks

Add to `content_blocks_type_check`, the editor's `BLOCK_META`, the shared renderer and the tutor's context extraction:

| Block | Creator fills in | Learner sees |
|---|---|---|
| `vocab_set` | Words + translations + images (AI can fill all of it; audio auto-generated) | Flip cards with audio, "add to my deck" |
| `dialogue` | Script with speakers (AI-assisted), optional translation toggle | Multi-voice audio player with karaoke-style highlighting, "play role A" mode |
| `pronunciation_drill` | List of phrases, focus sounds | Pronunciation Gym inside the lesson |
| `speaking_scenario` | Pick or create a `practice_scenario` + persona | "Start conversation" → avatar scene in the lesson |
| `listening_check` | Audio (generated or uploaded) + questions | Listen, answer, replay slower |
| `grammar_note` | Rule, examples, common mistakes | Card with audio examples; grounding source for the AI teacher |
| `shadowing` | Clip + transcript | Speak-along with comparison |

The existing AI generators (`generate-lesson-content`, `generate-curriculum`, `generate-course-blueprint`) get a **language preset**: "Create a 10-lesson A1 English course for Zimbabwean healthcare workers" produces lessons with vocab sets, dialogues, scenarios and grammar notes, not just text blocks.

### 7.3 Learner surfaces

- **Lesson player:** language blocks render inline; a floating "Practise speaking" button opens the scene for the current lesson.
- **Speaking Room** (`/practice` under the tenant): the daily home for practice. Persona greeting, today's scene, deck review count, streak, CEFR progress.
- **Dashboard:** speaking minutes, can-do statements, words mastered, next live class.
- **Report history:** every conversation with transcript, corrections and replay.

### 7.4 Teacher / admin surfaces

- **Classroom gradebook:** new columns for speaking minutes, scene completion and weakest skill per learner; class heatmap of common mistakes ("14 of 20 learners confuse he/she" — very common for Shona speakers, since Shona pronouns don't mark gender).
- **Review queue:** conversations the AI flagged (low confidence, learner distress, inappropriate content) or that learners asked a human to look at. Teacher can add a voice note.
- **Assignments:** assign a scenario as warm-up before a live class or homework after; ties into the existing timetable.
- **Tenant admin:** manage personas, set quotas per plan, see AI cost per learner.

### 7.5 Live classes

Live classes stay human-led (existing Zoom/Jitsi). AI adds:
- pre-class warm-up scene assigned automatically from the class topic;
- post-class homework scene and vocab generated from the session's topic;
- later: live captions/translation with `gemini-3.5-transcribe-live` / `gemini-3.5-live-translate-preview`.

## 8. Healthcare courses get the same engine

The Conversation Scene engine is a general **role-play simulator**. For healthcare:

- **Simulated patient:** the persona plays a patient with a hidden case card (symptoms, history, emotions). The learner takes a history, explains a diagnosis, obtains consent, delivers bad news.
- **Rubric-based feedback** (e.g. Calgary-Cambridge communication skills) from `gemini-3.8-flash` on the transcript.
- **Medical language courses** (English or French for nurses working abroad) combine both product lines, which is likely the strongest offer for a Zimbabwean healthcare-training company given nurse migration demand.
- **Guardrails:** clear "training simulation, not medical advice" framing; clinical content grounded only in course material; instructor review of scenario case cards before publishing.

## 9. Course studio improvements (general, from reviewing the code)

Ordered by value:

1. **AI model registry** (§4.5): today every route uses one `gemini-3.1-flash-lite` constant. Quality-sensitive generation should use `gemini-3.8-flash`.
2. **One block→text function** shared by the AI tutor, quiz generator and Live system prompts. The tutor currently has its own `switch` that handles 8 of the 22 block types; glossary, learning objectives, callouts, comparison tables, quizzes and practice exercises never reach the AI.
3. **No full page reloads after AI generation:** `src/components/creator/ai-lesson-generator.tsx:80` calls `window.location.reload()`; insert the returned blocks into editor state instead.
4. **Finish the single-builder migration** from `plan.md`: retire `src/components/drag-and-drop/*` (legacy, mining-specific) once its mobile preview is ported.
5. **Draft vs published content:** editing a live course currently edits what learners see. Add lesson versions or a publish step per lesson.
6. **Practice Studio history in the database** instead of `localStorage` (`src/components/learner/practice-studio.tsx:207`).
7. **Audio as a first-class media type:** upload, record-in-browser, and AI-generate (TTS) audio in the media manager. Needed by every language block.
8. **Domain presets that actually change the studio:** presets for `language` and `healthcare` should change default blocks, AI prompts and the block picker order.
9. **Block templates / lesson templates** (e.g. "Language lesson: warm-up → vocab → dialogue → grammar → scene → review").
10. **Platform UI localisation** (next-intl or similar) so tenant UIs can run in French/Portuguese, and so the learner's support language can differ from the course language.
11. **Docs drift:** `CLAUDE.md` says the AI is Claude `claude-sonnet-4-6`, `docs/ROADMAP.md` says `gemini-2.5-flash`, the code uses `gemini-3.1-flash-lite`. Update docs once the registry lands.
12. **Rate limiting and usage metering** on all AI routes (needed anyway for per-tenant billing).

## 10. Cost sketch (verify before quoting to the client)

Rough, using third-party summaries of Gemini pricing (audio in ≈ $3 / 1M tokens, audio out ≈ $12 / 1M, ~25 audio tokens per second):

- **10-minute Conversation Scene, 3D avatar (Approach A):** on the order of **$0.10–$0.30** including the report, depending on how much history is re-billed per turn.
- **Same scene with Gemini Live Avatar (B1):** add roughly $0.37 per minute the avatar speaks → about **$2+**.
- **Per learner per month** at 20 scenes: roughly **$2–6 with A** vs **$40+ with B1**.

This is the main commercial reason to make A the default: it keeps a monthly subscription viable in the Zimbabwean market. Real numbers come from the Phase 0 spike with `ai_usage_ledger` turned on.

## 11. Privacy, safety, compliance

- **Consent:** voice is personal data. Explicit opt-in to store recordings; transcripts kept by default, audio kept 30 days unless the learner saves it.
- **Zimbabwe Cyber and Data Protection Act (2021)** and Zambia's Data Protection Act: data processing agreement with the tenant; document that audio is processed by Google.
- **Minors:** if the tenant serves children, stricter defaults (no audio retention, stylised avatars only, teacher review on).
- **AI disclosure:** learners always know the teacher is AI. Gemini output carries SynthID watermarking.
- **Content safety:** system-prompt guardrails, flagging to the teacher review queue, per-tenant blocked topics.

## 12. Phased plan

### Phase 0 — Spikes (1–2 weeks). Answers the risky questions.
- Gemini Live voice loop in the browser with ephemeral tokens, from Harare/Lusaka network conditions: measure latency and data use.
- Prototype 3D avatar driven by Live audio, with 5 gestures triggered by tool calls.
- Test Shona/Ndebele and Zimbabwean-accented English/French with Live + Transcribe.
- Try Gemini Live Avatar (if we can get Enterprise access) and one vendor (Tavus or HeyGen LiveAvatar) side by side for the premium tier decision.
- Turn on usage logging to get real per-session cost.
- **Output:** go/no-go on languages offered, final avatar choice, real cost per scene.

### Phase 1 — Speaking MVP (3–4 weeks). The demo that wins the client.
- `src/lib/ai` registry + Live session API (token minting, quota, completion).
- Tables: `ai_personas`, `practice_scenarios`, `practice_conversations`, `practice_feedback`, `learner_language_profiles`, `ai_usage_ledger`.
- Avatar engine v1 (one commissioned or placeholder character, ~10 gestures, 2D/audio fallback).
- `speaking_scenario` block + Speaking Room page + post-session report card.
- Placement conversation.

### Phase 2 — Full language course toolkit (4–5 weeks).
- Blocks: `vocab_set`, `dialogue`, `pronunciation_drill`, `listening_check`, `grammar_note`, `shadowing`.
- TTS pipeline with caching; audio in the media manager.
- Vocabulary SRS deck; mistakes feed the deck automatically.
- Language preset for AI course generation.
- Classroom gradebook columns + teacher review queue + scenario assignments.

### Phase 3 — Healthcare simulation + polish (3–4 weeks).
- Simulated patient personas and rubric feedback.
- Commissioned character set (teacher, nurse, doctor, patients) with tenant branding.
- Persona memory across sessions, streaks, CEFR can-do progress, WhatsApp reminders.

### Phase 4 — Premium and scale.
- Photoreal avatar tier (Gemini Live Avatar or vendor) behind `AvatarDriver`.
- Numeric pronunciation scoring provider (after benchmarking).
- Live class captions/translation.
- Second AI provider behind the registry.

Course studio improvements from §9 are spread across phases: 1–3 in Phase 1, 6–8 in Phase 2, the rest in Phase 3.

## 13. Open questions for you (and the Zimbabwean client)

1. **Which languages** does the company teach, and to whom? (English/French/Portuguese/Chinese to Zimbabweans vs Shona/Ndebele to others changes Phase 0 a lot.)
2. **"Thrive"**: did you mean Tavus, or another platform? A link helps.
3. **Sell vs build-for-them:** do they become a tenant on ZAI Academy (recommended, it's what the tenant architecture is for), or do they need a separate white-label deployment?
4. **Audience:** adults, healthcare professionals, school children? This affects avatar style, safety defaults and pricing.
5. **Devices and data:** mostly Android phones on mobile data? This confirms the audio-first/3D decision.
6. **Pricing model:** does AI speaking practice come bundled in course fees, or as a monthly add-on with a minutes quota?
7. **Gemini Enterprise access:** do we have, or want, a Google Cloud / Gemini Enterprise account (needed for Live Avatar and some quotas)?
8. **Character budget** for commissioned 3D teachers.

## Sources

- Gemini API models list: https://ai.google.dev/gemini-api/docs/models
- Live API capabilities, languages and session limits: https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Live API ephemeral tokens: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- Gemini 3.8 Live developer guide (Live Avatar, tool calling, transcription): https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-live
- Configure live avatars: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-live-avatars
- Gemini 3.5 Transcribe: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe
- Live Avatar pricing/limits (third party): https://www.eesel.ai/blog/gemini-3-8-live-avatar-review
- Firebase Live API limits: https://firebase.google.com/docs/ai-logic/live-api/limits-and-specs
- Real-time avatar platform comparisons (vendor-authored, directional): https://www.heygen.com/blog/best-real-time-ai-avatar-platforms, https://anam.ai/blog/best-ai-avatar-platforms-refresh-draft, https://www.toughtongueai.com/blog/best-virtual-avatar-solutions-2026
- Gemini Live + avatar open-source examples: https://github.com/haruiz/gemini-live-avatar, https://github.com/mascotbot-templates/gemini-live-api-avatar
- Pronunciation assessment accuracy discussion: https://learn.microsoft.com/en-in/answers/questions/5707709/azure-speech-pronunciation-assessment-word-and-pho
