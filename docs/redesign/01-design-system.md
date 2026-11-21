# 01 — Design system

One system for every app surface (staff and student). Owned and built by **Agent A in phase A0**.
Agent B consumes it and requests additions through [HANDOFF.md](HANDOFF.md).

Stack: Tailwind v4 (`src/app/globals.css`, `@theme inline`), shadcn **base-nova** style on
`@base-ui/react` (`components.json`), `lucide-react` icons, `sonner` toasts.

---

## 1. Kill the legacy CSS on app surfaces

Today `public/assets/css/style.css` (6,155 lines; imports Bootstrap 5, Font Awesome, flaticon,
animate) is imported by **all seven route-group layouts**. It overrides Tailwind (17px body text,
heading fonts/colours, link colours, `!important` utilities like `.p-5`, `.border`, `.rounded`,
`.container`). The `.app-surface` reset (`globals.css` + generated `app-surface-reset.css`) is a
stopgap.

**Target:** the legacy stylesheet is imported **only** by layouts that render legacy marketing
sections (platform home `/`, about, pricing, contact, blog, launch-your-academy). It is **not**
loaded by:

- `(creator)`, `(admin)`, `(company)`, `(learner)`, `(learning)`, `(auth)`, `onboarding`
- anything under `/academy/[domain]/**`

### How (A0)

1. **Move the academy tree out of `(marketing)`.** Route groups do not change URLs, so
   `src/app/(marketing)/academy/[domain]/**` → `src/app/(academy)/academy/[domain]/**` keeps every
   URL identical. The new `(academy)/layout.tsx` imports only `globals.css` (from the root).
   Move with `git mv` so history is kept. Fix relative imports (most use `@/`, so few break).
   ⚠️ Coordinate: Agent B owns the student pages inside that tree after the move. A does the
   mechanical move in A0 *only*, changes nothing else in student files, and announces it in
   HANDOFF before B starts B1.
2. Remove the `import "../../../public/assets/css/style.css"` line from `(creator)`, `(admin)`,
   `(company)`, `(learner)`, `(learning)`, `(auth)` layouts.
3. Fix the fallout: grep each of those trees for legacy classnames (`thm-btn`, `sec-title`,
   `className="row`, `col-`, `container` used as Bootstrap container, `page-wrapper`, `wow`,
   `icon-`, `fa-`, `flaticon-`) and replace with Tailwind. Survey counts: superadmin 6 files,
   creator 5, learner dashboard 3, admin 3, live-sessions 2, plus `TenantNavbar`, `SuperAdminNav`.
   (The home templates in `lib/templates/home` also use them — B rewrites those in B3; until then
   `(academy)/academy/[domain]/page.tsx` may import a **scoped** legacy sheet — see step 4.)
4. Temporary bridge for tenant home templates only: until B3 lands, the tenant public home page
   (`/academy/[domain]` page.tsx only, not the layout) may `import` the legacy CSS. Remove in B3.
5. Once nothing in an app surface needs it, delete `.app-surface` usages, the reset block in
   `globals.css`, `src/app/app-surface-reset.css`, `scripts/gen-app-surface-reset.py`.
6. Remove the decorative body background (radial gradients in `@layer base`) from app surfaces:
   body is `bg-background`. Marketing pages apply their background via `.marketing-shell`.
7. Remove the global fluid `clamp()` heading sizes from `@layer base`. Headings get their size from
   classes (see §3). Marketing pages that relied on them use `.marketing-title` etc.

## 2. Tokens

All colour in app code goes through tokens. **No raw hex in className** (`bg-[#062e39]` etc.) in any
file you touch. Add an ESLint rule (A0) that warns on `/\[#[0-9a-fA-F]{3,8}\]/` in className strings
for `src/app/(academy|creator|learner|learning|admin)/**` and `src/components/(creator|learner|tenant|classroom|shell|ui)/**`.

### 2.1 Colour tokens (CSS variables in `globals.css`, exposed via `@theme inline`)

| Token | Light value | Use |
|---|---|---|
| `--background` | `#f7f8fa` (slate-50-ish) | App canvas |
| `--surface` (new) | `#ffffff` | Cards, panels, sheets |
| `--surface-muted` (new) | `#f1f3f6` | Inset areas, table header, input bg |
| `--foreground` | `#0b1f26` | Body text |
| `--muted-foreground` | `#5b6b73` | Secondary text (≥ 4.5:1 on surface) |
| `--border` | `#e3e7ec` | Hairlines |
| `--ink` (new) | `#062e39` | Zed deep teal — dark panels, platform accents. Tenant-independent. |
| `--ink-foreground` (new) | `#ffffff` | |
| `--primary` | **tenant brand** (default `#fd5523`) | Primary buttons, active nav, links, focus ring, progress |
| `--primary-foreground` | auto: `#ffffff` or `#0b1f26` by contrast | Text on primary |
| `--primary-soft` (new) | `color-mix(in oklab, var(--primary) 12%, white)` | Selected rows, active nav bg, soft badges |
| `--primary-hover` (new) | `color-mix(in oklab, var(--primary) 88%, black)` | Hover. Replaces `#ef4a16`, `#e0481d`, `#ea4817` |
| `--success` / `--success-soft` | `#16a34a` / `#dcfce7` | Completed, paid, active |
| `--warning` / `--warning-soft` | `#d97706` / `#fef3c7` | Pending, draft, empty lesson |
| `--destructive` / `--destructive-soft` | `#dc2626` / `#fee2e2` | Errors, delete |
| `--info` / `--info-soft` | `#2563eb` / `#dbeafe` | Live, notices |
| `--ring` | `var(--primary)` | Focus |

Expose as Tailwind colours: `bg-surface`, `bg-surface-muted`, `text-ink`, `bg-primary-soft`,
`hover:bg-primary-hover`, `bg-success-soft text-success`, etc.

Dark mode: **out of scope** for this redesign (no toggle exists). Keep the `.dark` block compiling
but do not design for it.

### 2.2 Tenant branding → tokens

`companies.primary_color` must drive `--primary` for everything under `/academy/[domain]/**` (public
pages, student shell, admin shell) and for the learner pages that belong to a course of that tenant
(`/courses/[slug]/learn`, `/checkout`, certificate page).

- A0 builds `src/lib/branding/brand-style.ts`:
  `brandStyle(hex?: string | null): React.CSSProperties` → `{ "--primary": hex, "--primary-foreground": contrastText(hex) }`
  with validation (fallback `#fd5523` on invalid input) and a WCAG contrast picker.
- A0 builds `<BrandProvider color={...}>` (a `div` with `style={brandStyle(color)}` and
  `className="contents"`), used by the academy layout and by learn/checkout/certificate pages.
- Delete the old `--primary-color` var and the `brandColor` inline-`style` prop drilling as each
  component is touched (TenantNavbar, TenantAcademySwitcher, join-client, CourseCard, templates…).
- `NextTopLoader` colour: `var(--primary)` isn't supported there; keep `#fd5523` on platform,
  pass tenant colour on academy layout if the loader is re-mounted there, else accept the default.

### 2.3 Hex → token codemod (A0)

Write `scripts/codemod-colors.mjs` (node, no deps) that rewrites, in the folders listed above:

| From | To |
|---|---|
| `[#fd5523]` | `primary` (e.g. `bg-[#fd5523]` → `bg-primary`, `text-[#fd5523]` → `text-primary`, `/20` opacity suffix preserved: `bg-primary/20`) |
| `[#ef4a16]`, `[#e0481d]`, `[#ea4817]` | `primary-hover` |
| `[#fff6ee]`, `[#fff2e9]` | `primary-soft` |
| `[#fd8d69]` | `primary/70` |
| `[#062e39]` | `ink` |
| `[#0a4055]` | `ink/90` |

Run it per folder, review the diff, typecheck. Leave marketing folders (`components/sections/**`,
`app/(marketing)/(about|pricing|blog|contact)`) untouched. Do **not** run it on
`components/tutor/**` (other session).

## 3. Typography

Fonts stay: **Plus Jakarta Sans** (`font-heading`) for headings, **Inter** (`font-sans`) for UI and
body, **JetBrains Mono** for code.

| Role | Class | Notes |
|---|---|---|
| Page title | `font-heading text-2xl font-semibold tracking-tight` (`sm:text-[28px]`) | One per page |
| Section title | `font-heading text-lg font-semibold` | |
| Card title | `text-[15px] font-semibold` | |
| Body | `text-sm` (14px) on dense admin screens; `text-[15px]`/`text-base` for reading (lesson content, course descriptions) | |
| Secondary | `text-sm text-muted-foreground` | |
| Caption / meta | `text-xs text-muted-foreground` | |
| Eyebrow (sparingly) | `text-xs font-medium text-muted-foreground` | **Not** uppercase-tracked-black. Ban `text-[10px] font-black uppercase tracking-[0.3em]` |
| Numbers in stats | `font-heading text-2xl font-semibold tabular-nums` | |

Never: `font-black` in app UI, `uppercase` on headings, `text-5xl+` outside public marketing/hero.

## 4. Space, radius, elevation, motion

- **Spacing:** 4px grid. Page padding `px-4 sm:px-6 lg:px-8`, page vertical `py-6 sm:py-8`. Card
  padding `p-4 sm:p-5`. Gaps: `gap-3` inside cards, `gap-4`/`gap-6` between cards and sections.
- **Max widths:** admin content `max-w-6xl` (tables may go `max-w-7xl`); reading pages `max-w-3xl`;
  forms `max-w-2xl`.
- **Radius scale** (`--radius: 0.75rem` base): `rounded-md` 8px (inputs, small buttons, badges `rounded-full`),
  `rounded-lg` 12px (buttons, menus), `rounded-xl` 16px (cards, sheets), `rounded-2xl` 20px (hero
  panels only). **Ban arbitrary radii** (`rounded-[2rem]`, `[2.5rem]`, `[3rem]`, `[4rem]`).
- **Elevation:** three levels only.
  - `shadow-none` + `border` — default cards.
  - `shadow-sm` — raised/interactive cards on hover, sticky bars.
  - `shadow-lg` — popovers, menus, dialogs, sheets.
  No coloured shadows (`shadow-[#fd5523]/..`).
- **Motion:** 150ms for hover/press, 200ms for panels; `motion-safe:` for anything that moves;
  no decorative infinite animations in app UI (keep `float-bob`, `marquee`, `hero-orbit` for marketing).

## 5. Components

### 5.1 Primitives in `src/components/ui` (A0 adds the missing ones)

Present: alert, avatar, badge, button, card, checkbox, dialog, dropdown-menu, input, label,
progress, scroll-area, select, separator, sheet, sonner, switch, tabs, textarea.

**Add** (base-nova via `npx shadcn@latest add <name>` using the repo's `components.json`; if the CLI
cannot fetch base-ui variants, hand-write on `@base-ui/react`, matching existing files' style):

`alert-dialog`, `skeleton`, `tooltip`, `popover`, `command` (for ⌘K + comboboxes), `combobox`,
`radio-group`, `toggle-group`, `accordion`, `collapsible`, `breadcrumb`, `pagination`, `table`,
`form` (react-hook-form binding), `kbd`, `spinner`.

Restyle existing primitives to the tokens above (button variants: `default` = primary, `secondary`
= surface + border, `ghost`, `outline`, `destructive`, `link`; sizes `sm` 32px, `default` 40px,
`lg` 44px; icon sizes). Badge variants: `neutral`, `primary`, `success`, `warning`, `destructive`,
`info` (soft bg + strong text).

### 5.2 App patterns in `src/components/app/` (new folder, A0)

| Component | Purpose |
|---|---|
| `PageHeader` | title, optional description, breadcrumbs, actions slot (primary action on the right; on mobile actions collapse into a `⋯` menu except the primary) |
| `Section` | section title + description + actions + children |
| `StatCard` / `StatGrid` | label, value, delta/helper text, optional href. Grid 2 cols mobile, 4 desktop |
| `EmptyState` | icon, title, one-sentence body, primary CTA, optional secondary link |
| `ErrorState` | message + "Try again" (calls `reset` or `router.refresh`) |
| `DataTable` | columns config → `<table>` on `md+`, **stacked cards below `md`** (each column declares `mobile: "title" | "meta" | "badge" | "hidden"`). Supports row actions menu, selection, empty state, loading skeleton, server-driven pagination via search params |
| `FilterBar` | search input (debounced → `?q=`), select filters (→ search params), result count, clear |
| `ConfirmDialog` + `useConfirm()` | promise-based replacement for `window.confirm` |
| `StatusBadge` | maps domain statuses (draft/published, active/pending_payment/cancelled, invited/active/deactivated, submitted/reviewed) to badge variants + labels, one source of truth |
| `UserCell` | avatar + name + email, truncates |
| `CopyField` | read-only value with copy button (invite links, codes) |
| `ResponsiveDialog` | `Dialog` on `md+`, bottom `Sheet` on mobile |
| `FormField` helpers | label, hint, error wiring for react-hook-form + server-action `useActionState` |
| `SubmitButton` | `useFormStatus` pending spinner + disabled |
| `Skeletons` | `PageSkeleton`, `TableSkeleton`, `CardGridSkeleton` used by `loading.tsx` files |

### 5.3 Shells in `src/components/shell/` (A0 builds the frame; A fills staff, B fills student)

- `AppShell` — layout frame: optional sidebar (lg+), top bar, main (scroll container), optional
  bottom tab bar (below md), safe-area padding. Accepts `nav: NavItem[]` config.
- `NavItem` type: `{ href, label, icon, match?: "exact" | "prefix", roles?: Role[], badge?: number, mobile?: "tab" | "more" | "hidden" }`.
- `SidebarNav`, `TopBar` (left: academy switcher/logo; centre: optional search trigger; right:
  notifications bell, user menu), `BottomTabBar` (max 4 tabs + More sheet), `MoreSheet`.
- `AcademySwitcher` (rebuilt from `TenantAcademySwitcher`), `UserMenu` (Clerk `useUser` + sign out,
  profile, "My academies"), `NotificationBell` (reuse `NotificationBellServer` data).
- `FocusShell` — full-screen task layout (lesson player, practice session, live room, checkout):
  slim top bar with back/exit, no tab bar.

One rule: **exactly one bottom tab bar on screen at a time.** The global `MobileBottomNav` is
deleted when both shells are live (B owns the deletion; until then B hides it on shell routes).

## 6. Page-level patterns

- **Lists**: `PageHeader` (title + primary action) → `FilterBar` → `DataTable` → pagination.
  Search/filter/sort/page live in URL search params so they survive refresh and are shareable.
  Server-side filtering with `range()` — no fetch-200-and-filter-in-memory.
- **Detail**: `PageHeader` with breadcrumbs + status badge + actions → tabs as **routes**
  (`/x/[id]/settings`), not client state.
- **Forms**: single column, `max-w-2xl`, sections with titles, sticky save bar on long forms,
  server actions with `useActionState`, inline field errors, toast on success.
- **Destructive actions**: `ConfirmDialog` stating exactly what is lost; type-to-confirm for
  deleting an academy, course with learners, or staff owner.
- **Loading**: every route segment with data has `loading.tsx` using the skeletons. Every shell
  group has `error.tsx` using `ErrorState`. `not-found.tsx` in `(academy)/academy/[domain]`.
- **Toasts**: success = short past tense ("Course published"); errors = what failed + what to do.
- **Numbers & dates**: `Intl` formatters in `src/lib/format.ts` (A0): `formatMoney(amount, "ZMW")`
  → "K 450" , relative dates ("in 2 days", "3h ago"), `formatDateTime` in the academy timezone.
- **Images**: `next/image` with `sizes`; course covers 16:9 with a branded placeholder (initials on
  `primary-soft`) when missing.

## 7. Content style

- Sentence case for everything (buttons, titles, nav). "Add student", not "ADD STUDENT".
- Plain verbs on buttons: Create course, Invite staff, Publish, Save changes, Join class.
- No emoji in headings. No exclamation marks except success moments ("Course complete!").
- Learner-facing copy uses "you"; admin copy uses "learners" (not "students" and "learners" mixed —
  pick **Learners** in admin UI, "students" only in marketing).
