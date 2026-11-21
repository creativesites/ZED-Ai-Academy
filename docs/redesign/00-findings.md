# 00 — Findings: bugs, security, fake data

Found while surveying the tenant admin and student surfaces (Nov 21, 2026). Paths are relative to
`src/`. **P0** = fix before or with the first merge. **P1** = fix in the phase that touches the file.
**P2** = fix if you are in the file anyway.

Owner column: **A** = Agent A (foundations + staff side), **B** = Agent B (learner side).

## P0 — Security and money

| # | Issue | Where | Fix | Owner |
|---|---|---|---|---|
| S1 | **Anyone can enrol free in a paid course.** The join page trusts `?courseId=` and `?cohortId=` from the URL and, with the service role, inserts an `active` enrollment (`source: manual_admin`) for any course in the tenant. It also auto-joins any signed-in visitor on GET. Course IDs are visible in page payloads. | `app/(marketing)/academy/[domain]/join/page.tsx:15-62, 117-166` | Ignore `courseId`/`cohortId` query params entirely. Only honour `invitedCourseId`/`invitedCohortId` from Clerk `publicMetadata` (set server-side by the admin invite action), and only when `invitedCompanyId === company.id`. Clear the metadata after applying. Joining as learner on GET is OK for public academies, but enrolment into a **paid** course must never happen here unless it came from an admin invite. | B |
| S2 | **Coupons are shown but never charged.** The checkout render-prop discards `_finalPrice`/`_couponCode`; `startCheckout` charges `course.price_amount` and never records the coupon. Learners see one price and pay another. | `app/(learner)/courses/[slug]/checkout/page.tsx:60-85, 238`; `components/learner/coupon-input.tsx`; `actions/coupons.ts` | Pass the coupon code (not the price) into the server action. Re-validate the coupon server-side (active, not expired, usage limit, course/tenant match), compute the amount server-side, store `coupon_code` + `discount_amount` on the order, increment usage only when payment is confirmed. A 100% coupon creates an active enrollment without PayChangu. | B |
| S3 | **Instructors can see platform-wide data.** `(admin)/layout.tsx` lets `instructor` in; `admin/students` (all enrollments, service client) and `admin/images` (MediaManager) do not re-check `super_admin`. Also a `console.log` of the profile. | `app/(admin)/layout.tsx:25-27`; `app/(admin)/admin/students/page.tsx`; `app/(admin)/admin/images/page.tsx` | Layout gate becomes `super_admin` only. Remove the `console.log`. Check that MediaManager's server actions also require super_admin. | A |
| S4 | **Clerk org admin is treated as a platform super-admin** for that tenant (`isSuperAdmin` true when the active org is this company and `orgRole === "org:admin"`). Anything gated on `isSuperAdmin` (not just tenant admin) is over-granted. | `lib/tenants/access.ts:48-50` | Split into `isPlatformSuperAdmin` (profiles.role only) and `isTenantOwner` (org:admin or companies.admin_id). Audit every use of `isSuperAdmin` and switch to the right one. Add a unit test in `lib/tenants/*.test.ts`. | A |
| S5 | Admin lesson route does not check the lesson belongs to the course in the URL. | `app/(marketing)/academy/[domain]/admin/courses/[courseId]/lessons/[lessonId]/page.tsx` (and creator twin) | Load the lesson joined to its module and require `module.course_id === courseId`, else `notFound()`. | A |
| S6 | Course metadata and the platform course redirect look up courses **by slug without a tenant filter**; `.single()` will throw once two tenants use the same slug, and metadata can leak another tenant's title. | `app/(marketing)/academy/[domain]/courses/[slug]/page.tsx:41-45`; `app/(marketing)/courses/[slug]/page.tsx`; admin `generateMetadata` in `admin/courses/[courseId]` | Always filter by `company_id` of the resolved tenant. For the platform `/courses/[slug]` redirect, use `.limit(2)` and show a chooser or 404 if ambiguous. | B (student pages), A (admin) |

## P1 — Broken behaviour

| # | Issue | Where | Fix | Owner |
|---|---|---|---|---|
| F1 | **Two or three bottom navs stack on mobile.** Global `MobileBottomNav` (z-5000) renders on `/academy/*/admin` and on the classroom, on top of the admin bar (z-90) and the classroom's own bottom bar (z-40). | `components/layout/MobileBottomNav.tsx:306-317, 343`; `components/tenant/admin/Navbar.tsx:193-228`; `components/classroom/ClassroomTabs.tsx:299-411` | Replaced by the shells in [02-information-architecture.md](02-information-architecture.md): exactly one bottom nav per shell. Until then, hide `MobileBottomNav` on `/academy/*/admin/**` and `/academy/*/classroom/**`. | A (admin), B (student) |
| F2 | **Toasts silently missing** on enrollments, staff and others: no `<Toaster>` mounted; six ad-hoc Toasters elsewhere with different positions. | root `app/layout.tsx`; `course-studio-view.tsx`, `lesson-studio-view.tsx`, `lesson-player-client.tsx`, superadmin layout, two ai-teachers pages | Mount one `<Toaster position="top-center" richColors closeButton />` in the root layout; delete the others. | A (A0). B removes the one in `lesson-player-client.tsx`. |
| F3 | Dead link `/academy/{slug}/courses` (no index route). | `MobileBottomNav.tsx:356`; `components/tenant/TenantNavbar.tsx:26` | Build the catalog route (see 04 §3). | B |
| F4 | Dead `#courses` anchors (no element has that id). | `academy/[domain]/dashboard/page.tsx:147,218`; `lib/templates/home/ModernTemplate.tsx:308`, Minimal:110, Tech:104, Dark:106 | Templates rendered by the new section system give the courses section `id="courses"`; links to "browse" go to `/academy/{slug}/courses`. | B |
| F5 | Platform routes used from tenant subdomains get rewritten to non-existent paths: `/courses/{slug}/learn` and `/courses/{slug}/checkout` become `/academy/{sub}/courses/{slug}/learn`. | `proxy.ts:192-208` | In the proxy, do not rewrite `/courses/*/learn`, `/courses/*/checkout`, `/live-sessions/**`, `/certificates/**`, `/dashboard/**`, `/practice/**` on a tenant subdomain; redirect them to the apex with the same path (or serve them directly — pick one and document it in HANDOFF). | B |
| F6 | Signed-in users clicking any `/` "Home" link are bounced to `/after-sign-in`. | `proxy.ts:80-88` | Only redirect from `/sign-in` and `/sign-up`. Let signed-in users view `/`; the marketing header shows "Go to my academy" instead. | B |
| F7 | Tenant admin **Live sessions** shows only the current user's services/bookings, not the academy's. | `academy/[domain]/admin/live-sessions/page.tsx` | Admins see all academy instructors' services and bookings with an instructor filter; teachers see their own. | A |
| F8 | `company_admin` is bounced from **Practice submissions** (role check allows only instructor/super_admin). No tenant-admin equivalent page exists. | `app/(creator)/creator/practice-submissions/page.tsx` | New `/academy/[domain]/admin/submissions` (see 03 §8), tenant-scoped, allowed for company_admin/teacher/instructor. | A |
| F9 | Creator context picks the **first** academy membership by `joined_at` — wrong for users in several academies. | `actions/tutor-authoring.ts:61-90` (`resolveCreatorCompanyContext`) | Resolved by A3 (creator routes redirect to a specific academy). Until then, prefer the `last_visited_tenant` cookie. | A |
| F10 | Classroom: `?scheduleId=` never read; active tab not in URL; `initialTab={tab as any}` unvalidated (`?tab=students` gives a learner an empty panel); load errors only `console.error`. | `components/classroom/ClassroomTabs.tsx:133`; `academy/[domain]/classroom/page.tsx:68`; links in `TimetableTab.tsx:426,515`, `schedule-client.tsx:201,344`, `(learner)/dashboard/page.tsx:192` | Classroom becomes route-based (04 §5). `scheduleId` opens the schedule detail sheet. | B |
| F11 | Practice session page has no way out (`onExit` not passed) and sits between legacy header/footer. | `(learner)/practice/[scenarioId]/page.tsx`; `academy/[domain]/practice/[scenarioId]/page.tsx` | Full-screen focus layout with an exit button back to the practice library. Do not edit `components/tutor/**`; pass `onExit` from the page. | B |
| F12 | Onboarding "already onboarded" guard is commented out; `?action=enroll` redirect target is ignored by the course page. | `app/onboarding/layout.tsx:7-11`; `onboarding/_actions.ts:153-236` | Restore the guard (redirect onboarded users to `/after-sign-in`). Course page honours `?action=enroll` by scrolling to and focusing the enrol CTA (free course: enrol immediately after confirm). | B |
| F13 | Overview "Start live class" passes `?action=start` that the classroom never reads; "Upcoming" lists the first 4 schedules, not future ones; "Active students" counts members but links to enrollments. | `academy/[domain]/admin/page.tsx:76, 124, 198` | Rebuilt in 03 §2. | A |
| F14 | Week-day conventions differ (Mon-first 1..7 vs Sun-first). Timezone hard-coded `Africa/Lusaka` in several forms. | `lib/tenants/admin-helpers.ts:43`; both live-sessions pages; `live-sessions/[id]/book/page.tsx:38` | One helper `lib/time/weekdays.ts` (ISO Mon=1). Timezone comes from `companies.timezone` if present, else the browser, default `Africa/Lusaka`. | A (helper, admin), B (student) |
| F15 | Calendar export (`.ics` / Google link) is reimplemented three times though `lib/calendar/calendar-export.ts` exists. | `schedule-client.tsx:57,91`; `TimetableTab.tsx:43,75`; `meeting-block.tsx:35` | Use `lib/calendar/calendar-export.ts` everywhere. | B |
| F16 | Two different access checks per page (layout + page both fetch the company and access). | classroom layout/page, admin layout/pages | One cached loader `getTenantContext(domain)` using React `cache()` (A0), used by layouts and pages. | A builds, both use |
| F17 | Sign-in logo uses a relative path `images/logo-dark.png` (breaks on nested URLs); tenant `logoUrl` fetched but unused. | `app/(auth)/sign-in/[[...sign-in]]/page.tsx:10,76` | Absolute `/images/...`; show the tenant logo when `redirect_url` targets an academy. | B |
| F19 | **A full-screen branded splash (root `loading.tsx`) replaces the whole page on every navigation**, even between two admin pages, so the app feels slow and loses context. Also a staff URL a learner can't access silently redirects to the classroom with no message. | `app/loading.tsx`; `requireTenantAdminPage` redirects | Root `loading.tsx` becomes a minimal top-progress (or is deleted); each shell renders its own `loading.tsx` skeleton **inside** the shell so nav stays put. Access redirects carry `?denied=admin` and the target shows a one-line toast/banner "You don't have staff access to this academy". | A (root + staff), B (student) |
| F18 | Native `confirm()` for destructive actions. | `StaffManagementClient`, curriculum builder, others | `ConfirmDialog` (AlertDialog) from A0. | Whoever owns the file |

## P1 — Fake or hard-coded data (remove all)

| # | What | Where | Replace with | Owner |
|---|---|---|---|---|
| D1 | Rating `"4.9/5"`, `"95%"`, `"10k+"` fallbacks | `academy/[domain]/page.tsx:95`; `ModernTemplate.tsx:175`; `admin/settings/site/page.tsx:75-78` | Real numbers only. If a stat is missing or too small to be flattering (e.g. < 10 learners) hide the stat tile. Ratings appear only when reviews exist (`course-reviews`). | B (public), A (site studio) |
| D2 | `SAMPLE_COURSES`, `previewStats 120+/4.9/96%` in the site preview | `components/creator/branding/live-preview-pane.tsx:135-141` | Preview uses the academy's real courses; if none, show skeleton course cards labelled "Your courses will appear here". | A |
| D3 | Certificates stat always `0` | `academy/[domain]/dashboard/page.tsx:127` | Route retired (04 §4); certificates count comes from `certificates` table. | B |
| D4 | Hard-coded WhatsApp number `260979046745` | `academy/[domain]/dashboard/page.tsx:186` | `companies.support_whatsapp` / support email from settings (A adds the setting fields; see 03 §10). Hide if empty. | B (+A for setting) |
| D5 | `Footer1` with personal email/phone shown on the student dashboard and admin pages | `(learner)/layout.tsx`, `(admin)/layout.tsx`, `(company)/layout.tsx` | App shells have no marketing footer. | A/B |
| D6 | Fake search pill that does nothing | `components/tenant/TenantNavbar.tsx:76-79` | Real course search on the catalog page, or remove. | B |
| D7 | Static claims "AI tutor on every lesson", "Verified certificate", checkout "What you get" | `academy/[domain]/courses/[slug]/page.tsx:338-345`; checkout `:206-212` | Derive from the course (has quiz, has tutor blocks, certificate enabled, lesson count, video minutes). | B |
| D8 | `(company)/company` placeholder page with dead "Request early access" buttons | `app/(company)/company/page.tsx` | Redirect `/company` to the user's academy admin (B2B lives inside the academy). Delete the page. | A |

## P2 — Dead code to delete (in the phase that touches the area)

- `components/learner/certificate-card.tsx`, `course-reviews.tsx` (unless used for D1 ratings), `manual-enroll-modal.tsx`, `onboarding-form.tsx` — unused. (B)
- `components/layout/header/Header1/3`, `footer/Footer2/3`, `Sidebar`, `SearchPopup`, `Breadcrumb`, `layout/Layout.js` chain — only reachable from legacy marketing pages; leave until the marketing site is rebuilt (out of scope), but stop importing any of them into app layouts. (A/B)
- `src/assets/css/**`, `src/styles/template-styles.css` — not imported anywhere. Delete. (A)
- `src/middleware-test.ts` — stray. Delete. (B, owns proxy)
- `components/slider/New folder/**`, `components/elements/*.js` (template widgets) — check usages; delete unused. (A)
- `app/(admin)/admin/page.tsx` redirect loop with `contacts` "Back to Dashboard" → point to `/superadmin`. (A)
- Unused imports: `academy/[domain]/page.tsx:5-8`, `live-sessions/[id]/book/page.tsx:7-8`, `classroom/layout.tsx:4,7`, `creator/settings/page.tsx` (`CardHeader`, `CardTitle`, `Palette`). (owner of file)
- SWR provider with zero `useSWR` calls — keep for now (cheap), do not add new client fetching through it unless needed.

## Already fixed (do not redo)

The course flow audit (commit `810934f`, see `docs/COURSES_AUDIT.md`) already fixed: certificate
self-enrolment, quiz authoring authz, block/lesson IDOR, learn-page content leak, quiz answer key
leak, quiz attempt limits, publish validation, studio/editor/player rebuild.
