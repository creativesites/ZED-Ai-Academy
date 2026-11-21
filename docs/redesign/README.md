# Zed AI Academy — Redesign Plan (Nov 2026)

This folder is the complete plan for redesigning the **tenant (academy) admin** and the **student
frontend**, plus the fixes found while surveying them. Two implementation agents work from it in
parallel.

| File | What it is | Who reads it |
|---|---|---|
| [00-findings.md](00-findings.md) | Every bug, security hole and fake-data issue found, ranked, with file:line and the fix | Both agents |
| [01-design-system.md](01-design-system.md) | Tokens, type, spacing, components, patterns, legacy-CSS removal | Both agents |
| [02-information-architecture.md](02-information-architecture.md) | Route map, roles, navigation shells, URL rules, redirects | Both agents |
| [03-tenant-admin.md](03-tenant-admin.md) | Screen-by-screen spec for the academy admin (and creator consolidation) | Agent A |
| [04-student-experience.md](04-student-experience.md) | Screen-by-screen spec for everything a learner sees | Agent B |
| [AGENT-A.md](AGENT-A.md) | **Instructions for Agent A — Foundations + Staff side** | Agent A |
| [AGENT-B.md](AGENT-B.md) | **Instructions for Agent B — Learner side** | Agent B |
| [HANDOFF.md](HANDOFF.md) | Shared log: requests between agents, decisions, done-list | Both agents |

## The one-paragraph version

The app works but looks and behaves like four products glued together: a legacy Bootstrap marketing
template loaded on every page (it overrides Tailwind), ~2,400 hard-coded colour classes, three
dashboards, four mobile navs that stack on top of each other, two copies of the admin (`/creator`
and `/academy/[domain]/admin`), and a tenant brand colour that only reaches a handful of elements.
The redesign (1) removes the legacy CSS from every app surface, (2) introduces one token-based design
system where the **tenant's brand colour drives `--primary`** everywhere inside an academy, (3) gives
staff and students one app shell each with role-aware navigation, (4) turns the classroom's
`?tab=` panels into real routes, (5) makes `/academy/[domain]/admin` the only admin and redirects
`/creator/*` into it, and (6) fixes the security and money bugs in [00-findings.md](00-findings.md).

## Principles (apply to every screen)

1. **Content first, chrome second.** Default page heading is `text-2xl font-semibold`. No uppercase
   `font-black` hero headings inside the app, no `text-7xl`, no `rounded-[4rem]`.
2. **One primary action per screen**, visually obvious, reachable by thumb on mobile.
3. **Mobile is the primary target** (Zambia: mid-range Android, patchy data). Design at 375px first,
   then widen. Every table has a card layout below `md`.
4. **Never fake it.** No hard-coded ratings, learner counts, "95% completion", sample courses or phone
   numbers. If there is no data, show an honest empty state with a next step.
5. **Every async surface has four states**: loading (skeleton), empty (explains + CTA), error
   (retry), success. Every mutation gives feedback (toast or inline).
6. **White-label by default.** Inside `/academy/[domain]/**` the tenant's colour and logo are used;
   Zed orange appears only on platform pages and as the fallback.
7. **Accessible**: 44px touch targets, visible focus rings, colour contrast ≥ 4.5:1 (auto-pick text
   colour on tenant brand colour), labels on every input, `aria-current` on nav.
8. **Fast on slow networks**: server components by default, stream with `loading.tsx`, no client
   fetch waterfalls, images via `next/image` with sizes.

## Work split and order

```
             Week 1                       Week 2                      Week 3
Agent A  [A0 Foundations] ──merge──▶ [A1 Admin shell+IA] ─▶ [A2 Admin screens] ─▶ [A3 Creator→Admin merge]
Agent B  [B0 Security & routing fixes] ─(rebase on A0)─▶ [B1 Student shell] ─▶ [B2 Student screens] ─▶ [B3 Public academy + templates]
```

- **A0 must merge before any UI work by B** (B1+). B0 is logic-only and runs in parallel with A0.
- Each phase is its own branch and its own PR into `main`. `main` deploys to Vercel, so **only merge
  after the phase's acceptance checks pass** (see each AGENT file).
- File ownership is strict (see "Ownership" in each AGENT file). If an agent needs a change in a file
  it does not own, it writes a request in [HANDOFF.md](HANDOFF.md) instead of editing it.

## Before the agents start

- The working tree currently has **uncommitted Site Studio work** from another session
  (`src/components/creator/settings/**`, `live-preview-pane.tsx`, `settings-form.tsx`,
  `SharedSections.tsx`, `home-content.ts`, `academy/[domain]/page.tsx`, `admin/settings/site`).
  Commit or discard it first so both agents start from a clean `main`.
- The AI Teacher / tutor work (`src/components/tutor/**`, `src/lib/tutor/**`, `design/rive/**`) is
  being built by another session. **Both agents treat those folders as read-only** and only wrap them
  in the new shells.
- This is Next.js **16** (`src/proxy.ts`, not `middleware.ts`). Read the relevant guide in
  `node_modules/next/dist/docs/` before using any Next API you are not sure about.
