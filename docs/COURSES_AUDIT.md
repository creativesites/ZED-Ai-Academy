# Courses — End-to-End Audit & MVP Readiness (Nov 2026)

Scope: everything a course touches, from **creation** (creator studio, curriculum, lesson editor, AI
generation, publishing) to **learning** (catalog page, enrolment, lesson player, quizzes, progress,
certificate). Tested on a local build against the live Supabase project, at phone size (375px) and desktop.

---

## 1. Verdict

| Area | Before | After this pass |
|---|---|---|
| Security of course data & progress | ❌ Not launchable (5 critical holes) | ✅ Fixed |
| Creator studio UX (mobile) | ⚠️ Clunky, stats-first, publish button off-screen | ✅ Rebuilt, outline-first |
| Lesson editor | ⚠️ Per-block manual "Save", easy to lose work | ✅ Autosave, live preview, prev/next |
| AI-assisted creation | ⚠️ Outline from "Draft with AI" was discarded | ✅ Outline carried over + bulk-draft lessons |
| Learner player | ⚠️ Fake generic objectives, no toasts, cramped mobile | ✅ Rebuilt reading-first player |
| Quizzes | ❌ Answer key shipped to browser, attempts unlimited | ✅ Server-graded, key hidden, attempts enforced |
| Certificates | ✅ Works (after fixes) | ✅ |

**MVP verdict: launchable for courses once the items in §5 "Before launch" are done** (mostly
payments/ops, not course code).

---

## 2. Critical issues found & fixed

All server code uses the Supabase **service-role** client, so the app layer is the only guard. These
were exploitable by any signed-in user calling server actions directly.

1. **Free access to paid courses.** `generateCertificate()` inserted an enrollment for the caller
   *before* checking completion → anyone could enrol themselves in any paid course.
   → It now requires an existing **active** enrollment and never creates one.
2. **Quiz authoring had no authorization.** `createQuiz/updateQuiz/addQuestion/updateQuestion/deleteQuestion`
   only checked "is signed in" → anyone could rewrite any quiz's answers.
   → All go through `assertCanManageLesson/Quiz` (new helpers in `src/lib/courses/course-auth-server.ts`).
3. **Cross-course content edits (IDOR).** Block update/delete/reorder and lesson update/delete checked the
   *course* the caller passed but not that the block/lesson belonged to it.
   → Every mutation is now scoped to its parent (`.eq("lesson_id", …)`, lesson→course resolution).
4. **Content leak on the learn page.** `?lesson=<any id>` loaded blocks for lessons of *other* courses for
   any enrolled learner; draft courses were reachable (and auto-enrolled) by slug.
   → Lesson must belong to the course; drafts only for authors and existing enrolments.
5. **Quiz answer key in page payload.** `correct_indices` was sent to every learner's browser.
   → Stripped until the learner passes or uses all attempts; grading stays server-side.

Also fixed: `markLessonComplete` didn't check enrollment; `saveQuizAttempt` ignored `max_attempts` and
trusted a caller-supplied `lessonId`; deleting a quiz block left the quiz live for learners;
publishing allowed paid courses with no price and lessons with no content.

---

## 3. Creator experience — what changed

**Course studio** (`course-studio-view.tsx`, `studio/studio-tabs.tsx`)
- Compact header: cover thumbnail, status pill, meta line, Preview + single Publish button (fits 375px).
- "Next step" nudge with readiness ring replaces four oversized stat cards.
- Tabs: **Curriculum** (default) · **Launch** · **Details** · **AI Teacher** · **Insights**, sticky on scroll,
  synced to `?tab=` (refresh/back keep your place; checklist "Fix" links jump to the right tab).
- Launch checklist distinguishes **required** vs **recommended** and lists empty lessons by name.

**Curriculum** (`curriculum-builder.tsx`)
- Empty state offers "Draft with AI" or "Start from scratch".
- Rapid outlining: type a lesson title, press Enter, keep typing (optimistic, no page jump).
- Per-row ⋯ menus: edit, free-preview toggle, **duplicate** (copies blocks + quiz), move up/down
  (touch-friendly alternative to drag), delete with clear consequences.
- Status per lesson (Empty / N blocks / Quiz / Free preview) and "x/y built" progress.
- **Draft all empty lessons with AI** in one run, with progress, cancel, and per-lesson failure isolation.
- Drag handles use touch delay + distance so scrolling on phones doesn't start drags.

**Lesson editor** (`lesson-editor-client.tsx`, `lesson-studio-view.tsx`)
- **Autosave** per block (1.2s debounce) + title autosave; global Saved/Saving/Not saved indicator;
  ⌘/Ctrl+S flushes; warns before leaving with unsaved edits.
- Live preview reflects unsaved edits; AI "Rewrite" updates the editor in place.
- Prev/next lesson navigation, "Lesson x of y", "View as learner".
- Block menu: add below, duplicate, move up/down, delete. Searchable block picker with descriptions,
  grouped Essentials / Teach / Practice / Live & Safety.
- Mobile bottom bar: Edit · Preview · AI · Add. Forced onboarding tour removed.

**New course** — the AI blueprint's module outline is now created with the course.

**Global style fix** — the legacy marketing template loads Bootstrap's reboot *unlayered*, which beats
every Tailwind utility (square buttons, 17px button text, oversized headings, recoloured links).
`.app-surface` (globals.css) rolls those properties back for app UIs and their dialogs/menus.

---

## 4. Learner experience — what changed

- **Lesson player** rebuilt: real lesson title (the old header showed hard-coded "Quick Start / Audit &
  Ship" objectives unrelated to the course), reading-width column, mobile drawer that closes on
  navigation, locked lessons not clickable, progress per module, sticky mobile action bar
  (prev · primary action · next). Removed generic "Safety checklist" and fake learning-path cards.
- One clear **primary action** per state: Enrol → Take the quiz → Complete & continue → Claim certificate.
- **Toasts now show** — the player had no `<Toaster/>` so every success/error message was invisible.
- **Resume**: `/learn` without `?lesson=` opens the first incomplete lesson.
- Quiz: attempts remaining, answer key only after pass/out-of-attempts, practice retakes after a pass
  don't overwrite the pass.
- **Course page**: progress bar + "Continue learning", payment-pending state, clickable free-preview
  lessons, "Watch a free lesson" CTA, cover image, what's-included list.

---

## 5. Remaining gaps (prioritised)

### Before launch
- [ ] **Payments**: checkout still relies on manual "pending payment" confirmation. Wire PayChangu /
      Flutterwave webhooks to flip enrollments to `active` (keep it behind `src/lib/payments/`).
- [ ] **Run the QA script** in §6 on a staging deploy with a real paid course.
- [ ] **Instructor quiz reset**: attempts are now enforced; raising `max_attempts` unlocks learners, but a
      per-learner "reset attempts" button in Insights would be kinder.
- [ ] Remove QA data created during this audit (see §7).

### Soon after launch
- [ ] Course landing content is partly generated from category presets (`course-experience.ts`).
      Add per-course fields: outcomes ("What you'll learn"), requirements, estimated duration.
- [ ] Lesson-level estimated duration + "x min left" for learners.
- [ ] Learner notes & bookmarks per lesson (listed in FEATURES.md, not implemented).
- [ ] Certificate PDF download (currently a web page at `/certificates/[id]`).
- [ ] Insights: per-lesson drop-off, quiz pass rates, learner table with progress.
- [ ] Course duplication (whole course) and templates.
- [ ] Move the legacy template CSS into a cascade layer (`@import … layer(legacy)`) so the `.app-surface`
      workaround can be removed site-wide.

---

## 6. QA script (manual, ~15 min)

Creator (phone width):
1. New course → "Draft with AI" → create → modules appear in Curriculum.
2. Add 3 lessons with Enter-Enter-Enter; duplicate one; move it up; delete it.
3. "Draft N empty lessons with AI" → all lessons show block counts.
4. Open a lesson → edit a text block → watch "Saving… → Saved" → reload → edit persisted.
5. Add a Quiz block, 2 questions, pass mark 70%. Make lesson 1 a free preview.
6. Launch tab → all required items green → Publish.

Learner:
7. Signed-out → course page → "Watch a free lesson" → sign in → preview plays, others locked.
8. Enrol (free) → Start learning → complete lesson → auto-advance → resume via `/learn` lands on next.
9. Fail the quiz → no answers revealed → pass → answers + explanations shown → lesson marked complete.
10. Finish all lessons → Claim certificate → certificate page loads.

Security spot-checks:
11. As a learner, call `saveQuizAttempt` for a quiz in a course you're not enrolled in → rejected.
12. `/courses/<slug>/learn?lesson=<lesson from another course>` → redirected, no content.

---

## 7. QA data created during this audit

- Clerk dev users: `qa.instructor+clerk_test@example.com`, `qa.learner+clerk_test@example.com`
- Supabase: matching `profiles` rows, a `company_members` row (instructor in the `zedai` tenant),
  and a draft course **"QA Audit Course"** (never published).
