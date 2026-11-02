# Pre-production audit — Zed AI Academy

Audit date: 2026-11-01 · Branch: `claude/pre-production-site-audit-jjmbyg` · Next.js 16.2.4 / React 19.2

**Method:** static review of the whole repo (66 pages, 28 API routes, 34 server-action files, 53 migrations), plus `tsc`, `eslint`, the tutor test suite and `next build`. I did **not** run the app against live Supabase/Clerk/PayChangu, so anything marked "verify" needs a real-environment check. No secrets were read or printed.

## Verdict

**Not ready for paying customers yet.** The product surface is large and the code is type-clean, but money, security and legal basics have gaps that would hurt on day one. The good news: most blockers are small, well-defined fixes. Estimated ~1–2 focused weeks for the P0 list.

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| Tutor tests (`npm run test:tutor`) | ✅ 281/281 pass |
| `eslint src` | ❌ 398 errors, 998 warnings (see §7) |
| `next build` | ⚠️ Compiles + typechecks; prerender stopped at `/contact` with `supabaseKey is required` because I used placeholder env vars. Needs a real run with your env, and `/contact` shouldn't touch Supabase at build time (see P1-9). |
| Automated tests outside the tutor | ❌ none |
| CI (`.github/`) | ❌ none |
| `.env.example` | ❌ none (30+ env vars, undocumented) |

---

## P0 — Fix before any real user or payment

### P0-1. RLS hardening migration is written but **not applied**
`docs/SECURITY_RLS.md` states `20261028000000_rls_hardening.sql` "has not been applied to any database." Until it is, the public publishable key (shipped in the browser bundle) can hit PostgREST directly against the old policies, which that same doc lists as exploitable: self-inserting **enrollments** (free paid courses), self-inserting **orders/certificates**, editing own **profile role**, reading `companies.teacher_code`, public instructor emails. **Action:** apply it (runbook already in the doc), then re-run the verification queries. Also: the migrations after it (`20261101…zai_tutor`, `20261102…`) are dated in the future relative to the hardening one. Confirm ordering is what you want.

### P0-2. A private key and 8 deploy logs are committed to git
- `jitsi/private-key.pk` is tracked (and `jitsi/public-key.pub`). `.gitignore` only covers `*.pem`. **Treat the key as compromised:** rotate it in Jitsi/JaaS, remove from the repo, and purge from history (`git filter-repo`/BFG) if the repo is or ever was public. I did not open the file.
- `deploy.log`, `deploy_new.log`, `deploy_prod*.log`, `deployment_log.txt`, `deployment_output.txt` are tracked. Review them for tokens/URLs, then delete and ignore them.
- Add `*.pk`, `*.log`, `jitsi/` to `.gitignore`.

### P0-3. Payment webhook can charge a learner and never enroll them
`src/app/api/webhooks/paychangu/route.ts`:
1. Marks the order `paid` **before** inserting the enrollment.
2. If the enrollment insert fails it returns 500 → PayChangu retries → the retry looks up `status = 'pending'`, finds nothing, returns 200 "already processed". **Result: money taken, no access, no retry.**
3. It never checks that the webhook `amount`/`currency` match `orders.amount`, and never calls PayChangu's verify-transaction endpoint (trusting the POST body alone).
4. `verifyWebhook` compares the bearer token with `!==` (not timing-safe) and treats the secret key itself as the webhook credential. Verify against PayChangu's current webhook-signature docs and use a signature (HMAC) if offered.
5. `PAYCHANGU_SECRET_KEY!` is read at import time; a missing env var silently becomes `undefined` and the `Bearer undefined` comparison path should be considered.

**Fix:** make order→paid + enrollment one atomic step (Postgres function/transaction, or insert the enrollment first and flip the order after), key idempotency on the enrollment not the order status, verify amount + call PayChangu verify, use `timingSafeEqual`.

### P0-4. Coupons are accepted in the UI but ignored at charge time
`checkout/page.tsx` renders `CouponInput`, shows a discounted total, but the render-prop is `(_finalPrice, _couponCode)` (unused) and `startCheckoutForCourse` always sends `course.price_amount`. Learners see a discount and are charged full price (or, if fixed later client-side, a tampered price). **Fix:** pass the code to the server action, re-validate and recompute the price server-side, store `coupon_id` + discounted `amount` on the order, and increment redemptions only on payment success.

### P0-5. Pricing page sells plans that don't exist
`/pricing` advertises **Pro ZMW 299/mo, Annual ZMW 2,499, team seat tiers, "Start Pro" CTAs**, but:
- the CTAs are `/sign-up?plan=pro` — the `plan` param is never read anywhere;
- there is no subscription/seat checkout, no recurring billing, no billing page, no entitlement check for `subscription_only` courses beyond a label;
- `/company` says "Phase 1 is live for enterprise design previews. Team seats… launch in the…" (a placeholder);
- the Business CTA is a `mailto:` to a personal Gmail.

**Decide:** either build it (PayChangu has no native recurring in the code today — likely "manual renewal" links + expiry dates in the DB), or **remove/rename** these plans to "Contact us / Coming soon" so you aren't selling vapor. Same for FAQ promises (7-day refund policy, formal invoices).

### P0-6. No legal pages
No Privacy Policy, Terms of Service or Refund Policy routes exist (nothing in `src/app`), yet the site collects personal data (Clerk), takes payments, records learner **audio/transcripts** (ZAI Tutor), and the FAQ promises refunds. Required before launch (and for PayChangu/Clerk/Google/Zoom app approvals). Add `/privacy`, `/terms`, `/refunds`, footer links, and a consent line on sign-up and before the tutor mic/recording starts.

### P0-7. No rate limiting on paid-AI endpoints
Only `/api/tutor/demo/*` has a limiter. All `/api/ai/*` routes (Gemini cost), `/api/tutor/sessions/*`, `/api/hero-enroll`, and the unauthenticated `/api/live-sessions/services/[id]/slots` have none. One logged-in user (or a script) can run up your Gemini bill. **Fix:** per-user/day quotas (store in Supabase or Upstash/Vercel KV), body-size and zod validation on the 7 AI routes that currently have none.

---

## P1 — Fix before launch announcement

| # | Area | Finding | Fix |
|---|---|---|---|
| P1-1 | SEO | No `sitemap.ts`, no `robots.ts`. 21 pages lack `metadata` including **home, courses list/detail, blog, FAQ, about, contact, launch-your-academy, academy home**. Root OG has no image. | Add sitemap (courses, blog, academies), robots (disallow `/admin`, `/superadmin`, `/creator`, `/api`, `/test`), per-page `generateMetadata`, OG image, canonical URLs, JSON-LD `Course`. |
| P1-2 | PWA | `manifest.json` points at `/images/icon-192.png` and `icon-512.png` — **neither file exists** (icons live under `public/assets/images/favicons`). No `<link rel="icon">`/apple-touch audit. | Fix paths, generate real maskable icons. |
| P1-3 | Test routes in prod | `/test`, `/test/[slug]`, `/test/canvas` are routed and marked **public** in `proxy.ts`; `console.log`s inside. | Delete or gate behind `NODE_ENV !== 'production'`/super-admin; remove from public matcher. |
| P1-4 | Email | Only EmailJS (client-side-style service, 200/mo free tier, weak deliverability). CLAUDE.md said Resend. Welcome/enrollment/certificate/payment functions all **silently no-op** when a template env var is missing. A hardcoded fallback `SERVICE_ID`/`PUBLIC_KEY` is in source. No email on company invite, completion, failed payment. | Move to Resend (SPF/DKIM on your domain), log failures, remove hardcoded IDs. |
| P1-5 | Certificates | "PDF" is `window.print()` of an HTML page. ROADMAP promised stored PDF + LinkedIn share. Public verification depends on the RLS migration (`verify_certificate`) — page must be re-tested after P0-1. | Server-rendered PDF (or at minimum print stylesheet QA), OG image per certificate, LinkedIn "Add to profile" link. |
| P1-6 | Secrets handling | `/api/admin/sync-clerk-users` takes the secret as a **query-string** param (lands in logs/history). Capped at 500 users, no pagination. | Header auth or delete after the one-off backfill. |
| P1-7 | Error handling | Many `catch (error: any)` routes return `error.message` straight to the client (e.g. slots route). No `global-error.tsx`. No error monitoring. | Generic client messages, add Sentry (or Vercel Observability) + `global-error.tsx`. |
| P1-8 | Server-client model | `src/lib/supabase/server.ts`: **both** `createClient` and `createServiceClient` use the service-role key; every authorization check is hand-written app code (34 action files). One missed `auth()` check = full DB access. | Add a lint/test guard that every action/route starts with an auth/role check; centralize `requireUser()/requireRole()/requireTenantRole()`. Audit pass over `src/actions/*`. |
| P1-9 | Build | `/contact` (and likely other statically prerendered pages) instantiate Supabase at build and fail without env. | Mark DB-reading pages `dynamic`/use `connection()`; make clients lazy. Then run `next build` in CI with real env. |
| P1-10 | Env docs | 30+ env vars (Clerk, Supabase×3 names incl. both `ANON_KEY` and `PUBLISHABLE_KEY`, Gemini×2 names, Zoom×8, EmailJS×7, PayChangu, `NEXT_PUBLIC_ROOT_DOMAIN`, `TUTOR_DEMO_ENABLED`…) with no `.env.example`. | Write `.env.example`; validate with zod at boot and fail loudly. |
| P1-11 | Learner/creator gaps | Lesson editor shows "Block type … editor coming soon" for unsupported block types; production editor still uses `window.location.reload()` after AI generation (per `plan.md`); ZAI Tutor "Live conversation is coming soon" paths still reachable; showcase has a "Coming soon" badge. | Hide or finish; confirm every block type the AI can emit has an editor + learner renderer. |
| P1-12 | Placeholder content | `sections/home3/About.js` contains "Lorem Ipsum"; `drag-and-drop/templates.ts` has `+260 XXX XXX XXX`; unused `public/placeholder-*.svg`, `next.svg`, `vercel.svg`. | Grep-clean before launch. |

---

## P2 — Polish

- **Accessibility:** 40 `<img>` without `alt`; 563 raw `<img>` (`@next/next/no-img-element`) means no responsive images/lazy loading/LCP optimization. Needs a keyboard-nav + contrast pass (the pricing/hero uses `text-white/40`, `text-[10px]` uppercase labels on tinted backgrounds — check WCAG AA).
- **Performance:** Two full CSS frameworks load side-by-side (Bootstrap + `assets/css/*` template CSS **and** Tailwind v4). Marketing/learner layouts import `public/assets/css/style.css`; `src/assets/css` and `public/assets/css` are duplicate copies. Big win: drop Bootstrap/duplicates, use `next/image`, lazy-load Swiper/Rive/Zoom/Jitsi bundles (three video SDKs are dependencies: `@zoom/meetingsdk`, `@zoom/videosdk`, `@jitsi/react-sdk`).
- **Dead weight:** 45 files in `src/components/slider/New folder/` (a literal "New folder" with spaces — also breaks `wc`/shell tooling), `DragAndDropModuleCreate.old.tsx`, `src/middleware-test.ts`, `scratch/`, `Videochat*.tsx`, whole `drag-and-drop/` legacy builder (27 + 15 lint errors), `design/rive/qa`, `docs/prototypes`. Remove or move out of `src`.
- **Template leftovers:** the UI is a purchased "Logistiq/Bootstrap" template (`public/logistiq-images`, `design-interior.css`, `projects.css`…). Audit visible copy/labels for leftover template text and unused CSS modules.
- **Migrations hygiene:** two `014_*` files; mixed numeric and timestamp naming; migrations dated in the future. Add a `schema` snapshot and decide one convention.
- **Dependencies:** `vercel` CLI listed as a runtime dependency; `jsrsasign` (unmaintained, flagged by npm), `glob`/`tar` deprecation warnings, `@types/jsonwebtoken`+`jsonwebtoken`+`jsrsasign` overlap, `@google-cloud/local-auth` (a desktop OAuth flow) in a server app. Run `npm audit`.
- **Docs drift:** `CLAUDE.md`/`ARCHITECTURE.md` say Supabase Auth, Anthropic Claude (`claude-sonnet-4-6`), Resend, payments TBD; the code is **Clerk + Gemini + EmailJS + PayChangu** and a multi-tenant "academy" model. `README.md` is still create-next-app boilerplate. `ROADMAP.md` has every box unchecked. Update these — they mislead you and any contractor/AI agent.
- **Branding strings:** theme color `#062e39`/`#fd5523` hardcoded in many components rather than tokens; `dark.css` ships but dark mode not wired in the layout.
- **Contact info:** personal Gmail (`creativesites263@gmail.com`) is the public contact in FAQ/pricing. Use a domain address.

---

## §7 ESLint breakdown (398 errors / 998 warnings)

`no-img-element` 563 · `no-unused-vars` 420 · `no-explicit-any` 310 · `react/no-unescaped-entities` 47 · `react-hooks/set-state-in-effect` 18 · `react-hooks/purity` 11 · `exhaustive-deps` 10.
Worst files: `actions/classroom.ts` (30), legacy `drag-and-drop/*` (≈54 — delete instead of fixing), `learn/page.tsx` (12), `TimetableTab.tsx` (12), `creator/settings-form.tsx` (12), `api/ai/site-intelligence/route.ts` (11). The `react-hooks/purity` and `set-state-in-effect` errors can be real runtime bugs (impure render, effect loops) — fix those first; the rest is cleanup. Decide on a baseline: fail CI on errors only, burn down warnings.

---

## Site map (what exists)

**Public marketing** — `/` · `/about` · `/pricing` · `/faq` · `/contact` · `/blog`, `/blog/[slug]` · `/courses`, `/courses/[slug]` · `/ai-tutor` (ZAI Tutor showcase + demo) · `/certificates/[publicId]` · `/launch-your-academy` · `/test*` (**remove**)
**Auth/onboarding** — `/sign-in`, `/sign-up` (Clerk) · legacy `/login`, `/register`, `/forgot-password` (**duplicate/likely dead — verify or delete**) · `/onboarding` · `/after-sign-in` (role router)
**Learner** — `/dashboard`, `/dashboard/schedule`, `/dashboard/settings` · `/courses/[slug]/checkout` · `/courses/[slug]/learn` (player) · `/live-sessions/[id]/book`, `/studio` · `/practice`, `/practice/[scenarioId]`
**Creator** — `/creator/courses` (+new, `[courseId]`, lesson editor) · `/creator/live-sessions` · `/creator/practice-submissions` · `/creator/settings`
**Company (B2B)** — `/company` (placeholder)
**Admin** — `/admin` (contacts, images, settings, students) · `/superadmin` (avatar-lab, courses, settings, tenants, users)
**Multi-tenant academies** — `/academy/[domain]` + `courses/[slug]`, `join`, `dashboard`, `classroom`, `practice`, and `admin/*` (classroom, courses, enrollments, live-sessions, settings, staff). Wildcard subdomains are rewritten in `src/proxy.ts`.
**APIs (28)** — AI ×11 (`/api/ai/*`), ZAI Tutor ×9 (`/api/tutor/*`), Zoom ×2, live-session slots, hero data/enroll, webhooks (Clerk, PayChangu), admin Clerk sync.
**Domain areas implemented** — courses/modules/lessons/content-blocks, quizzes, enrollments, coupons, reviews, discussions, notifications, certificates, referrals, blog CMS, media library, live sessions (Zoom/Jitsi/Google Meet), classroom/timetable/attendance, tenant branding + suspension, AI authoring (blueprint/curriculum/lesson/quiz/image), ZAI Tutor (scenarios, sessions, voice, reports).

**Doc-vs-reality gaps from the original roadmap:** subscriptions & billing page ❌ · company seats/invites/analytics/CSV ❌ · personalized learning paths ❌ · learner-side AI tutor in lesson player (a different `/api/ai/tutor` exists; verify wired) ⚠️ · quiz analytics ⚠️ · receipts/welcome/completion emails ⚠️ · sitemap/robots ❌ · accessibility pass ❌ · admin revenue report ❌.

---

## Suggested order of work

1. **Day 1 (security):** rotate Jitsi key + purge; apply RLS migration and verify; delete `/test*` and logs.
2. **Days 2–3 (money):** rewrite PayChangu webhook (atomic, verified, idempotent); server-side coupons; run a real sandbox payment end-to-end including a forced enrollment failure.
3. **Day 3:** decide subscription scope; strip or label unbuilt plans; replace Gmail contact.
4. **Days 4–5 (legal/abuse):** privacy/terms/refunds + consent; rate limits + zod on AI routes; `.env.example` + boot-time env validation.
5. **Week 2:** SEO (sitemap/robots/metadata/OG), manifest icons, Resend, certificate PDF, CI (tsc + lint-errors + tutor tests + `next build`), Sentry, `global-error.tsx`.
6. **Then:** delete dead code, `next/image`, drop Bootstrap duplication, a11y pass, update docs.

Open questions for you: Is this repo public? (changes how urgent the key purge is.) Which billing model do you want at launch — one-off course purchases only, or subscriptions too? Is the RLS migration safe to apply to your live Supabase now, or does it need a staging project first?
