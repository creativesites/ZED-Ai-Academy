# World-Class AI Teacher — UX Specification

Status: proposal, 2026-11-24. This spec covers the **AI teacher inside** the shells defined by the platform redesign
(`docs/redesign/01-design-system.md`, `02-information-architecture.md`, `04-student-experience.md`). It does not
redefine those shells, tokens or routes; where it needs a change to them, it says so and the change is coordinated via
`docs/redesign/HANDOFF.md`.

Related: [VISION](WORLD_CLASS_AI_TEACHER_PRODUCT_VISION.md) · [ARCHITECTURE](WORLD_CLASS_AI_TEACHER_ARCHITECTURE.md) ·
[ROADMAP](WORLD_CLASS_AI_TEACHER_ROADMAP.md) (backlog ids like P1-09 refer there).

---

## 1. Principles in practice

| Principle | Concretely |
|---|---|
| One teacher | Same persona name, face, voice and memory on every surface. The UI says "Tinashe", not "AI Tutor". |
| One primary action | Every teacher surface has exactly one filled button. Secondary actions are text buttons or in a menu. |
| Progressive disclosure | Controls appear when relevant: the mic tray appears when the teacher asks you to speak; speed/volume live in a menu. |
| Calm | No confetti on every answer; celebration reserved for objective → secure and course milestones; reduced motion respected everywhere. |
| Text is always there | Captions on by default; typed input always one tap away; transcript always available. |
| Respect the data bundle | Data saver auto-on for slow/cellular/Save-Data; teacher visuals become a static portrait; voice still plays (never auto-mute). |
| Honest progress | Show what was demonstrated ("2 of 3 checks correct"), not vanity ("87% engaged"). |

### 1.1 Vocabulary (applies to all UI strings)

| Use | Don't use |
|---|---|
| **<Persona name>** (e.g. "Tinashe") when talking about the teacher | ZAI, ZAI Tutor, AI Tutor, bot, assistant |
| **AI teacher** for the generic concept (creator UI, marketing) | Tutor, AI coach, Teacher's Room |
| **Ask Tinashe** (lesson help) | Ask AI, Chat |
| **Teaching session** (a guided session) | Practice Room (except language speaking practice: "Speaking practice") |
| **Teacher** (nav item, learner) | Practice (nav item) |
| **Revision** (scheduled review) | Sprint (internal name only) |
| **Oral check** (viva, learner-facing); "Certificate viva" in creator UI | Exam |
| **What Tinashe knows about you** | Memory, profile data |
| **Prompt lab** (current `PracticeStudio`) | Practice Studio (collides with practice) |

Mobile nav: guests "AI teacher" → `/ai-tutor` (marketing URL unchanged); signed-in "Teacher" → academy Teacher home.

## 2. Information architecture (learner)

Within the redesign's student shell (`/academy/[domain]/…`):

```
Home (/classroom) ───────────── "Up next with Tinashe" card (P1-09)
My learning (/classroom/learning)
  └─ Lesson (/courses/[slug]/learn, Focus) ─ Ask Tinashe panel · teacher moments · oral check
Teacher (/practice)  ← nav label "Teacher"; URL unchanged
  ├─ Teacher home: continue · due revision · suggested sessions · speaking practice (language academies)
  ├─ Session (/practice/[scenarioId], Focus)    ← Teaching Room
  ├─ Revision (/practice/revision, Focus)       ← replaces /practice/sprint (redirect)
  ├─ Cards (/practice/deck)                     ← vocab + concept cards
  ├─ History (/practice/history)                ← all sessions incl. Ask conversations
  └─ What Tinashe knows (/practice/about-me)    ← memory & mastery transparency (P1-08)
Progress (/classroom/progress) ─ adds "Skills" section: objective map per course
```

Platform `/practice/**` redirects to `/academy/zedai/practice/**` (already decided in redesign 02 §2.1). Lesson and
report links must keep the academy context (fixes audit §8 tenant loss): every teacher link is built with
`academyHref(domain, path)`.

Educator IA (staff shell `/academy/[domain]/admin`):

```
AI teachers (/admin/ai-teachers)
  ├─ Teachers   (personas: look, voice, philosophy, versions)
  ├─ Flows      (all flows; filters by course, status, Lab result)  → Flow Editor
  ├─ Lab        (simulation runs, golden checks, gates)
  ├─ Insights   (objectives × class groups, misconceptions, learners needing help)
  ├─ Reviews    (shared/assignment/viva sessions to review)
  └─ Settings   (default teacher, modes, budgets, privacy & retention, audience)
Courses → course → lesson editor → "AI teacher" side panel → Flow Editor (same component)
```

## 3. Learning Home — "Up next with <Teacher>" card (P1-09)

Replaces `DailyPlanCard`, `TutorSpotlightBanner` and the academy dashboard's three tiles. It slots into the redesign's
classroom home as the content of **"Up next"** when the most important thing is teacher-led; otherwise it sits as the
"Practice with AI" slot (redesign 04 §4 item 7), renamed "With Tinashe".

Priority order for the primary item (pure function `pickUpNext()`):
1. Live class within 30 min (owned by the classroom card, not this one).
2. Due revision with ≥1 `needs_review` objective → "6-minute revision: equivalent fractions".
3. Resume an unfinished teaching session (< 48 h).
4. Next lesson that has a teacher moment.
5. Failed quiz objectives not yet revisited.
6. Suggested new flow in an enrolled course.

```
┌───────────────────────────────────────────────────────────┐
│ (portrait) Tinashe                                         │
│ "Last Tuesday you mixed up numerator and denominator.      │
│  Shall we make it stick?"                                  │
│                                                            │
│ ▶ Start 6-min revision               Equivalent fractions │
│                                                            │
│ Also: Continue "Fractions 3" · 12 cards due    See all ›   │
└───────────────────────────────────────────────────────────┘
```

- One filled button. At most two text links. No streak number unless the learner opted into streaks.
- The quoted line comes from the memory brief (episode or misconception); if none, a neutral line ("Ready when you
  are").
- Mobile: full width, portrait 40px; data saver: initials avatar, no image.
- Empty state (new learner): "Meet Tinashe, your teacher for {academy}. Start your first lesson →".

**Progress (/classroom/progress) "Skills" section:** per course, objectives grouped by lesson with four states shown as
text + shape (not colour only): ○ not started · ◐ learning · ◑ practising · ● secure · ↺ due for review. Tap → evidence
trail ("Correct on 12 Nov (quiz Q3) · Unsure on 14 Nov (session) · Correct after 7 days (revision)").

## 4. Lesson experience

### 4.1 Layout (desktop ≥ lg)

```
┌ outline ┐┌──────────── lesson content (video, text, quiz) ────────────┐┌─ Ask Tinashe (380px) ─┐
│ modules ││                                                            ││ (portrait) Tinashe     │
│ lessons ││  ...                                                       ││ board (if any)         │
│         ││  ┌ teacher moment ─────────────────────────────┐          ││ messages               │
│         ││  │ (portrait) "Quick check on what you just     │          ││ [chips] Explain simpler│
│         ││  │ watched — 2 minutes."   ▶ Start   Later      │          ││ Example · Quiz me      │
│         ││  └──────────────────────────────────────────────┘          ││ [ type… ] (mic)        │
└─────────┘└────────────────────────────────────────────────────────────┘└────────────────────────┘
```

- **Ask panel** closed by default on first visit; a floating "Ask Tinashe" button (bottom-right, 48px) opens it; state
  remembered per learner (preference, not lesson).
- Tablet (md–lg): panel overlays the content as a right sheet (`role="dialog"`, focus trap, Escape closes).
- Mobile (< md): bottom sheet with three heights (peek 30% showing the last teacher line, half, full). The video keeps
  playing in the top area at half height so "jump to 3:12" is visible.

### 4.2 Ask interaction examples

- Learner selects text in the lesson → contextual chip "Ask Tinashe about this" → opens panel with the quote attached.
- Learner pauses video and opens Ask → first chip is "Explain what was just said (2:40–3:10)".
- Teacher answer with a lesson reference shows a **jump chip** "▶ 3:12 in the video" → seeks the video, panel stays.
- "Quiz me" → teacher emits 1–2 graded `ask_choice` cards inline; result line "Recorded: 1 of 2 correct" in small text,
  with "why?" disclosure (transparency).
- A long explanation becomes a board (steps/equation) above the messages; board persists while the conversation scrolls.
- Conversation is saved; "History" link in the panel header shows earlier Ask conversations for this course.

### 4.3 Teacher moments

- Inline card at the authored position (after block X). Required moments show "Required to complete this lesson".
- "Start" opens the **Teaching Room in Focus mode** for short moments (≤5 min) as a full-screen sheet over the lesson on
  mobile and as a centred focus overlay on desktop; on finish, return exactly to the scroll position with a result
  chip on the card: "Done · 2 of 3 checks · Review later".
- "Later" snoozes; the card stays; the lesson can't be completed if required.

### 4.4 Quiz → teacher

Quiz result screen: if any question with an objective is wrong → single primary button "Go through these with
Tinashe (≈4 min)" + secondary "Retake quiz". Never auto-start.

## 5. Teaching Room (session)

### 5.1 Presentations

| Presentation | When | Layout |
|---|---|---|
| **Immersive** | Desktop/tablet, default for voice sessions, data saver off | Scene + avatar left (or top), board right; captions under avatar |
| **Focus** | Default on mobile and for moments; learner toggle | Small avatar portrait in header, board takes the stage, captions as the main text |
| **Compact** | Data saver on, reduced motion, or learner preference | Static portrait, text-first conversation, board inline; no scene |

Learner chooses in the "⋯" menu; choice saved in `learner_preferences`. Auto-switch to Compact on low FPS (UX-04) with a
toast "Switched to a lighter view — change in ⋯".

### 5.2 Layout (mobile, Focus)

```
┌───────────────────────────────────────────┐
│ ←  Fractions with Tinashe   ●●●○○   ⋯  End │  header: back, title, step dots, menu, End
├───────────────────────────────────────────┤
│ (40px portrait) Tinashe is speaking…  🔊   │  speaker strip
│                                           │
│   ┌──────── board ────────────────────┐   │
│   │  ½ = ²⁄₄ = ⁴⁄₈                     │   │
│   │  [fraction bars widget]            │   │
│   └────────────────────────────────────┘   │
│                                           │
│  "Which is bigger, 2/3 or 3/5?"           │  caption (native + translation toggle)
│                                           │
├───────────────────────────────────────────┤
│  ( 2/3 )   ( 3/5 )   ( equal )            │  interaction tray (only when asked)
│  [ Type instead ]           ( 🎤 hold )   │  input row: one primary (mic or send)
└───────────────────────────────────────────┘
```

### 5.3 Controls (replaces the ~10-control header — UX-01)

Visible: Back, title, step progress, **⋯**, End. In **⋯**: Presentation (Immersive/Focus/Compact), Speed (0.85/1/1.15),
Captions (on/translation/romanisation), Voice (on/off — explicit learner choice only), Volume, Ambient sound, Notes &
transcript, Data saver, Report a problem. All targets ≥44px. Keyboard: Space hold-to-talk (exists), `T` focus text
input, `R` replay last line, `Esc` closes menus/drawers, `?` shortcuts sheet.

### 5.4 Input tray (replaces the 30-button Composer — UX-02)

The tray shows **one** of: voice input (default for voice sessions), text input (default text sessions or mic denied),
or an **interaction** (choice chips, order list with drag + up/down buttons, fill-blank fields, numeric with unit,
confidence 1–5) when the teacher asked one. Secondary: "Type instead"/"Speak instead", image (only if the flow allows
camera homework), "Hint" (counts against hint policy, shown honestly: "Hint used"). Hands-free (VAD) lives in ⋯.

### 5.5 End of session — report

Order: (1) one-line teacher summary in their voice; (2) **objectives**: met / partly / review, each with the evidence
line and source label (Checked ✓ / Teacher's judgement); (3) **one** next step with a primary button (revision date or
next lesson); (4) "What I'll remember" — the memory candidates from this session with ✕ to discard each (consent at the
point of capture); (5) secondary: transcript & notes, save words to cards (language), share with my teacher (toggle,
explained).

### 5.6 Accessibility and inclusion

- WCAG 2.2 AA; contrast via tokens; no colour-only status.
- Every teacher utterance in an `aria-live="polite"` region; board updates announced as "Board updated: <title>".
- Dialogs (`Ask` sheet, transcript, ⋯) use `role="dialog"`, focus trap, Escape, return focus.
- Captions on by default; speed control; slow replay; transcript export (exists).
- Reduced motion: no avatar idle sway, no scene parallax, no celebration animation (static badge).
- Screen-reader mode: Compact presentation, all interactions as native inputs (radio group, ordered list with move
  buttons).
- Language: UI strings externalised (i18n) — English first; teacher explanation language per learner preference
  (bilingual support for local languages is a teaching setting, not UI translation).

### 5.7 Low-end and low-data behaviour

| Condition | Behaviour |
|---|---|
| Save-Data / 2g / 3g / cellular (auto) or learner toggle | Compact presentation; no Rive/Three load; TTS at lower bitrate; images in boards lazy |
| Low FPS detected (< 24 fps for 3 s) | Downgrade avatar → static portrait; offer Compact |
| Offline mid-session | Queue learner input; banner "You're offline — we'll send this when you're back"; never lose typed text |
| Mic unavailable/denied | Text mode, no nagging; one-line hint how to enable |
| Old Safari (MP4 only recording) | Accepted by `/turn` (supported); otherwise text fallback |

Budgets: initial lesson-page JS ≤250 KB compressed; teacher assets loaded on first interaction; Rive wasm and `.riv`
never on pages where the teacher isn't visible.

## 6. Critical learner journeys

**J1. First meeting (new learner, new course)**
1. Opens lesson 1. Moment card at top: "Hi, I'm Tinashe. One quick question so I can help you best." [Answer] [Skip].
2. One question with chips: "What brings you here?" (exam · job · curiosity · teacher asked me) + "How confident are you
   with {course topic}?" (1–5). Writes `learner_memories` (learner_stated).
3. "Thanks. I'll check in after the video." Lesson continues. *Never a form; skippable; editable later.*

**J2. Stuck during a video** — pause → Ask → "Explain what was just said" → board + jump chip → "Want a quick check?" →
1 graded question → evidence recorded → back to video.

**J3. Daily return on phone over 3G** — Home → Up next card (Compact automatically) → 6-min revision → 3 objectives
interleaved → report: "2 secure, 1 to review on Friday" → done in under 8 minutes and < 2 MB data.

**J4. Failed quiz** — result screen → "Go through these with Tinashe" → session seeded with the two missed objectives →
worked example → check → evidence → quiz retake suggested.

**J5. Certificate oral check** — course 100% → "Last step: a 6-minute oral check with Tinashe" → open questions,
follow-ups, no teaching → outcome: Pass (certificate issued) / "Almost — two things to firm up" (revision scheduled, retry
in 24 h) / "Sent to your teacher for review" (needs_review). Learner can request human review once.

**J6. Correcting memory** — Teacher home → "What Tinashe knows" → sees "Struggles with negative numbers (from session 4
Nov)" → taps "This isn't right" → hidden from teacher; evidence still counts toward mastery but the note no longer
appears in prompts.

## 7. Educator journeys

**E1. Add an AI teacher to a lesson (target ≤10 min incl. testing)**
1. Lesson editor → right panel "AI teacher" → "Add AI teacher".
2. Objectives (extracted, editable, linked to the course objective list; duplicates suggested for merge).
3. Choose template (6) and teacher; "Draft" → storyboard of steps (goal, board preview, check).
4. Edit with words ("make step 2 easier") → diff → accept/undo.
5. **Test** tab: "Try it yourself" (preview) or "Run with simulated students" (Lab: Beginner, Confused, Misconception,
   Off-topic, Advanced) → report with red/amber/green per rubric and links to the exact turns.
6. Place: "After video 'Adding fractions'" (moment) · Required? · Duration.
7. Publish → creates version v1. Live learners pick it up on their next session; in-flight sessions keep their version.

**E2. Autopilot a course** — Course → AI teachers → "Draft teachers for 8 lessons" → batch runs in background with a
progress list → review screen: one row per lesson (objectives, template, Lab score) → select → "Publish selected" (only
rows previewed or Lab-passed are selectable).

**E3. Act on insights** — Insights → filter class "Grade 12B" → heat map objectives × learners (counts, not names, by
default; names after click for staff with permission) → "Equivalent fractions: 14 learners at risk" → "Assign revision to
these 14" → due date → done; outcome tracked ("9 of 14 now secure").

**E4. Review a shared session or viva** — Reviews → filters (viva needs review, flagged, shared) → transcript with
evidence highlights → decision (approve/return with note) → learner notified.

### 7.1 Flow Editor layout (P3-01)

```
┌ Flow: Fractions with Tinashe  v3 (draft) ───────────────── [Test] [Publish v4] ┐
│ Tabs: Steps · Objectives · Teacher & style · Test & quality · Versions · Placement │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Steps (storyboard)                                  │ Edit with words             │
│ ┌1 Probe┐ ┌2 Explain┐ ┌3 Worked ex.┐ ┌4 Check┐       │ [ make step 2 easier     ] │
│ goal / board preview / check / objective chips      │ Diff since v3 ▸            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Same component in lesson panel (narrow: tabs become an accordion), Studio and course tab. Keyboard reorder: focus a step
card, `Alt+↑/↓`.

## 8. Responsive guidance

| Breakpoint | Lesson | Teaching Room | Studio |
|---|---|---|---|
| < 640 (phone) | Ask = bottom sheet; moments open full-screen | Focus default; tray at bottom with safe-area | Read & approve only (review, publish, insights); editing shows "best on a larger screen" but works |
| 640–1024 (tablet) | Ask = right sheet overlay | Focus or Immersive (portrait: stacked) | Full editor, single column |
| ≥ 1024 (desktop) | Ask = docked side panel | Immersive default, board right | Full editor, two columns |

Touch targets ≥44px; no hover-only affordances; drag always has a button alternative.

## 9. Visual direction

- Warm, calm, premium: the redesign tokens; one accent (academy brand colour) used for the primary button and the
  teacher's name label only.
- The teacher portrait is the brand anchor; scenes are optional atmosphere (Immersive only).
- Boards: white/near-white surfaces, generous spacing, KaTeX typography for maths, monospace with clear syntax colours
  for code; widgets share one control style.
- Motion: 150–250 ms ease-out transitions; avatar lip-sync and gaze only in Immersive; celebrations: a single badge
  animation when an objective becomes secure.
- Empty and error states speak in the teacher's voice but stay factual ("I couldn't hear that — try again or type it").
