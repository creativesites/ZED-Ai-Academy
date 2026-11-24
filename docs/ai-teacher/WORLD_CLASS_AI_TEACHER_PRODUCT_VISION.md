# World-Class AI Teacher — Product Vision

Status: proposal, 2026-11-24. Grounded in the [audit](WORLD_CLASS_AI_TEACHER_AUDIT.md). Architecture in
[ARCHITECTURE](WORLD_CLASS_AI_TEACHER_ARCHITECTURE.md), sequencing in [ROADMAP](WORLD_CLASS_AI_TEACHER_ROADMAP.md),
screens in [UX_SPEC](WORLD_CLASS_AI_TEACHER_UX_SPEC.md), trade-offs in [DECISIONS](WORLD_CLASS_AI_TEACHER_DECISIONS.md).

---

## 1. The promise

> **One learner. One personal teacher. One continuous learning relationship.**

A learner in Lusaka on a shared Android phone, a nurse in Ndola studying after a shift, and a Grade 12 class in
Kasama should each experience the same thing: a teacher who knows who they are, remembers what they found hard last
week, teaches them the way that works for them, checks that they actually understood, and tells them honestly what to
do next.

We measure ourselves by **what learners can demonstrably do that they could not do before**, and whether they can
still do it a month later — not by minutes of conversation or the fluency of AI responses.

## 2. What makes this different

Most "AI tutors" are a chat box bolted onto a course. Zed's differentiation, most of which is already partly built:

1. **A teacher, not a chatbot.** A persona with a face, a voice, a name, a teaching style and a board — who *teaches*
   (explains, demonstrates, checks, adapts) rather than only answering. Already built: avatar, voice modes, event
   contract, teaching board.
2. **Memory with evidence.** The teacher's knowledge of the learner is built from *evidence* — answers, attempts,
   explanations — with a visible trail, not from opinions. The learner can see it and correct it.
3. **Grounded in the actual course.** The teacher teaches *this* course's content, cites the lesson, jumps the video
   to the right second, and does not drift into generic internet answers.
4. **Educator-controlled.** Teachers design, test and approve their AI teachers without prompt engineering, and can
   see what their AI teacher did with every learner who shared a session.
5. **Built for Zambia first.** Mobile money, low data, shared devices, local languages done carefully, and an
   institution model that fits schools, colleges and employers.

## 3. Product pillars

### Pillar 1 — The Personal Teacher

One teacher per learner per academy (the academy chooses the persona; the learner can choose among the academy's
personas). The same teacher — name, voice, look, memory — appears in the lesson, in Ask Teacher, in practice, in
revision and in the viva.

The teacher knows, and can say *why* it knows:

| Knows | Source of truth |
|---|---|
| Who you are, your goals, background, preferences | **Learner profile** — learner-stated, editable |
| What you're studying and where you are | Enrollments, lesson progress |
| What you've mastered and what you struggle with | **Knowledge model** — evidence-weighted mastery per objective |
| What you misunderstood before | Misconception evidence |
| What you talked about last time | **Session summaries** (episodic memory) |
| How you like to learn | Preferences + observed effectiveness |

**Transparency and control** (non-negotiable): a "What my teacher knows about me" page lists every memory item with
its source; the learner can correct, hide or delete it; staff see only what institutional policy and the learner's
sharing allow; data has retention limits. See [ARCHITECTURE §4](WORLD_CLASS_AI_TEACHER_ARCHITECTURE.md).

### Pillar 2 — Adaptive Teaching Intelligence

The teacher follows a **teaching loop**, not a script:

```
 ┌── understand objective ──► probe prior knowledge ──► teach (explain / demo / example)
 │                                                           │
 │   recommend next ◄── record evidence ◄── assess ◄── check understanding
 │        ▲                                                  │
 └────────┴──── adapt: hint · simplify · re-explain · prerequisite · stretch ◄──┘
```

At every turn, a server-side **Teaching Policy** looks at the session state (objective, attempts, last result,
confidence, time left, learner preferences) and recommends a *move* — e.g. "learner failed twice on the same step:
switch from Socratic to worked example; revisit the prerequisite 'equivalent fractions'". The model remains free to
teach in natural language; the policy gives it direction and keeps it honest. This replaces "the model re-infers
everything from history" (audit §2.1).

Supported strategies (each is a named move set, see Architecture §5): Socratic, guided instruction, worked example,
demonstration, conversational, problem-based, role-play/simulation, exam preparation, independent practice,
retrieval/spaced revision, oral check (viva).

### Pillar 3 — Learner Intelligence and Mastery

A **Knowledge Model** that separates:
- **Demonstrated competence** — evidence from graded checks: quizzes, board interactions with known answers, viva
  questions, independent exercises. High weight.
- **Teacher-observed evidence** — the AI's judgement of an open answer. Medium weight, always with a rationale.
- **Self-report** — confidence ratings. Low weight; used for calibration, not mastery.

Each objective has: an estimate (0–1), a **confidence** (how much evidence, how recent, how varied), a last-seen date,
a next-review date, and prerequisite links. Objectives are **registered** (authored or extracted per lesson, stable
ids), not free text. See Architecture §4.

This powers: skill maps per course, prerequisite gap detection, spaced revision of concepts (not just vocabulary),
retention checks weeks later, progress milestones, and an honest "you're ready for the exam / you're not yet".

### Pillar 4 — Interactive Teaching Environment

The Teaching Board becomes a **widget platform**: one contract (`show_board` with a typed payload), a registry of
widgets, each with a renderer, a payload schema, an optional *answer check* (so interactions produce graded evidence),
and a lite fallback. Subject packs enable sets of widgets:

| Subject | Widgets (now → later) |
|---|---|
| Maths | equation (KaTeX), step reveal, formula sandbox ✓, graph plot, number line, fraction bars → geometry canvas |
| Programming | code with highlighting ✓ (upgrade), predict-the-output, fix-the-bug, fill-the-gap → sandboxed execution |
| Science | labelled diagram, process steps, chart ✓, unit converter → simulations |
| Business | table ✓, chart ✓, mini financial model (editable cells), decision tree |
| Healthcare | case card, triage decision tree, vital-signs chart, role-play consult (health-sim pack) |
| Languages | card ✓, tone trace ✓, pronunciation feedback ✓, ordering, fill-blank, listening comprehension |

Ordering, fill-blank and choice become **real contract events** with answer keys — not regex guesses from speech.

### Pillar 5 — Exceptional Learner Experience

Three environments, consistent with the platform redesign (`docs/redesign/02`, `04`):

1. **Learning Home** (`/academy/[domain]/classroom`) — answers *Where am I? What next? How am I doing? What should I
   practise?* in one "Up next with <Teacher>" card, not a wall of tiles.
2. **Lesson Experience** (`/courses/[slug]/learn`) — content first; the teacher appears at authored moments and on
   demand ("Ask <Teacher>"), knows the lesson, cites it, jumps the video.
3. **Teaching Room** (`/academy/[domain]/practice/...`, existing URLs kept; labelled "Teacher" in navigation) — focused, full-screen session for deep teaching, voice,
   practice, revision and viva. Immersive, focus and compact presentations; data-saver by default on slow
   connections.

Principles: calm, one primary action per screen, progressive disclosure, voice *and* text always available, captions
always available, works on a 2 GB Android over 3G.

### Pillar 6 — AI Teacher Studio

For teachers and course creators, one place — **Studio** — to:
- define **personas** (look, voice, pronunciation glossary, personality, *teaching philosophy* as structured settings:
  default strategy, strictness, hint policy, language mix);
- **analyse a course** → objectives per lesson (reviewed by the educator) → prerequisite links;
- **generate teaching flows** from templates, place them as **teacher moments**, edit conversationally, **test as a
  student**, run the **Simulation Lab**, then **publish with approval**;
- see **versions** and restore any previous one; in-flight learner sessions stay on the version they started with;
- Autopilot proposes; humans approve.

### Pillar 7 — Quality Assurance and Simulation Lab

A teacher is not "good" because it is fluent. Every flow can be run against **simulated learners** (beginner,
average, advanced, confused, persistent misconception, off-topic/unexpected, adversarial) for full multi-turn
sessions grounded in the lesson, scored by **rubrics** (accuracy, objective coverage, diagnosis of the planted
misconception, adaptation, explanation quality, assessment reliability, difficulty, audience suitability,
hallucination) with deterministic checks first and an LLM judge second. Results are stored, comparable across
versions, and a **quality gate** blocks publishing flows that regress. Platform-level **golden sets** guard prompt and
model changes.

## 4. Who it serves

| Persona | Job to be done | What "great" feels like |
|---|---|---|
| **Chipo**, 17, Grade 12, shared phone, prepaid data | Pass maths and biology exams | "Tinashe noticed I keep confusing mitosis and meiosis and fixed it in 5 minutes. It works on my phone without eating my data." |
| **Mutale**, 29, nurse, studying after shifts | Finish a CPD course; be confident in practice | "I practised a triage consultation by voice on the bus. It remembered where I stopped." |
| **Mr Banda**, secondary teacher | Get his class through the syllabus | "I turned my lesson into an AI teacher in two minutes, tested it on a 'confused student', and I can see which concepts my class is stuck on." |
| **Academy admin** (school, college, employer) | Deploy safely; prove outcomes | "Our data stays ours, costs are predictable, and I can show the board that pass rates went up." |
| **Independent creator** | Sell a premium course | "My course has a teacher that makes it worth paying for." |

## 5. Critical journeys (summary — detail in UX spec)

1. **First meeting.** New learner opens a course → teacher introduces itself in one line, asks *one* question about goal
   and level (skippable) → writes to profile → first lesson begins. Never a form.
2. **Stuck in a lesson.** Learner pauses video, taps "Ask Tinashe" → asks → teacher answers with a board and a lesson
   reference, offers a 2-question check → result recorded as evidence.
3. **Daily return.** Learning Home shows "Up next with Tinashe: 6-minute revision on equivalent fractions (you were
   unsure last Tuesday)" → one tap into the Teaching Room.
4. **Failed quiz.** Quiz result → "Go through the two you missed with Tinashe" → focused session on exactly those
   objectives.
5. **Certificate.** Course complete → viva (5–8 min) → pass, or "two things to firm up", with a human review route.
6. **Educator authoring.** Lesson → "Add AI teacher" → objectives → flow → simulate → approve → publish.
7. **Institution oversight.** Admin sees class-level gaps, which learners need help, and assigns a targeted revision.

## 6. Product principles

1. **Learning outcomes over engagement.** No streak dark patterns; no XP for time spent; reward demonstrated learning.
2. **Evidence over opinion.** Mastery comes from checks with known answers before AI judgement.
3. **One teacher.** Every learner-facing AI surface uses the same engine, persona and memory.
4. **Educator in control.** AI drafts; humans approve anything learners see in published courses.
5. **Honest and transparent.** The learner can see what the teacher knows and why; the teacher says "I'm not sure"
   rather than inventing.
6. **Respect the device and the data bundle.** Lite is a first-class experience, not a degraded one.
7. **Voice is the lesson, text is always there.** Never mute the teacher automatically (existing rule); always offer
   captions and typed input.
8. **Safe by construction.** Tenant isolation, minimal data to models, no learner data in prompts that isn't needed.

## 7. Opportunity assessment (Part 3 of the brief)

Scored 1–5 on learner value (V), feasibility now (F), strategic importance (S). **Build now** = in Phases 1–2;
**Next** = Phases 3–4; **Later** = Phase 5+; **Not now** = revisit with evidence.

| # | Opportunity | V | F | S | Verdict | Why |
|---|---|---|---|---|---|---|
| 3 | **Learning retention** (scheduled concept revision, delayed checks) | 5 | 4 | 5 | **Build now** | Biggest real outcome lever; SRS engine exists for vocab; needs objective registry |
| 2 | **Study companion** (notes, flashcards, quizzes from course content) | 4 | 5 | 3 | **Build now (narrow)** | Notes export and vocab deck exist; extend deck to concept cards generated from objectives — not a separate product |
| 6 | **Certificate Viva** (strengthen) | 4 | 4 | 5 | **Build now** | Exists; add human review, appeal, mastery input, configurable rubric. Key B2B credibility |
| 5 | **Adaptive examinations** | 4 | 3 | 4 | **Next** | Needs a calibrated item bank with difficulty; start with adaptive *practice* quizzes from the knowledge model |
| 8 | **Institution intelligence** | 4 | 4 | 5 | **Next** | Insights exist; needs trustworthy mastery first or it amplifies noise |
| 4 | **Real-time conversation** (barge-in, follow-ups) | 3 | 4 | 3 | **Next (polish)** | Live already supports interruption; fix server trust and reliability before adding more |
| 1 | **Camera homework assessment** | 5 | 3 | 4 | **Next (Phase 4), maths first** | High value in Zambian context (handwritten work); multimodal models can read it; needs rubric + human-override UX and careful privacy (photos of minors) |
| 9 | **Local-language learning** | 4 | 2 | 5 | **Later, gated** | Packs exist but speech quality in Bemba/Nyanja/Tonga is unvalidated. Run a validation programme with native-speaker educators before marketing; ship as "beta" in teaching-explanations (bilingual support) before speech assessment |
| 10 | **Low-data / offline** | 5 | 2 | 4 | **Low-data now, offline later** | Lite mode, text-first, cached TTS, smaller assets now. True offline AI is not feasible; offline *revision decks* and downloaded lesson text are |
| 7 | **Collaborative learning** | 3 | 2 | 2 | **Not now** | Hard to do well, moderation load, unclear outcome lift. Revisit when institutions ask with a specific classroom use case |

## 8. What we will *not* build (for now)

- A general-purpose chatbot detached from courses.
- A separate tutor per feature (no "quiz bot", "revision bot", "exam bot" — one teacher, many modes).
- A vector database or microservices before course-scale retrieval is a demonstrated bottleneck (lesson text fits in
  context today; see Decisions D-07).
- Gamification that rewards time-on-app over learning.
- Fully autonomous publishing of AI-generated teaching on live courses.
- More 3D avatars, scenes or ambient effects until the core loop is consolidated (they are already ahead of the
  learning model).

## 9. How we'll know it's working (headline metrics)

Full framework in [ROADMAP §9](WORLD_CLASS_AI_TEACHER_ROADMAP.md).

- **Learning gain:** post-session check accuracy on targeted objectives vs. pre-check (target +20 pts).
- **Retention:** accuracy on delayed review (7 and 30 days) for mastered objectives (target ≥70%).
- **Misconception resolution:** % of detected misconceptions not repeated in the next 2 checks (target ≥60%).
- **Return:** % of learners with a teacher interaction in 3 of the last 7 days (weekly active learning).
- **Teaching quality:** Simulation Lab pass rate for published flows (target ≥85% rubric score), factual error rate
  from reviewed samples (<1%).
- **Cost per outcome:** AI cost per objective moved to "secure".
