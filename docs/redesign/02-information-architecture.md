# 02 — Information architecture

## 1. Concepts and who is who

| Concept | Meaning |
|---|---|
| **Platform** | Zed AI Academy itself (apex domain). Marketing site, sign-in, the cross-academy "My academies" hub, superadmin. |
| **Academy** (tenant, `companies` row) | A school on the platform at `/academy/{slug}` or `{slug}.{root}`. Zed's own catalogue is the academy `zedai`. |
| **Learner** | `company_members.role = learner` in an academy. |
| **Teacher** | `teacher` or `instructor` in an academy. Teaches: courses they author, classes, live sessions, submissions. |
| **Academy admin** | `company_admin` in an academy, or the academy owner (`companies.admin_id`). Everything a teacher can do, plus learners, staff, settings, site. |
| **Platform super-admin** | `profiles.role = super_admin`. Only this role sees `/superadmin` and `/admin/*`. |

Role checks live in `src/lib/tenants/access.ts`. A0 adds a cached `getTenantContext(domain)`:

```ts
// src/lib/tenants/context.ts — React cache(), safe to call from layout and page
type TenantContext = {
  company: { id, slug, name, logo_url, primary_color, status, timezone? };
  userId: string | null;
  role: "owner" | "company_admin" | "teacher" | "learner" | null; // owner implies admin
  isAdmin: boolean;      // owner | company_admin
  isTeacher: boolean;    // isAdmin | teacher | instructor
  isMember: boolean;
  isPlatformSuperAdmin: boolean;
};
```

and guards: `requireMember(domain)`, `requireTeacher(domain)`, `requireAdmin(domain)` that redirect
correctly (signed-out → sign-in with `redirect_url`; non-member → academy home; insufficient role →
the user's own landing). Every layout/page under `/academy/[domain]/**` uses these and nothing else.

## 2. Route map (target)

URLs that already exist keep working. **New** = new route. **→** = redirect.

### 2.1 Platform

| URL | Who | Shell | Notes |
|---|---|---|---|
| `/` and marketing pages | everyone | Marketing (legacy, out of scope) | Signed-in users are no longer bounced (findings F6) |
| `/sign-in`, `/sign-up` | guests | Auth (split screen, academy-branded when `redirect_url` targets an academy) | |
| `/after-sign-in` | — | route handler | Landing resolution, §4 |
| `/onboarding` | new users | Focus | Guard restored (F12) |
| `/dashboard` | signed-in | **Hub shell** | "My academies" — rebuilt (04 §2) |
| `/dashboard/schedule` | signed-in | Hub shell | All classes across academies |
| `/dashboard/certificates` **New** | signed-in | Hub shell | All certificates |
| `/dashboard/settings` | signed-in | Hub shell | Profile (Clerk `UserProfile` themed) + notification prefs |
| `/launch-your-academy` | signed-in | Marketing | unchanged |
| `/courses/[slug]/learn` | enrolled / preview | Focus (tenant-branded) | Already rebuilt |
| `/courses/[slug]/checkout` | signed-in | Focus (tenant-branded) | Coupon fix S2 |
| `/certificates/[publicId]` | public | Focus (tenant-branded) | Verification page |
| `/live-sessions/[id]/book`, `/studio` | signed-in | Focus | |
| `/practice`, `/practice/[id]` | signed-in | → `/academy/zedai/practice[/id]` | Platform practice = the `zedai` academy's library. One implementation |
| `/courses`, `/courses/[slug]` | — | → academy routes | unchanged |
| `/superadmin/**`, `/admin/**` | super_admin only | existing (light cleanup only: S3, legacy CSS) | Out of redesign scope otherwise |
| `/creator/**` | teachers | → academy admin (A3) | See §5 |
| `/company` | — | → academy admin | D8 |

### 2.2 Academy — public and student (Agent B)

Base: `/academy/[domain]` (or subdomain root).

| URL | Who | Shell | Replaces |
|---|---|---|---|
| `/` | everyone | Academy public (template) | — |
| `/courses` **New** | everyone | Academy public | dead link F3 |
| `/courses/[slug]` | everyone | Academy public | — |
| `/join` | invited / public | Focus (branded) | S1 fix |
| `/classroom` | members | **Student shell** | Overview tab; also absorbs `/dashboard` |
| `/classroom/learning` **New** | members | Student shell | "My courses" (was academy `/dashboard`) |
| `/classroom/schedule` **New** | members | Student shell | `?tab=timetable` |
| `/classroom/assignments` **New** (+ `/[id]`) | members | Student shell | `?tab=assignments` |
| `/classroom/materials` **New** | members | Student shell | `?tab=materials` ("Documents") |
| `/classroom/notices` **New** | members | Student shell | `?tab=noticeboard` |
| `/classroom/community` **New** | members | Student shell | `?tab=discussions` |
| `/classroom/live` **New** | members | Student shell | `?tab=session` |
| `/classroom/progress` **New** | learners | Student shell | `?tab=progress` |
| `/classroom/certificates` **New** | learners | Student shell | — |
| `/practice`, `/practice/[id]` | members | Student shell / Focus for session | — |
| `/dashboard` | — | → `/classroom/learning` | academy dashboard retired |
| `/classroom?tab=x` | — | → matching sub-route (keep `group`, `scheduleId` params) | |

### 2.3 Academy — staff (Agent A)

Base: `/academy/[domain]/admin`. Shell: **Staff shell**.

| URL | Who | Label in nav | Notes |
|---|---|---|---|
| `/admin` | teacher+ | Overview | Role-aware content (03 §2) |
| `/admin/courses` | teacher+ (teachers see own + co-authored; admins all) | Courses | |
| `/admin/courses/new` | teacher+ | — | |
| `/admin/courses/[id]` (+ `?tab=`) | course managers | — | Course studio (already rebuilt) |
| `/admin/courses/[id]/lessons/[lessonId]` | course managers | — | Lesson editor (already rebuilt) |
| `/admin/learners` **New URL** | admin | Learners | was `/admin/enrollments` (→ redirect) |
| `/admin/learners/[userId]` **New** | admin | — | Learner profile: enrollments, progress, payments, groups |
| `/admin/classes` **New URL** | teacher+ | Classes | was `/admin/classroom` (→ redirect). Groups/cohorts, timetable, notices, materials, assignments, gradebook, attendance history |
| `/admin/submissions` **New** | teacher+ | Submissions | practice + assignment submissions to review |
| `/admin/live` **New URL** | teacher+ | Live sessions | was `/admin/live-sessions` (→ redirect) |
| `/admin/ai-teachers` | teacher+ | AI teachers | Tutor Studio (other session owns internals) |
| `/admin/payments` **New** | admin | Payments | orders, coupons (move coupon management here) |
| `/admin/staff` | admin | Staff | |
| `/admin/settings` | admin | Settings | General (name, logo, colour, timezone, support contacts, join settings) |
| `/admin/settings/site` | admin | — (inside Settings) | Site studio |
| `/admin/settings/live-sessions` | — | → `/admin/live` | |

## 3. Navigation

### 3.1 Staff shell (Agent A)

- **Desktop (lg+)**: left sidebar 248px, collapsible to icons (state in a cookie).
  - Top: Academy switcher (logo + name + role; menu lists the user's academies with role, "View
    public site ↗", "Student view" → `/classroom` if also a member).
  - Groups:
    - *(no label)*: Overview
    - **Teach**: Courses, Classes, Live sessions, Submissions (count badge of items awaiting review), AI teachers
    - **Academy** (admins only): Learners, Payments, Staff, Settings
  - Bottom: Help (docs link), user menu.
- **Top bar** (all sizes): page breadcrumbs (desktop), ⌘K search trigger (courses, learners,
  lessons, settings pages), notifications bell, user menu (mobile: academy logo left).
- **Mobile (< md)**: top bar + **bottom tab bar**: Overview, Courses, Classes, Learners (admins) or
  Submissions (teachers), More (sheet with the rest + academy switcher + public site).
- **md–lg**: sidebar collapsed to icons (no hamburger-only gap).
- Role-aware: items with `roles` not matching the user are not rendered (fixes "Staff shown to
  teachers then redirected").

### 3.2 Student shell (Agent B)

- **Desktop (lg+)**: top bar with academy logo/name (tenant-branded), primary nav inline:
  Home (`/classroom`), My learning, Schedule, Practice, Community; "More" menu: Assignments,
  Documents, Notices, Live room, Progress, Certificates. Right: notifications, user menu (My
  academies ↗ `/dashboard`, Settings, Staff view if teacher, Sign out).
  - Alternative considered: left sidebar like staff. **Rejected** for students — fewer items, and a
    top bar keeps reading pages wide and feels like a school site, not a back office.
- **Mobile**: compact top bar (logo, bell, avatar) + **bottom tab bar**: Home, Learning, Schedule,
  Practice, More (sheet: Assignments, Documents, Notices, Community, Live, Progress, Certificates,
  Browse courses, My academies, Settings).
- Badges: Assignments due (count), unread Notices, live-now dot on Live.
- Group switcher ("All classes" / cohort) lives in the page header of class-scoped pages, not the
  nav.

### 3.3 Academy public header (Agent B)

Logo, Courses, About (anchor), Sign in / Get started (guest), Join academy (signed-in non-member),
"Go to classroom" (member), "Admin" (staff). One mobile menu (sheet). No `MobileBottomNav`.

### 3.4 Hub shell (Agent B)

For `/dashboard/**`: Zed-branded top bar (logo, "My academies", Schedule, Certificates, Settings) and
mobile bottom tabs (Academies, Schedule, Certificates, Settings). No marketing header/footer.

## 4. Landing and tenant resolution (Agent B, in `after-sign-in` + `resolve-home.ts`)

1. `redirect_url` given and safe (same-origin path) → go there (auto-join as learner only for
   `/academy/{slug}` paths of **public** academies; never enrol in courses — S1).
2. Not onboarded → `/onboarding`.
3. Platform super-admin with no memberships → `/superadmin`.
4. Exactly one membership → that academy: admins/teachers → `/academy/{slug}/admin`, learners →
   `/academy/{slug}/classroom`.
5. Several memberships → `last_visited_tenant` cookie if it matches; else `/dashboard`.
6. Company admin with no academy → `/launch-your-academy`. Else → `/dashboard`.

`last_visited_tenant` is set **server-side** by the academy layouts (both shells), not only by the
public home's `TenantTracker` (delete `TenantTracker` once the layouts set it). Value = slug.

Client components never ask "what's my tenant?" — the shell passes the `TenantContext` down.
`getProfileContext` (`actions/profile.ts`) is removed from nav code.

## 5. Creator → academy admin consolidation (Agent A, phase A3)

Today `/creator/*` and `/academy/[domain]/admin/*` are two front-ends over mostly the same
components, with divergent pages (courses list, live sessions, settings) and the creator side
guessing the academy (F9).

Target: **`/academy/[domain]/admin` is the only staff UI.**

- Every `/creator/**` page becomes a redirect:
  `/creator/courses` → `/academy/{slug}/admin/courses`, `/creator/courses/[id]` →
  `/academy/{course.company.slug}/admin/courses/[id]` (look up the course's company — exact, no
  guessing), lessons likewise, `/creator/ai-teachers` → `.../admin/ai-teachers`,
  `/creator/live-sessions` → `.../admin/live`, `/creator/practice-submissions` →
  `.../admin/submissions`, `/creator/settings` → `.../admin/settings`.
- `{slug}` for non-course pages = the academy where the user is staff; if several, the
  `last_visited_tenant` cookie if staff there, else a small picker page `/creator` ("Choose an
  academy to manage").
- Platform instructors with no academy membership but `profiles.role = instructor` (legacy): they
  manage courses in `zedai`. Add them as `instructor` members of `zedai` via a one-off migration
  script (A writes `supabase/migrations/<ts>_backfill_zedai_instructors.sql`, does **not** apply it;
  the user applies it).
- `getCourseListPath/getCourseEditorPath/getLessonEditorPath` always return academy URLs; the
  `tenantSlug?` optional parameter becomes required.
- Delete `app/(creator)/creator/**` page bodies (keep redirect stubs), `CreatorNavbar`, creator
  layout chrome. Keep shared components in `components/creator/**` (they are the editors).

## 6. URL and state rules (both agents)

- Tabs that change *what data is shown* are **routes**. Tabs that are purely visual (e.g. editor vs
  preview on mobile) may be client state.
- Filters, search, sort, pagination, selected group/cohort → **search params**.
- Old `?tab=` URLs keep working through redirects for at least one release.
- All internal links to academy pages are built with helpers in `src/lib/routes.ts` (A0 creates;
  both use): `academyPath(slug, path)`, `adminPath(slug, path)`, `classroomPath(slug, path)`,
  `coursePath(slug, courseSlug)`, `learnPath(courseSlug, lessonId?)`. On a tenant subdomain these
  return paths without the `/academy/{slug}` prefix (read `x-tenant-slug` header server-side; client
  uses a `TenantContext` provider value `basePath`).
