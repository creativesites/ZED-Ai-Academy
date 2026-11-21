# Agent B — Learner side

You are one of two agents implementing the Zed AI Academy redesign. **You own everything a learner
sees: sign-in/landing, the "My academies" hub, the student classroom, practice, the public academy
site and templates, course pages, checkout, join, certificates and focus pages — plus the security
and routing fixes in those areas.** Agent A builds the design system and shells, and the staff side.
You coordinate only through [HANDOFF.md](HANDOFF.md).

## Read first (in this order)

1. `CLAUDE.md` and `AGENTS.md` at the repo root. **This is Next.js 16** — `src/proxy.ts`, not
   middleware; check `node_modules/next/dist/docs/` before using an API you're unsure of.
2. [README.md](README.md) — principles and the work order.
3. [00-findings.md](00-findings.md) — rows marked **B** are yours.
4. [01-design-system.md](01-design-system.md) — you consume it (A builds it). Don't edit
   `globals.css` or `src/components/ui|app|shell/**` (except `shell/student/**`, `shell/hub/**`).
5. [02-information-architecture.md](02-information-architecture.md) — §1, §2.1–2.2, §3.2–3.4, §4, §6.
6. [04-student-experience.md](04-student-experience.md) — your screen specs.
7. `docs/COURSES_AUDIT.md` — the lesson player/course page were just rebuilt (don't redo them).

## Ground rules

- **Stay inside your ownership list.** Need a new primitive or a change to a shared component?
  Write a request in [HANDOFF.md](HANDOFF.md). If it blocks you, build it locally in your own folder
  (e.g. `src/components/learner/`) and note it so A can promote it later.
- `src/components/tutor/**`, `src/lib/tutor/**`, `design/rive/**` belong to another workstream:
  **read-only**. Wrap, don't edit.
- No raw hex colours in className in files you touch; use tokens (tenant `--primary`). No arbitrary
  radii. **No fake data** — hide what you can't back with real numbers.
- Every server action re-checks auth, tenant membership and enrollment on the server. Never trust
  course/cohort/price values from the URL or client.
- Database changes: write a migration in `supabase/migrations/<timestamp>_<name>.sql`, **do not
  apply it**, list it under "Migrations to apply" in HANDOFF.md; code must degrade gracefully until
  applied.
- Keep `main` deployable: `main` auto-deploys to Vercel.

## Ownership

| You own (edit freely) | Notes |
|---|---|
| `src/proxy.ts`, `src/middleware-test.ts` (delete), `src/app/after-sign-in/**`, `src/lib/tenants/resolve-home.ts` | Landing + tenant routing |
| `src/app/onboarding/**`, `src/app/(auth)/**` | |
| `src/app/(academy)/academy/[domain]/**` **except** `admin/**` | Only after A posts "A0.1 merged" in HANDOFF |
| `src/app/(learner)/**`, `src/app/(learning)/**` | hub, practice, checkout, live booking/studio, player |
| `src/app/(marketing)/courses/**`, `src/app/(marketing)/certificates/**` | redirects + verification page |
| `src/components/learner/**`, `src/components/certificates/**`, `src/components/live-sessions/**` | |
| `src/components/classroom/**` **except** `**/staff/**` after your split | You do the split (B1); A owns `staff/` afterwards |
| `src/components/tenant/**` **except** `admin/**` | TenantNavbar, TenantHomeNavBar, CourseCard, switcher, TenantTracker… |
| `src/components/layout/MobileBottomNav.tsx` | You hide then delete it |
| `src/components/academy-site/**` (new), `src/components/shell/student/**`, `src/components/shell/hub/**` (new) | |
| `src/lib/templates/**`, `src/lib/classroom/**` (new), `src/lib/calendar/**`, `src/lib/payments/**` | |
| Actions: `enrollments.ts`, `certificates.ts`, `profile.ts`, `discussions.ts`, `reviews.ts`, `practice.ts`, `practice-exercises.ts`, `referrals.ts` | |
| `src/actions/coupons.ts` — **only** checkout validation/redemption functions you add | A owns admin CRUD; don't change A's exports |

Shared with A, **additive only** (add exports; never change/remove existing exported signatures
without a HANDOFF note acknowledged by A): `src/actions/classroom*.ts`, `src/actions/live-sessions.ts`,
`src/actions/notifications.ts`, `src/types/database.ts`.

Not yours: everything in Agent A's list, `src/components/sections/**` and other marketing pages
(out of scope), tutor folders.

## Git workflow

- One branch per phase from up-to-date `main`: `redesign/b0-security-routing`,
  `redesign/b1-student-shell`, `redesign/b2-classroom`, `redesign/b3-public-site`.
- Small commits, clear messages. The B1 classroom split is **its own commit** so A can build on it.
- Before asking for merge, run the **Phase checks** and include results. The user merges to `main`
  (that deploys). Rebase on `main` first; resolve conflicts only in your files.

## Phase checks (every phase)

```bash
npx tsc --noEmit -p .
npx eslint <every file you changed>
npm run test:courses
npm run test:tenant-admin
npm run build
```

Browser pass at **375×812** and **1280×800** on every screen you changed, as: a guest, a learner
in one academy, a learner in two academies, a teacher (to see student view links), and a non-member
of the academy. Test accounts: QA users in `docs/COURSES_AUDIT.md` §7 or new Clerk dev users; sign
in with a Clerk sign-in token (`POST https://api.clerk.com/v1/sign_in_tokens` using the dev
`CLERK_SECRET_KEY` in `.env.local`, then `/sign-in?__clerk_ticket=<token>`). Never commit secrets.
Check: one bottom bar max, no horizontal scroll at 375px, tenant colour applied, loading skeletons
inside the shell, empty states, error states, toasts.

---

## Phase B0 — Security, money and routing fixes (start immediately, parallel to A0)

Logic only — no visual redesign yet. Do the non-academy files first; touch
`academy/[domain]/**` files only after A's "A0.1 merged" note (the folder is being moved).

1. **S2 — Coupons charged correctly.** Checkout server action takes `couponCode`, re-validates
   server-side (active, dates, usage limit, course/academy match), computes the amount, stores
   coupon + discount on the order; usage increments on confirmed payment (payment webhook/return
   path in `src/lib/payments/**`). 100% coupon → active enrollment without the payment provider.
   Add unit tests for the pure price computation (`src/lib/payments/*.test.ts`, add to a
   `test:payments` script).
2. **F5 / F6 — proxy.** On tenant subdomains don't rewrite `/courses/*/learn`, `/courses/*/checkout`,
   `/live-sessions/**`, `/certificates/**`, `/dashboard/**`, `/practice/**` (choose: redirect to apex
   with the same path — recommended; document choice in HANDOFF). Stop redirecting signed-in users
   away from `/`. Set `last_visited_tenant` for `/academy/{slug}/**` requests here (A relies on it).
   Delete `src/middleware-test.ts`.
3. **Landing** (02 §4) in `after-sign-in` + `resolve-home.ts`: safe `redirect_url`, roles, cookie.
4. **F12** onboarding guard restored; course page honours `?action=enroll` (after A0.1).
5. **S1 — join page** (after A0.1): never trust `courseId`/`cohortId` query params; only Clerk
   `publicMetadata.invited*` for this company, cleared after use; never auto-enrol in paid courses
   outside an admin invite. Add a test for the decision function (extract it pure).
6. **S6** (after A0.1): tenant-filter course lookups in the academy course page metadata and the
   platform `/courses/[slug]` redirect.
7. **F17** sign-in logo path.

**B0 done when** checks pass and you have manually proven: a paid course can't be joined via
`/join?courseId=`; a coupon changes the amount sent to PayChangu (use test mode or log the
computed amount in dev); subdomain → `/courses/x/learn` lands on the player.

## Phase B1 — Student shell + classroom split (after A0 is merged)

1. Run `scripts/codemod-colors.mjs` on your folders; review; typecheck.
2. Fix legacy-CSS fallout A listed in HANDOFF for `(learner)`, `(learning)`, `(auth)`.
3. **Classroom split commit** (04 §5 "Refactor plan"): mechanical move of instructor branches into
   `components/classroom/<feature>/staff/**`, student branches into `.../student/**`, shared bits into
   `.../shared/**`. No behaviour or style change. Run checks, commit alone, post in HANDOFF:
   "Classroom split landed in <commit> — A may now own `**/staff/**`".
4. Student shell (04 §1, 02 §3.2) with nav config in `shell/student/nav.ts`, using A's AppShell.
   `classroom/layout.tsx` uses `requireMember`. Route-based classroom: create the sub-routes
   (02 §2.2) rendering existing student components (restyle comes in B2), `?tab=` redirects,
   `scheduleId` detail sheet (F10). Retire academy `/dashboard` → `/classroom/learning`.
5. Hub shell for `/dashboard/**` (02 §3.4), no marketing header/footer (D5).
6. Hide `MobileBottomNav` on shell routes; delete it once A's staff shell is also live (check
   HANDOFF), and remove its import from layouts you own (ask A for layouts you don't).
7. `loading.tsx` / `error.tsx` inside each shell; remove the lesson player's own `<Toaster/>`.

## Phase B2 — Student screens

Order: Classroom home (04 §4) → My learning → Schedule (F15 shared calendar export) → Assignments
(+ detail/submit) → Materials → Notices → Community → Live → Progress → Certificates (academy +
`/dashboard/certificates`) → Hub `/dashboard` (04 §2) + schedule + settings → Practice wrapper +
FocusShell session (F11) → Focus pages: player branding, checkout UI + return page, certificate
page, live book/studio, join (04 §7) → Auth + onboarding UI (04 §8). Delete `ClassroomTabs.tsx` at
the end. Load data server-side in `src/lib/classroom/*.ts` (no giant client `useEffect`).

## Phase B3 — Public academy site + templates

04 §3: section library in `components/academy-site/sections`, presets mapping old `home_template`
values, public header/footer, catalog route `/courses` (F3), course detail redesign (D7, S6),
`id="courses"` (F4), real stats only (D1), remove the legacy CSS bridge import from the public home
page. Post the preset list + any `TemplateRenderer` API change in HANDOFF **before** merging so A's
Site Studio keeps working. Delete unused tenant components (`TenantTracker`, old navbars) and dead
learner components (00 P2).

## When you finish a phase

Write in HANDOFF.md under "Done": phase, branch/PR, what A needs to know (routes, components,
deleted files), migrations to apply, known gaps.
