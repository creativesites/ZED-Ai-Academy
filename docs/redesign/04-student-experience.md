# 04 — Student experience — screen specs

Owner: **Agent B**. Shells and nav: [02 §3.2–3.4](02-information-architecture.md). Components and
patterns: [01](01-design-system.md). Every data screen gets `loading.tsx` inside its shell.

The learner's question on every screen is **"what should I do next?"** — answer it at the top.

---

## 1. Student shell — `(academy)/academy/[domain]/classroom/layout.tsx` (+ practice)

- Uses `requireMember(domain)` (A0). Non-members → academy home with a "Join this academy" banner.
- `<BrandProvider>` with the academy colour; logo + name in the top bar.
- Nav per [02 §3.2](02-information-architecture.md). Exactly one bottom tab bar (delete the
  classroom's own sticky pill rail, desktop sidebar and fixed bottom bar from `ClassroomTabs`).
- Group switcher in page headers of Schedule/Assignments/Materials/Notices/Community (`?group=`).
- Badges: assignments due within 7 days, unread notices, live-now dot.
- Practice pages (`/academy/[domain]/practice`) also use this shell; the practice **session** uses
  `FocusShell` with an Exit button (F11).

## 2. My academies hub — `/dashboard` (Hub shell)

Replaces the current picker (`app/(learner)/dashboard/page.tsx`, emoji heading, `rounded-[4rem]`).

- Heading "Your academies" (no emoji). If the user has **one** academy, show a single big card with
  "Continue" and a note "You'll go straight there next time" (after-sign-in already does).
- Card per academy: logo (or initials on its brand colour), name, your role badge, "N courses in
  progress", next class (if any), primary button "Open classroom" (learners) / "Open admin" (staff),
  secondary "Open classroom" for staff who are also learners.
- **Live now / next up** strip at top if any class across academies starts within 2 hours.
- Empty (no academies): "You're not in any academy yet" + Browse Zed AI courses (→ `/academy/zedai`)
  + "Have an invite link? Paste it" input + "Launch your own academy".
- Remove `TutorSpotlightBanner` from here unless the other session wants it; if kept, place below
  academies (coordinate in HANDOFF).
- **Schedule** `/dashboard/schedule`: agenda grouped by day across academies (academy chip per row),
  add to calendar (shared `lib/calendar/calendar-export.ts`), join button when live.
- **Certificates** `/dashboard/certificates` **New**: grid of certificate cards (course, academy,
  date, View → `/certificates/[publicId]`, Copy link, Share to LinkedIn URL).
- **Settings** `/dashboard/settings`: Clerk `<UserProfile>` themed with `appearance` variables
  matching tokens, plus "Email me about: class reminders / new notices / course updates" toggles if
  a prefs table exists (else omit — do not fake).

## 3. Academy public site (B3) — `/academy/[domain]`, `/courses`, `/courses/[slug]`

### 3.1 Public header + footer
Per [02 §3.3](02-information-architecture.md). Footer: academy name, support email/WhatsApp from
settings (D4), "Powered by Zed AI Academy". No platform marketing links, no personal details.

### 3.2 Home — templates rebuilt on one section system
Today: 8 templates in `lib/templates/home/*` with legacy classes, fake stats, and dead `#courses`.

Target: **one section library + theme presets**.
- `src/components/academy-site/sections/`: `Hero`, `CourseGrid` (id="courses"), `Stats` (real
  numbers only; hides tiles under thresholds), `Features` (from site content), `Instructors`,
  `Testimonials` (only if content provided), `FAQ`, `CTA`, `Contact`.
- Presets (`src/lib/templates/presets.ts`): `modern`, `classic`, `minimal`, `bold`, `corporate`
  — each = section order + variant per section (e.g. Hero `split` | `centered` | `image-bg`) +
  heading font weight + radius feel. Map existing `home_template` values: modern→modern,
  classic→classic, minimal→minimal, elegant→classic, creative→bold, dark→bold (dark variant),
  tech→modern, corporate→corporate. Keep `TemplateRenderer`'s signature so Site Studio (A) keeps
  working; announce the preset list in HANDOFF.
- Content comes from existing site content (`home-content.ts` / `SharedSections` data from the Site
  Studio). If a section has no content it is omitted, never filled with lorem/sample.
- All colours via tokens (tenant `--primary`). Remove the legacy CSS import from this page (end of
  the A0 bridge).

### 3.3 Course catalog — `/academy/[domain]/courses` **New**
- Search (real, server-side `?q=`), filters: category, level, price (Free/Paid). Sort: Popular, Newest.
- Course cards (shared `components/academy-site/CourseCard.tsx`): cover, title, short description,
  lessons count, level, price ("Free" / "K 450"), progress if enrolled ("Continue — 40%").
- Empty: "No courses match" + clear filters; academy with zero published: "Courses are coming soon".

### 3.4 Course detail — `/academy/[domain]/courses/[slug]`
- Hero: title, one-line promise, instructor, level, lessons, duration estimate (from video blocks
  when available, else omit), price. Primary CTA by state: Enrol free / Buy · K 450 / Continue
  learning (progress) / Payment pending (with "Complete payment" and help text) / Preview a free
  lesson (if previews exist).
- Sticky CTA bar on mobile.
- "What's included": derived (D7) — N lessons, N quizzes, AI teacher moments if tutor blocks exist,
  certificate on completion (if enabled).
- Curriculum accordion with free-preview lessons clickable.
- Instructor card. Reviews only when reviews exist.
- Honour `?action=enroll` (F12). Tenant-filtered queries (S6).

## 4. Classroom home — `/academy/[domain]/classroom`

Replaces Overview tab + academy `/dashboard` (→ redirect to `/classroom/learning`).

Order (mobile-first):
1. Greeting line "Hi {firstName}" + group switcher (if in groups).
2. **Up next** card (the single most important thing): live class starting < 30 min ("Join now"),
   else continue lesson (course, lesson title, progress, "Continue"), else assignment due soonest,
   else "Browse courses".
3. **Continue learning** — horizontal scroll of in-progress courses (cover, title, % bar).
4. **Due soon** — assignments due within 7 days (title, course/group, due relative, status).
5. **Today & next** — next 3 scheduled classes (time, title, join/add to calendar).
6. **Notices** — latest 2 unread (title, snippet) → Notices.
7. **Practice with AI** — one card to the practice library (keep it modest).

Desktop: two columns (main: Up next, Continue, Due soon; side: Today & next, Notices, Practice).
Remove "Your Classroom Hub" banner, `text-[10px] uppercase` kickers, "Classroom Lounge" filler.

Data: server-side in `src/lib/classroom/home.ts` (`Promise.all`), not the giant client `useEffect`.

## 5. Classroom sections (route-based)

Each is a server page that loads its own data and renders the **student view** component. Old
`?tab=` URLs redirect (02 §2.2). `scheduleId` opens a detail sheet (F10).

| Route | Student view spec |
|---|---|
| `/classroom/learning` | My courses: tabs In progress / Completed / All. Card per course with progress and Continue. Completed shows certificate link. Empty → Browse courses. |
| `/classroom/schedule` | Agenda list by day (mobile), week grid toggle (desktop). Row: time, title, group, course, location/online; actions Join (when within window), Add to calendar. Detail sheet on tap. |
| `/classroom/assignments` (+ `/[id]`) | Filters: Due / Submitted / Graded. Card: title, course/group, due (red if overdue), points, status. Detail: instructions, attachments, submit (text + files, autosave draft), submission history, grade + feedback. |
| `/classroom/materials` | Folder/list, search, file type icons, preview (PDF/image inline, others download), "AI study pack" button per material (existing feature). |
| `/classroom/notices` | List, unread dot, pinned first; detail inline expand. Mark read on open. |
| `/classroom/community` | Discussions: thread list (title, author, replies, last activity), new thread, thread view with replies. Group filter. |
| `/classroom/live` | Current/next live class with join button, device test, recordings list if available. |
| `/classroom/progress` | Per course: progress bar, lessons done/total, quiz scores, time spent if tracked; streak only if real. |
| `/classroom/certificates` | This academy's certificates (same card as hub). |

Refactor plan for `components/classroom/` (B1, mechanical, before restyle):
- Per feature folder: `materials/`, `assignments/`, `timetable/`, `notices/`, `discussions/`,
  `live/`, `progress/`, `gradebook/` (staff), `groups/` (staff), `history/` (staff), `students/` (staff).
- Inside each: `student/…`, `staff/…`, `shared/` (types, hooks, small pieces), and data loaders.
- Split instructor branches out of the giant files (`MaterialsTab` 1,993 lines, `AssignmentsTab`
  1,483, `OverviewTab` 930…) into `staff/` files without changing behaviour or styles. Commit this
  split alone ("refactor: split classroom into student/staff views") so A can start restyling staff
  files from that commit.
- `ClassroomTabs.tsx` is deleted at the end of B2 (the shell + routes replace it). The admin Classes
  pages (A) import `staff/` components directly.

## 6. Practice — `/academy/[domain]/practice` (+ `/[scenarioId]`)

- Library page in student shell: `PageHeader` "Practice with AI", filters from the existing
  `PracticeLibrary` (do not restyle `components/tutor/**` internals — wrap only; request visual
  changes from the tutor session via the user).
- Session page in `FocusShell` with Exit (→ library) and the scenario title.
- `/practice` (platform) redirects to `/academy/zedai/practice` (02 §2.1). Delete the duplicate page.

## 7. Focus pages (tenant-branded)

- **Lesson player** `/courses/[slug]/learn`: already rebuilt. B: wrap in `BrandProvider` with the
  course's academy colour, migrate hex → tokens, remove its own `<Toaster/>`, add "Back to
  classroom" (→ `/academy/{slug}/classroom/learning`) in the outline header.
- **Checkout** `/courses/[slug]/checkout`: `FocusShell` (Back to course). Layout: order summary card
  (cover, title, academy, price, coupon field, discount line, total) + payment method explanation
  (MTN MoMo, Airtel Money, card via PayChangu) + Pay button with loading. States: already enrolled
  (→ Continue), pending order (resume / cancel), 100% coupon (enrol now). Fix S2. No marketing
  "What you get" filler (D7).
- **Payment return**: if a return/callback page exists, show success → "Start learning", failure →
  retry. If none exists, add `/courses/[slug]/checkout/return` that polls order status (3× / 2s)
  and links onward.
- **Certificate** `/certificates/[publicId]`: branded verification page (certificate render, learner,
  course, academy, date, ID, Verified badge, Copy link, Download as image/print-friendly PDF via
  `window.print()` stylesheet).
- **Live booking/studio** `/live-sessions/[id]/book|studio`: `FocusShell`; slot picker as day tabs +
  time chips; remove legacy `.container`; timezone from academy (F14).
- **Join** `/academy/[domain]/join`: branded card "Join {academy}" with logo, short description,
  role (learner/teacher-with-code), CTA. Fix S1. Already-member → straight redirect.

## 8. Auth and onboarding

- **Sign-in/up** (`(auth)`): split layout, left brand panel (academy logo/colour when `redirect_url`
  targets an academy, else Zed), right Clerk component themed via `appearance` to tokens. Fix F17.
  Remove legacy CSS import.
- **Onboarding** (`/onboarding`): `FocusShell`, 2 steps max (name/role → goal/interests), progress
  dots, no duplicate titles. Restore guard (F12).

## 9. Global mobile nav

- Delete `components/layout/MobileBottomNav.tsx` once all three shells (student, staff, hub) are
  live; until then hide it on `/academy/*/admin/**`, `/academy/*/classroom/**`, `/dashboard/**`.
- Marketing pages keep their own header menu (out of scope).
