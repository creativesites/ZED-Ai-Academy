# Language Learning & AI Teacher Avatars — Plan

Date: 2026-10-27
Status: Draft for discussion (nothing here is built yet). Updated 2026-10-27: target languages confirmed, avatar section rewritten around Rive, prototype added.

> **Next docs:** the build plan is in `docs/LANGUAGE_IMPLEMENTATION_PLAN.md`. The character brief for the Rive agent is in `docs/rive/TEACHER_RIVE_BRIEF.md`, and the contract it builds to is `docs/rive/teacher.contract.json`.
> **Decisions (2026-10-27):** Duolingo-like warm style with original characters; no paid tiers yet (Text/Voice/Live ship as modes and automatic fallbacks); align to HSK/HSKK, DELE and DELF; mobile app planned; the engine is subject-agnostic, so other programs can reuse it.

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
- **Code-switching help:** learner can say "how do I say…" in English and the teacher helps, then switches back.
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

### 4.6 Three practice modes, one teacher (tiers later)

Learners on different plans get different "brains" behind the **same** avatar. Moving up a tier never changes the character, the scene or the gestures, only how fast and natural the conversation is.

| Tier | How a turn works | Models | Feels like | Rough cost per 10-min scene |
|---|---|---|---|---|
| **Text** (cheapest) | Learner types. LLM replies with text + action tags. TTS voices the reply (optional; scripted lines come from cache). | `gemini-3.8-flash` (or `3.5-flash-lite`), `3.8-flash-lite-tts` | Chatting with a teacher who speaks back | ~$0.01–0.03 |
| **Voice** (default) | Learner holds to talk. `gemini-3.5-transcribe` turns it into text (with word timings for feedback). LLM replies with JSON `{ say, gesture, mood, card }`. TTS speaks it; the avatar lip-syncs to that audio. | Transcribe → `3.8-flash` → `3.8-flash-lite-tts` | Walkie-talkie: natural, but turn-based (1–3 s gap) | ~$0.05–0.15 |
| **Live** (premium) | Full-duplex audio straight to `gemini-3.8-live`. Learner can interrupt. Gestures arrive as non-blocking tool calls. | `gemini-3.8-live` (+ `3.8-flash` for the report) | A real video call | ~$0.10–0.30 |

Notes:
- The Voice tier's LLM output contract is the same shape as the Live tier's tool calls (`gesture`, `set_expression`, `show_card`, `trace_tone`, `note_mistake`), so the avatar code doesn't care which tier is running.
- Scripted lines (lesson dialogues, greetings, vocab audio) are generated once with `gemini-3.8-flash-tts` and cached in Supabase Storage. A large share of teacher speech in a structured course costs nothing per play.
- Live costs more and must sit behind quotas per plan (`ai_usage_ledger`).
- Cost ranges are estimates from third-party pricing summaries (TTS ≈ $9 per 1M audio tokens at 25 tokens/s, about $0.81 per hour of generated speech). The Phase 0 spike replaces them with measured numbers.

## 5. Avatar strategy

Prototype of the target experience (motion, gestures, scene, tiers): **[ZAI Practice Room prototype](https://claude.ai/artifact/3Aedw8JvF77KP3Qdi6vL8m)**. A copy of the page lives in `docs/prototypes/speaking-room.html`. Its character is drawn in code as a stand-in for real Rive art; the motion system, gesture vocabulary and event stream are what we'd build.

### 5.1 What "feels really good" means here

Talking heads have been around for years. The bar for 2026 is a **half-body character who acts**:
- **Half-body framing** (waist up) so hands and arms can talk: wave, count on fingers, point at a card, cup an ear, trace a tone in the air.
- **Listening is as important as speaking.** Nods, eye contact, leaning in when the learner hesitates, a curious brow. This runs on the device and costs nothing.
- **Fourth-wall moments.** Vocabulary cards fly out of her hand into the UI. Her finger draws the Mandarin tone contour as a glowing trail.
- **A place, not a background.** Each scenario has a scene with depth and light: a tea house moon-gate at dusk, a Seville café at golden hour, a Paris rooftop at blue hour. Floating script characters (汉字, ñ, é) drift in the air.
- **One character everywhere.** The same teacher in the lesson player, the Practice Room, notifications and the mobile app.

### 5.2 Options compared

| Option | What it is | Gestures / body | Look | Runtime cost | Data use | Web + mobile | Authoring effort |
|---|---|---|---|---|---|---|---|
| **Rive** (2D vector, state machines) | Rigged 2D character; state machine + data binding driven by our code | **Full** (bones, meshes, any gesture an animator builds) | Premium illustrated, "animated film" | None (runs on device, ~78 KB WASM runtime + small .riv) | Very low | Web, React Native, Flutter, iOS, Android from **one file** | Medium: needs a good Rive animator; you already have a Rive + agent pipeline from Meeting Mind |
| **3D real-time** (Three.js + VRM/GLB) | Rigged 3D character rendered in WebGL | Full (body rig + blendshapes) | Stylised 3D, camera moves, real lighting | None per minute; GPU-heavy on low-end phones | Low after a 3–10 MB first load | Web strong; native needs a separate engine | High: modelling, rigging, blendshapes, animation clips. Ready Player Me shut down in January 2026, so no free avatar pipeline |
| **Photoreal streaming** (Gemini 3.8 Live Avatar, Tavus, HeyGen LiveAvatar, Anam, Simli) | Server renders a realistic face, streams video | Face/upper body; little or no gesture control | Photoreal | ~$0.05–0.37+/min on top of AI audio | High (live video) | Web via WebRTC/SDK | Low (vendor does it), but little control |
| **Pre-rendered video** (HeyGen, Synthesia) | Generated MP4 lectures | Scripted | Photoreal | Per video | Medium | Any | Low; not interactive |
| **Game engine** (Unity WebGL, Unreal MetaHuman + pixel streaming) | Full 3D engine | Full | Highest-end 3D | High (cloud GPUs for streaming) | High | Heavy | Very high; not justified here |

Proof point for Rive: Duolingo's AI "Video Call with Lily" runs on Rive's state machine for real-time character animation and lip-sync.

### 5.3 Recommendation: Rive for the teacher, photoreal as an optional premium later

**Use Rive for every tier.** Reasons:
1. **It's the only option that gives a polished, acting, half-body character at zero per-minute cost** and works on cheap Android phones on mobile data.
2. **One `.riv` file runs in the Next.js web app and in a future React Native/Flutter app**, so the teacher is identical everywhere.
3. **State machines + data binding map 1:1 to our AI events.** The model says `gesture("point")`; we set one view-model property; the animator's state machine handles blending.
4. **Tenant personas without new art.** Colours (skin, hair, outfit, accent), name badge and props can be data-bound, so one rig produces many teachers. A Zimbabwean healthcare tenant can have nurses in their own uniform colours.
5. **You already know it.** The Meeting Mind workflow (an agent plans the character, another drives the Rive tooling) can be reused, with a human animator doing the final polish pass on hero characters.

**Keep 3D as a later option** if a tenant specifically wants depth and camera moves. **Keep photoreal as an optional premium** ("Face-to-face" mode) for corporate buyers, behind the same `AvatarDriver` interface. Gemini Live Avatar is documented as face-only, enterprise-gated for custom faces, and about $0.37 per speaking minute on introductory pricing, so it shouldn't be the default.

### 5.4 Rive character spec (hand this to the animator)

One artboard per character, `Teacher_HalfBody`, framed waist-up, designed for portrait (phone) and landscape (desktop) crops.

**View model properties (data binding)** the app writes to:

| Property | Type | Values / notes |
|---|---|---|
| `gesture` | enum + trigger | `idle, wave, nod, explain, point_left, point_right, thumbs_up, think, listen, celebrate, count_1_2_3, shrug, trace_tone` |
| `toneShape` | enum | `t1, t2, t3, t4, rise, fall` (drives the hand path for `trace_tone`) |
| `mood` | enum | `neutral, happy, curious, surprised, concerned, proud` (face blend, brows, cheeks) |
| `viseme` | number 0–8 | `rest, A, E, I, O, U, M/B/P, F/V, generic consonant`. Instant or very short transitions |
| `speaking` | bool | Adds talking gestures (small hand beats) on the body layer |
| `listening` | bool | Lean-in, nods on learner voice activity, attentive eyes |
| `lookX`, `lookY` | number −1…1 | Eye/head target (look at card, at learner, up when thinking) |
| `voiceLevel` | number 0–1 | Learner mic level, drives nod intensity |
| `skin`, `hair`, `outfit`, `accent` | colour | Tenant/persona customisation |

**State machine layers:** Body (gestures over an idle loop with breathing and weight shifts), Face (mood blend), Mouth (viseme), Eyes (auto-blink + saccades + look target), Props (optional: tea cup, stethoscope, menu, clipboard).

**Rules:** every gesture returns to idle on its own; gestures blend over each other (a nod while pointing); file size target under 500 KB per character.

**Lip-sync:** viseme values come from our code, not Rive. In Voice/Text tiers we analyse the TTS audio as it plays (energy + spectral bands, which works for any language, including tonal Mandarin). In Live we do the same on the streamed audio. Output-transcription timestamps can refine it later.

### 5.5 The scene ("the whole page must be magical")

- **Layered parallax backdrop** per scenario (Rive or layered SVG/WebGL): far sky, mid silhouettes, near frame (moon gate, arch, window), lights (lanterns, sun, stars) with a slow day-cycle.
- **Ambient particles**: drifting glyphs from the target language and soft fireflies; reduced on low-end devices and for `prefers-reduced-motion`.
- **Glass UI** floating over the scene: captions (hanzi + tone-coloured pinyin + translation), flashcards, mic/waveform, report card.
- **Celebration moments**: confetti, sparkle on thumbs-up, card flying into the deck.
- **Sound design** (later): soft room tone per scene, a chime for new words.

### 5.6 Mandarin-specific moments (the owner will notice these)

- **Tone colours** on all pinyin (tone 1 red, 2 orange, 3 green, 4 blue, the convention Pleco users know).
- **Tone tracing**: the teacher draws the contour in the air while saying the syllable.
- **Tone sandhi** taught visibly: 你好 is written nǐ hǎo but said ní hǎo (3 + 3 → 2 + 3); the prototype shows this.
- **Pitch comparison**: the learner's pitch line drawn over the teacher's after each attempt. Pitch extraction runs in the browser (autocorrelation), so it is fast and free; Gemini adds the coaching words.
- **Stroke order** for characters in `vocab_set` blocks (e.g. the open-source Hanzi Writer library).
- Spanish and French get the same treatment for stress, question intonation, nasal vowels and liaison.

### 5.7 Avatar engine interface

```ts
// src/lib/avatar/types.ts
interface AvatarDriver {
  mount(el: HTMLElement, persona: Persona): Promise<void>;
  speak(audio: MediaStream | HTMLAudioElement): void; // drives visemes from audio
  gesture(name: GestureName, opts?: { toneShape?: ToneShape }): void;
  setMood(mood: Mood): void;
  setListening(active: boolean, voiceLevel?: number): void;
  lookAt(x: number, y: number): void;
  dispose(): void;
}
// Implementations: RiveAvatarDriver (default), VideoAvatarDriver (photoreal vendor or Gemini Live Avatar, later)
```

### 5.8 Character production plan

1. **Week 1–2:** brief and concept art for 3 teachers (Mandarin, Spanish, French) + 1 healthcare persona. Decide the illustration style with the client.
2. **Week 2–4:** build the first character in Rive: rig, idle, 6 gestures, 5 moods, visemes. Use your agent + Rive tooling flow for structure; a human animator polishes timing and appeal.
3. **Week 4+:** remaining characters reuse the rig; personas change via data binding.
4. Budget: roughly a few hundred to a couple of thousand USD per hero character for professional animation polish (estimate; get quotes).

## 6. Language-specific risks to resolve first

Confirmed with the founder: the client mainly teaches **Mandarin Chinese**, plus **Spanish and French**. All three are on the Gemini Live API's supported language list, so the earlier Shona/Ndebele risk doesn't block launch.

Remaining checks for Phase 0:
1. **Mandarin tone accuracy:** test how well Live and Transcribe hear tone errors from beginners. Expect to rely on our own client-side pitch analysis for tone feedback, with Gemini for explanations.
2. **Learner accents:** test Zimbabwean learners speaking Mandarin, Spanish and French. Use `custom_vocabulary` for names, places and course terms.
3. **Explanations in the support language:** confirm English explanations (and code-switching) work well in a Mandarin session.
4. **Grounded grammar:** inject per-level grammar notes from the course into the system prompt so the teacher doesn't invent rules. Flagged sessions go to the human teacher's review queue.
5. **HSK / DELE / DELF alignment:** map levels to HSK for Mandarin and CEFR for Spanish/French so progress means something to learners and the client.

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
| `tutor_session` | Pick or create a `practice_scenario` + persona | "Start conversation" → avatar scene in the lesson |
| `listening_check` | Audio (generated or uploaded) + questions | Listen, answer, replay slower |
| `grammar_note` | Rule, examples, common mistakes | Card with audio examples; grounding source for the AI teacher |
| `shadowing` | Clip + transcript | Speak-along with comparison |

The existing AI generators (`generate-lesson-content`, `generate-curriculum`, `generate-course-blueprint`) get a **language preset**: "Create a 10-lesson A1 English course for Zimbabwean healthcare workers" produces lessons with vocab sets, dialogues, scenarios and grammar notes, not just text blocks.

### 7.3 Learner surfaces

- **Lesson player:** language blocks render inline; a floating "Practise speaking" button opens the scene for the current lesson.
- **Practice Room** (`/practice` under the tenant): the daily home for practice. Persona greeting, today's scene, deck review count, streak, CEFR progress.
- **Dashboard:** speaking minutes, can-do statements, words mastered, next live class.
- **Report history:** every conversation with transcript, corrections and replay.

### 7.4 Teacher / admin surfaces

- **Classroom gradebook:** new columns for speaking minutes, scene completion and weakest skill per learner; class heatmap of common mistakes ("14 of 20 learners flatten the 3rd tone in 很好").
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

Rough, from third-party summaries of Gemini pricing (audio in ≈ $3 / 1M tokens, Live audio out ≈ $12 / 1M, TTS audio out ≈ $9 / 1M, ~25 audio tokens per second). The avatar adds nothing because Rive renders on the device.

| Tier | Per 10-min scene | Per learner per month (20 scenes) |
|---|---|---|
| Text | ~$0.01–0.03 | ~$0.20–0.60 |
| Voice | ~$0.05–0.15 | ~$1–3 |
| Live | ~$0.10–0.30 | ~$2–6 |
| Live + photoreal avatar (optional) | ~$2+ | ~$40+ |

This is why Rive is the default and photoreal is an optional extra: it keeps a subscription viable in Zimbabwe. Real numbers come from the Phase 0 spike with `ai_usage_ledger` turned on.

## 11. Privacy, safety, compliance

- **Consent:** voice is personal data. Explicit opt-in to store recordings; transcripts kept by default, audio kept 30 days unless the learner saves it.
- **Zimbabwe Cyber and Data Protection Act (2021)** and Zambia's Data Protection Act: data processing agreement with the tenant; document that audio is processed by Google.
- **Minors:** if the tenant serves children, stricter defaults (no audio retention, stylised avatars only, teacher review on).
- **AI disclosure:** learners always know the teacher is AI. Gemini output carries SynthID watermarking.
- **Content safety:** system-prompt guardrails, flagging to the teacher review queue, per-tenant blocked topics.

## 12. Phased plan

### Phase 0 — Spikes (1–2 weeks). Answers the risky questions.
- Gemini Live voice loop in the browser with ephemeral tokens, from Harare/Lusaka network conditions: measure latency and data use.
- First Rive character (placeholder art is fine) driven by Live audio and by TTS audio, with 5 gestures triggered by tool calls / JSON tags.
- Test Mandarin tone recognition and Zimbabwean-accented Mandarin/Spanish/French with Live + Transcribe; prototype browser pitch tracking.
- Try Gemini Live Avatar (if we can get Enterprise access) and one vendor (Tavus or HeyGen LiveAvatar) side by side for the premium tier decision.
- Turn on usage logging to get real per-session cost.
- **Output:** confirmed tier design, Rive pipeline proven end to end, real cost per scene.

### Phase 1 — Speaking MVP (3–4 weeks). The demo that wins the client.
- `src/lib/ai` registry + Live session API (token minting, quota, completion) + Voice-tier turn API (transcribe → LLM JSON → TTS).
- Tables: `ai_personas`, `practice_scenarios`, `practice_conversations`, `practice_feedback`, `learner_language_profiles`, `ai_usage_ledger`.
- `RiveAvatarDriver` v1 with the first polished character (~10 gestures, 5 moods, visemes) and the tea-house scene.
- `tutor_session` block + Practice Room page + post-session report card.
- Placement conversation.

### Phase 2 — Full language course toolkit (4–5 weeks).
- Blocks: `vocab_set`, `dialogue`, `pronunciation_drill`, `listening_check`, `grammar_note`, `shadowing`.
- TTS pipeline with caching; audio in the media manager.
- Vocabulary SRS deck; mistakes feed the deck automatically.
- Language preset for AI course generation.
- Classroom gradebook columns + teacher review queue + scenario assignments.

### Phase 3 — Healthcare simulation + polish (3–4 weeks).
- Simulated patient personas and rubric feedback.
- Remaining Rive characters (Spanish, French teachers; nurse, doctor, patients) via the shared rig and data-bound colours.
- Persona memory across sessions, streaks, CEFR can-do progress, WhatsApp reminders.

### Phase 4 — Premium and scale.
- Optional photoreal "Face-to-face" mode (Gemini Live Avatar or a vendor) behind `AvatarDriver`.
- Numeric pronunciation scoring provider (after benchmarking).
- Live class captions/translation.
- Second AI provider behind the registry.

Course studio improvements from §9 are spread across phases: 1–3 in Phase 1, 6–8 in Phase 2, the rest in Phase 3.

## 13. Open questions for you (and the client)

Answered: languages are **Mandarin, Spanish, French**; avatar is **Rive** in a Duolingo-like warm style; no tiers yet (modes only); exams **HSK/HSKK, DELE, DELF**; **mobile app yes**. Still open:

1. **Sell vs build-for-them:** tenant on ZAI Academy (recommended) or a separate white-label deployment?
2. **Audience:** adults, professionals (healthcare), or children? Affects style, safety defaults, pricing.
3. **HSK version** the client's learners sit (HSK 2.0 levels 1–6 or the HSK 3.0 standard), and pilot cohort size.
4. **Character budget** for a human Rive animator's polish pass on hero characters.

## Sources

- Rive and Duolingo's Video Call with Lily: https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
- Rive lip-sync with state machine + viseme input (community guide): https://dev.to/uianimation/how-to-build-real-time-ai-lip-sync-using-rive-state-machine-viseme-data-26o7
- Rive runtime size and mascot architecture (community guide): https://dev.to/uianimation/engineering-interactive-mascots-with-rives-state-machine-and-runtime-architecture-4e2h
- Ready Player Me shutdown (Jan 2026): https://genies.com/blog/ready-player-me-shutdown
- Gemini 3.8 Flash TTS pricing (third party): https://docs.litellm.ai/blog/gemini_3_8_flash_tts

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
