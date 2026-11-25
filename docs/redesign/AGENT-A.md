# Agent A — Foundations + Staff side

You are one of two agents implementing the CS Learn redesign. **You build the design system
and shells everyone uses, then redesign the academy admin (staff side) and fold the old `/creator`
admin into it.** Agent B does the learner side in parallel. You coordinate only through
[HANDOFF.md](HANDOFF.md).

## Read first (in this order)

1. `CLAUDE.md` and `AGENTS.md` at the repo root. **This is Next.js 16** — `src/proxy.ts`, not
   middleware; check `node_modules/next/dist/docs/` before using an API you're unsure of.
2. [README.md](README.md) — principles and the work order.
3. [00-findings.md](00-findings.md) — rows marked **A** are yours.
4. [01-design-system.md](01-design-system.md) — you implement all of it.
5. [02-information-architecture.md](02-information-architecture.md) — §1, §2.3, §3.1, §5, §6.
6. [03-tenant-admin.md](03-tenant-admin.md) — your screen specs.
7. `docs/COURSES_AUDIT.md` — what was just rebuilt in the course studio/editor (don't redo it).

## Ground rules

- **Stay inside your ownership list.** Need something changed in a file you don't own? Add a
  request to [HANDOFF.md](HANDOFF.md) and continue with something else.
- `src/components/tutor/**`, `src/lib/tutor/**`, `design/rive/**` belong to another workstream:
  **read-only**. Wrap, don't edit.
- No raw hex colours in className in files you touch; use tokens. No arbitrary radii. No fake data.
- Server components by default; mutations via server actions in `src/actions/**`; every server
  action re-checks auth and tenant membership on the server (never trust IDs from the client).
- Database changes: write a migration in `supabase/migrations/<timestamp>_<name>.sql`, **do not
  apply it**, list it under "Migrations to apply" in HANDOFF.md with what breaks if it's missing
  (code must degrade gracefully until it's applied).
- Keep `main` deployable: `main` auto-deploys to Vercel.

## Ownership

| You own (edit freely) | Notes |
|---|---|
| `src/app/globals.css`, `src/app/layout.tsx`, `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/app-surface-reset.css`, `scripts/gen-app-surface-reset.py` | Global foundations |
| `src/components/ui/**`, `src/components/app/**` (new), `src/components/shell/**` (new) **except** `shell/student/**` and `shell/hub/**` | B owns the student/hub nav configs |
| `src/lib/branding/**`, `src/lib/format.ts`, `src/lib/routes.ts`, `src/lib/time/**`, `src/lib/admin/**`, `src/lib/live-sessions/**`, `src/lib/courses/**` | |
| `src/lib/tenants/**` **except** `resolve-home.ts` | B owns landing resolution |
| `src/app/(academy)/academy/[domain]/admin/**` | after the A0 move |
| `src/app/(creator)/**`, `src/app/(admin)/**`, `src/app/(company)/**` | |
| `src/components/creator/**`, `src/components/tenant/admin/**`, `src/components/admin/**`, `src/components/superadmin/**` | |
| `src/components/classroom/**/staff/**` | **only after** B's split commit lands (B1) |
| Actions: `company.ts`, `admin-enrollments.ts`, `tenant-enrollments.ts`, `courses.ts`, `modules.ts`, `lessons.ts`, `content-blocks.ts`, `quizzes.ts`, `course-ai.ts`, `media-assets.ts`, `site-assets.ts`, `page-media.ts`, `super-admin.ts`, `tenants.ts`, `zoom.ts`, `google-meet.ts`, `jitsi.ts` | |
| `src/actions/coupons.ts` — CRUD/admin functions | B may add checkout redemption functions in the same file; don't change their signatures |
| `eslint.config.mjs`, `scripts/codemod-colors.mjs` (new) | |
| `supabase/migrations/**` files you create | |

Shared with B, **additive only** (add new exports; never change or remove existing exported
signatures without a HANDOFF note acknowledged by B): `src/actions/classroom*.ts`,
`src/actions/live-sessions.ts`, `src/actions/notifications.ts`, `src/types/database.ts`.

## Git workflow

- One branch per phase from up-to-date `main`: `redesign/a0-foundations`, `redesign/a1-staff-shell`,
  `redesign/a2-admin-screens`, `redesign/a3-creator-merge`.
- Small commits with clear messages. End each commit message with your agent's attribution line if
  your tool adds one.
- Before asking for merge, run the **Phase checks** below and paste the results in the PR / your
  report. The user merges to `main` (that deploys).
- Rebase on `main` before opening the PR; resolve conflicts only in files you own. If a conflict is
  in B's file, stop and write in HANDOFF.

## Phase checks (every phase)

```bash
npx tsc --noEmit -p .
npx eslint <every file you changed>
npm run test:courses
npm run test:tenant-admin
npm run build
```

Then a browser pass at **375×812** and **1280×800** on every screen you changed: signed in as an
academy admin, a teacher, and a learner (to prove learners are kept out). Test accounts: create
Clerk dev users or use the QA users in `docs/COURSES_AUDIT.md` §7; sign in with a Clerk sign-in
token (`POST https://api.clerk.com/v1/sign_in_tokens` with the dev `CLERK_SECRET_KEY` from
`.env.local`, then open `/sign-in?__clerk_ticket=<token>`). Never commit secrets or tokens.
Check: no horizontal scroll at 375px, only one bottom bar, focus rings visible, toasts appear,
loading skeleton shows inside the shell, empty states read well.

---

## Phase A0 — Foundations (do first; B waits on this for UI work)

Goal: the design system, shells frame, tenant context, and legacy-CSS removal are in `main`.

**A0.1 — Move the academy tree (do this first, merge fast, announce in HANDOFF)**
- `git mv "src/app/(marketing)/academy" "src/app/(academy)/academy"`. New
  `src/app/(academy)/layout.tsx`: no legacy CSS, no `marketing-shell`, no `MobileBottomNav`.
  Keep `academy/[domain]/layout.tsx` behaviour (tenant lookup, suspended screen).
- Temporary bridge: `academy/[domain]/page.tsx` (public home only) imports the legacy CSS until B3.
- Typecheck + build, open a tiny PR **"chore: move academy routes to (academy) group"**, ask the
  user to merge it immediately, then write in HANDOFF: "A0.1 merged — academy tree is now under
  (academy)". B does not touch academy files until this note exists.

**A0.2 — Tokens, typography, legacy CSS removal**
- Implement 01 §2.1, §3, §4 in `globals.css` (`@theme inline` additions: `surface`,
  `surface-muted`, `ink`, `primary-soft`, `primary-hover`, `success*`, `warning*`, `info*`,
  `destructive-soft`). Radius base `0.75rem`.
- Remove body gradient and global clamp heading sizes from `@layer base` (01 §1 steps 6–7); move
  anything marketing needs into `.marketing-shell` scope.
- Remove the legacy CSS import from `(creator)`, `(admin)`, `(company)`, `(learner)`, `(learning)`,
  `(auth)` layouts. Fix fallout in **your** files (legacy classnames → Tailwind). For B's files
  (`(learner)`, `(learning)`, `(auth)`), do only the import removal and list visible breakages in
  HANDOFF for B — don't restyle them.
- Root `loading.tsx` → minimal (thin top progress or nothing) (F19). Global
  `<Toaster position="top-center" richColors closeButton />` in root layout; remove the ad-hoc
  Toasters in your files (F2) and list B's (`lesson-player-client.tsx`) in HANDOFF.
- Delete unused `src/assets/css/**`, `src/styles/template-styles.css` (verify no imports first).

**A0.3 — Primitives and patterns**
- Add missing `ui/` primitives (01 §5.1); restyle button/badge/input/card/dialog/sheet/tabs to tokens.
- Build `src/components/app/*` (01 §5.2): PageHeader, Section, StatCard/StatGrid, EmptyState,
  ErrorState, DataTable (with mobile cards), FilterBar (search params), ConfirmDialog + useConfirm,
  StatusBadge, UserCell, CopyField, ResponsiveDialog, FormField helpers, SubmitButton, Skeletons.
- `src/lib/format.ts` (money ZMW "K 450", dates, relative time, academy timezone),
  `src/lib/time/weekdays.ts` (ISO Mon=1), `src/lib/routes.ts` (02 §6), `src/lib/branding/brand-style.ts`
  + `BrandProvider` (01 §2.2) with unit tests (`node --test`, add to a script `test:foundations`).

**A0.4 — Shell frame and tenant context**
- `src/components/shell/`: AppShell, SidebarNav, TopBar, BottomTabBar, MoreSheet, AcademySwitcher,
  UserMenu, NotificationBell, FocusShell; `NavItem` type with `roles` and `mobile` (01 §5.3).
  Provide a `TenantContextProvider` (client) exposing the `TenantContext` + `basePath`.
- `src/lib/tenants/context.ts`: cached `getTenantContext(domain)` + `requireMember/Teacher/Admin`
  (02 §1). Fix **S4** (split platform super-admin from tenant owner) with tests.
- A `/design` page (dev-only, `notFound()` in production) showing every primitive and pattern —
  B uses it as the reference.

**A0.5 — Codemod + lint**
- `scripts/codemod-colors.mjs` (01 §2.3). Run it on **your** folders only; review diff; typecheck.
  Leave B's folders for B to run.
- ESLint rule warning on raw hex in className for app folders (01 §2).

**A0 done when:** checks pass; `/design` renders all components at 375/1280; creator studio and
lesson editor still look right with legacy CSS gone (the `.app-surface` reset can now be deleted —
verify, then delete it and the generated file/script); HANDOFF has the "A0 merged" note with a short
list of what B can now use.

## Phase A1 — Staff shell + IA

- Staff layout (03 §1) with nav config (02 §3.1), role-aware, BrandProvider, suspended state,
  `loading.tsx` / `error.tsx` / `not-found.tsx` inside `admin/`.
- Route renames with redirects: `enrollments` → `learners`, `classroom` → `classes`,
  `live-sessions` → `live`, `settings/live-sessions` → `live?tab=availability`, `settings` →
  General settings page (no longer a redirect to site). Update every internal link (use
  `routes.ts`).
- Replace inline auth in every admin page with the guards (F16). Fix S5.
- Delete `components/tenant/admin/Navbar.tsx`; hide `MobileBottomNav` under `/admin` until B
  deletes it (if B hasn't yet, request it in HANDOFF rather than editing it).
- `(admin)` superadmin layout cleanup + **S3** (03 §14). `(company)` → redirect (D8).

## Phase A2 — Admin screens

In this order (each a commit or two): Overview (03 §2) → Courses (§3) → Course studio/editor
integration (§4) → Learners + profile + invite (§5) → Staff (§11) → Settings General + Site Studio
frame (§12, D1/D2) → Live sessions (§8, F7, F14) → Submissions (§7, F8) → Payments (§10) → Classes
(§6, after B's split commit) → AI teachers wrapper (§9) → Notifications + ⌘K (§13, last).

For every screen: PageHeader, loading skeleton, empty state, error state, mobile layout, toasts.
Data loaders go in `src/lib/admin/*.ts` with server-side filtering/pagination via search params.

## Phase A3 — Creator → academy admin

Implement 02 §5: redirects for every `/creator/**` route (exact academy via the course's
`company_id`; picker page when ambiguous), make `tenantSlug` required in course route helpers,
remove creator chrome (`CreatorNavbar`, layout UI), write the `zedai` instructor backfill migration
(don't apply), fix F9. Re-run the course QA script from `docs/COURSES_AUDIT.md` §6 through the
academy admin URLs.

## When you finish a phase

Write in HANDOFF.md under "Done": phase, PR/branch, what changed for B (new components, renamed
routes, removed things), migrations to apply, known gaps.
