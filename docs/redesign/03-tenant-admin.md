# 03 — Academy admin (staff side) — screen specs

Owner: **Agent A**. Shell, nav and roles: [02 §3.1](02-information-architecture.md). Components and
patterns: [01](01-design-system.md). Every screen below gets `loading.tsx` (skeleton inside the
shell) and uses `PageHeader`.

Notation: **Data** = what to load (server component unless noted). **States** = empty/error copy.

---

## 1. Staff shell — `(academy)/academy/[domain]/admin/layout.tsx`

- Replaces `components/tenant/admin/Navbar.tsx` (delete after) and the inline auth in the current
  layout (use `requireTeacher(domain)` from A0).
- Wrap in `<BrandProvider color={company.primary_color}>` so `--primary` is the academy colour.
- Sets the `last_visited_tenant` cookie (server action / route handler call, or `cookies().set` in a
  server action triggered once — Next 16: setting cookies in a layout render is not allowed; use a
  tiny client component that calls a server action on mount, or set it in `proxy.ts` for
  `/academy/{slug}/**` paths — **prefer the proxy**, coordinate with B in HANDOFF since B owns
  `proxy.ts`).
- Suspended academy: full-page notice for staff with "Contact support" (super-admin sees banner only).
- Hide `MobileBottomNav` here (until B deletes it).
- Toasts: global (A0). Remove ad-hoc `<Toaster/>`s in `course-studio-view.tsx`, `lesson-studio-view.tsx`, ai-teachers pages.

## 2. Overview — `/admin`

Purpose: "What needs me today?" — not vanity numbers.

**Layout (desktop)**: `PageHeader` "Good morning, {firstName}" + academy name as description;
actions: `Create course` (primary), `Invite learners` (secondary).
Below: two-column grid (`lg:grid-cols-3`): main column (span 2) + side column.

**Admin view**
1. **Setup checklist** (only until complete or dismissed; stored in `companies.settings.onboarding_dismissed` or localStorage if no column):
   Add logo & colour → Create first course → Publish it → Invite learners or share join link →
   Customise public site. Each row links to the place; progress ring. Copy join link button inline.
2. **StatGrid** (4): Active learners (members with any progress/login in last 30 days; fallback =
   learner members, labelled honestly), New enrollments (7 days, delta vs previous 7), Revenue (30
   days, paid orders, ZMW; hidden if the academy has no paid courses), Course completions (30 days).
   Each tile links to the filtered list.
3. **Needs attention** list (main column): pending-payment enrollments (count → Learners filtered
   `status=pending_payment`), submissions awaiting review (→ Submissions), draft courses / courses
   with empty lessons (→ course studio), pending staff invites (→ Staff), live booking requests.
   Empty → "You're all caught up" with a calm illustration-free check icon.
4. **Today** (side column): classes scheduled today (time, group, "Start" → class live room),
   live 1:1 bookings today. Empty → "Nothing scheduled today · Add a class".
5. **This week's schedule** (side, compact list of the next 5 **future** schedules — fixes F13).
6. **Recent activity** (main): last 8 events — enrollments, completions, certificates, submissions —
   each with user, course, relative time.

**Teacher view** (non-admin): Today, Submissions to review (theirs), My courses (title, learners,
avg progress, "Open"), Recent activity in their courses. No revenue, no checklist.

Data: write `src/lib/admin/overview.ts` with one function per block, run in `Promise.all`. Use
counts (`{ count: "exact", head: true }`), never load full tables. Replace the old
`TimetableCalendar` 7-column grid on the overview (keep the component for Classes > Schedule).

Mobile: checklist collapses to a single "Setup 2/5" card; StatGrid 2×2; Today before Needs attention.

## 3. Courses — `/admin/courses`

Replace both current lists (admin card grid and creator list) with one.

- `PageHeader` "Courses" + `Create course` primary.
- `FilterBar`: search title, status (All / Published / Draft / Archived), pricing (Free / Paid),
  author (admins only), sort (Updated, Title, Learners).
- **View toggle**: Cards (default, 1/2/3 cols) and Table. Card: 16:9 cover (placeholder initials),
  status badge, title, "N lessons · M learners", completion bar (avg progress), price, ⋯ menu
  (Open studio, Preview as learner, Duplicate, Copy link, Archive). Table columns: Course, Status,
  Learners, Lessons, Price, Updated, ⋯.
- Data: one query for courses (+ author profile only when needed), counts via grouped selects or an
  RPC `course_stats(company_id)` (write the SQL migration; do not apply — note in HANDOFF).
- Empty (no courses): EmptyState "Create your first course" + secondary "Draft with AI".
- Teachers see courses they author or co-author; admins see all.

## 4. Course studio + lesson editor — `/admin/courses/[id]`, `/lessons/[lessonId]`

Already rebuilt (`docs/COURSES_AUDIT.md`). In this redesign:
- Render inside the staff shell (remove the studio's own page chrome that duplicates the shell
  top bar; keep the course header).
- Migrate colours to tokens (codemod) so tenant colour applies.
- Fix S5 (lesson must belong to course).
- Replace remaining `confirm()` with `ConfirmDialog`.
- Coupons: if coupon management lives in the studio today, keep a link from the studio's Launch tab
  to `/admin/payments?tab=coupons&course={id}`.

## 5. Learners — `/admin/learners` (was `/admin/enrollments`)

The academy's people who learn. Today's page mixes members and enrollments; split clearly.

- `PageHeader` "Learners" + `Invite learners` (primary) + ⋯ (Import CSV, Export CSV, Copy join link).
- Tabs as routes: **People** (`/admin/learners`) and **Enrollments** (`/admin/learners/enrollments`).
- **People**: `DataTable` of learner members — name/email (`UserCell`), groups, courses enrolled
  (count), avg progress, last active, status (active/invited/deactivated). Row → learner profile.
  Bulk actions: add to group, enrol in course, deactivate. Filters: search, group, course, status.
  Server-side pagination (25/page), search via `ilike` on name/email.
- **Enrollments**: rows of (learner, course, status, source, progress, enrolled date). Filters:
  course, status (`active`, `pending_payment`, `cancelled`, `completed`), source. Row actions:
  Approve payment (pending → active, records manual payment note), Cancel, Resend receipt.
  Counts in filter chips come from the server.
- **Invite** (`ResponsiveDialog`, rebuilt from `StudentInviteModal` 578 lines): emails (paste many,
  validated, chips), optional course(s) to enrol, optional group; preview "3 new, 1 already a
  learner"; send. Also shows the public join link with copy. CSV import as its own step (reuse
  `lib/tenants/student-csv.ts` + its tests).
- **Learner profile** `/admin/learners/[userId]`: header (avatar, name, email, joined, last active,
  status, actions: message (mailto), add to group, enrol, deactivate); sections: Courses (progress
  per course, last lesson, certificate), Groups, Payments (orders), Activity (recent progress,
  submissions). Must check the user is a member of this academy.

## 6. Classes — `/admin/classes` (was `/admin/classroom`)

The teaching hub: groups/cohorts, timetable, notices, materials, assignments, gradebook, history.

Routes (sub-nav as horizontal tabs on desktop, select on mobile):
`/admin/classes` (Groups) · `/schedule` · `/assignments` · `/materials` · `/notices` · `/gradebook` · `/attendance`.

- Group switcher in the page header ("All groups" / a group), stored in `?group=`.
- **Groups**: cards per group — name, linked courses, learner count, next class, "Open". Create/
  edit group dialog (name, courses, learners picker with search).
- **Schedule**: week view on desktop (reuse/restyle `TimetableCalendar`), agenda list on mobile.
  Create class (title, group, course, start/end, recurrence weekly, location/online link → live
  room), uses `lib/time/weekdays.ts` (ISO) and academy timezone.
- **Assignments**: list with due date, group, submitted/total, "Review". Create/edit assignment
  (title, instructions rich text, attachments, due date, points, group). Review screen: submission
  list + grader panel (score, feedback) — side-by-side desktop, stacked mobile.
- **Materials**: folder/list view, upload (drag-drop desktop, file picker mobile), visibility per
  group, AI study packs entry point.
- **Notices**: compose (title, body, group, pin), list with read counts.
- **Gradebook**: learners × assignments table with sticky first column; on mobile pick an
  assignment then see a list.
- **Attendance** (was History): past live classes with attendance counts.

Ownership: these screens render the **staff views** of the classroom feature. B splits each
`components/classroom/*Tab.tsx` into `components/classroom/<feature>/staff/*` and
`.../student/*` (+ shared `hooks`/`types`) in phase B1 **without restyling**. A then owns and
restyles everything under `components/classroom/**/staff/**`. See AGENT-A/B ownership tables.

## 7. Submissions — `/admin/submissions` **New**

Single review queue for practice-exercise submissions and assignment submissions.

- Tabs as routes: To review (default) · Reviewed · All.
- `DataTable`: learner, item (exercise/assignment + course/group), submitted (relative), status,
  score. Filters: course, group, type.
- Row opens `/admin/submissions/[id]`: submission content (text, files via signed URLs, code), rubric
  /score, feedback editor, "Return to learner" / "Mark reviewed", prev/next in queue.
- Port logic from `app/(creator)/creator/practice-submissions/page.tsx` (tenant-scope it: courses
  where `company_id = academy`; teachers limited to their courses). Remove the zero-UUID hack (skip
  the query when the id list is empty). Paginate.

## 8. Live sessions — `/admin/live` (was `/admin/live-sessions`)

- Tabs: Bookings (default) · Services · Availability.
- **Bookings**: upcoming/past list grouped by day; status badges; join/start button; cancel/
  reschedule. Admins see all instructors (filter), teachers see own (fixes F7).
- **Services**: cards (title, duration, price, linked course, instructor), create/edit dialog using
  ui primitives (no raw `<select>`).
- **Availability**: weekly rules editor (ISO weekdays, time ranges per day, timezone from academy
  with override), date overrides list.
- Merge the duplicated logic of `CR/live-sessions` and `TA/live-sessions` into
  `src/lib/live-sessions/admin.ts` + components in `components/admin/live/**`.

## 9. AI teachers — `/admin/ai-teachers`

Wrap `TutorStudioHub` in the shell with `PageHeader` "AI teachers". Show load errors with
`ErrorState` instead of swallowing them (`.catch(() => [])` → surface). **Do not edit
`components/tutor/**`** (another session owns it); only the page file.

## 10. Payments — `/admin/payments` **New** (admins)

- Tabs: Orders · Coupons.
- **Orders**: table (date, learner, course, amount, coupon, status, reference). Filters: status,
  course, date range. Totals for the filtered range. Manual "Mark paid" for offline payments (writes
  order + activates enrollment, logs who did it).
- **Coupons**: list (code, discount, course or all, uses/limit, expiry, active), create/edit dialog,
  deactivate. Uses `actions/coupons.ts` (coordinate with B, who changes the checkout side — S2).
- Hide the nav item for academies with no paid courses and no orders? **No** — always show for
  admins; empty state explains how to set a course price.

## 11. Staff — `/admin/staff` (admins)

- `DataTable`: member (`UserCell`), role (select inline for admins: Admin / Teacher), status, joined,
  ⋯ (change role, resend invite, remove). Owner row is locked with an "Owner" badge.
- `Invite staff` dialog: email(s) + role. Teacher join code card with copy + regenerate (with
  confirm).
- Replace `confirm()` with `ConfirmDialog`; toasts now visible (global Toaster).

## 12. Settings — `/admin/settings` + `/admin/settings/site`

Settings sub-nav (left column on desktop, list page on mobile):
- **General** `/admin/settings`: academy name, logo upload, brand colour (picker + contrast preview
  + "Text on buttons will be white/dark"), timezone (select, default Africa/Lusaka), support email,
  support WhatsApp (feeds D4), public join on/off, join code for learners.
  (Add columns via migration file if missing: `timezone`, `support_email`, `support_whatsapp`,
  `public_join_enabled` — write SQL, do not apply, note in HANDOFF.)
- **Site** `/admin/settings/site`: the Site Studio (`components/creator/settings/SiteStudio.tsx`,
  `SectionManager`, `live-preview-pane`). Redesign the frame only:
  - Desktop: editor panel 400px left, preview right filling the rest (no magic `calc(100dvh-124px)`;
    use the shell's main height with `h-full` flex). Preview device toggle (Mobile/Tablet/Desktop)
    scales the iframe-like frame to fit instead of fixed `w-[1200px]`.
  - Mobile: Edit / Preview segmented control.
  - Remove fake stats and `SAMPLE_COURSES` (D1, D2).
  - Template picker shows the templates B ships in B3 (coordinate list in HANDOFF).
- **Live sessions** settings → redirect to `/admin/live?tab=availability`.
- Danger zone (owner only): transfer ownership, suspend/delete academy (type-to-confirm). Can be a
  stub that emails support if no backend exists — say so in the UI.

## 13. Notifications and search

- Bell in top bar reuses the existing notifications action; panel as `Popover` (desktop) / `Sheet`
  (mobile); "Mark all read".
- ⌘K command palette (`command` primitive): Go to pages, search courses (title), learners
  (name/email, admins), lessons. Server action `searchAcademy(domain, q)` limited to 5 per type.
  Nice-to-have; do it last in A2.

## 14. Superadmin / platform admin (light touch only)

Out of scope for redesign. Required: S3, remove legacy layout chrome (`Header2Wrapper`, `Footer1`,
`page-wrapper`) from `(admin)` layout and give it a simple `AppShell` with the existing
`SuperAdminNav` items. Fix the `/admin` → `/superadmin` "Back" loop.
