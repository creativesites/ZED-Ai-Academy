# Deployment Guide — CS Learn (learn.creativesites.site)

## Production Deployment (Vercel)
- **Production branch:** `main` (`origin/main`).
- **Trigger:** Pushing committed changes to `origin/main` automatically triggers a production build and deployment on Vercel.

## Pre-Deploy Checklist
1. **Database migrations:** Apply any new SQL files in `supabase/migrations/` in Supabase before (or alongside) deploying code that depends on new columns, tables, or seeded rows.
2. **Tests & TypeScript:**
   - `npm run test:tutor`
   - `npm run test:courses`
   - `npm run test:tenant-admin`
   - `npm run test:payments`
   - `npm run test:security`
   - `npx tsc --noEmit`
3. **Push to `main`:**
   - From `main`: `git push origin main`
   - From a feature branch that is cleanly ahead of `origin/main`: `git push origin HEAD:main` (after pushing the feature branch itself).

## Domain
- **Production URL:** https://learn.creativesites.site (CS Learn / CreativeSites Learn).
- Set `NEXT_PUBLIC_APP_URL=https://learn.creativesites.site` in Vercel (Production). It's used for absolute links in emails, certificates, checkout callbacks, the sitemap/robots and `metadataBase`. If it's unset, code falls back to `BRAND.url` in `src/lib/brand.ts`.
- **Vercel:** add `learn.creativesites.site` under Project → Domains and point DNS at Vercel (CNAME `learn` → `cname.vercel-dns.com`).
- **Clerk:** add the domain to the production instance (allowed origins / redirect URLs). Update any hard-coded `afterSignInUrl`/`afterSignUpUrl` if needed.
- **Supabase:** add `https://learn.creativesites.site` to Auth → URL Configuration (Site URL + redirect URLs) if Supabase auth redirects are used.
- **Payments:** update callback/webhook URLs at the payment processor to the new domain.
- **Old domains** (`academy.zedai.org`, `zedai.academy`): set a 308 redirect to the new domain in Vercel so existing links and certificate URLs keep working.

## Required environment variables (Production)
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://learn.creativesites.site`. Absolute links, payment return URLs, `metadataBase` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Database. The service role bypasses RLS and is only ever used server-side |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET` | Auth |
| `PAYCHANGU_SECRET_KEY` | Starting and verifying payments (`/verify-payment/{tx_ref}`) |
| `PAYCHANGU_WEBHOOK_SECRET` | **Recommended.** The webhook secret from the PayChangu dashboard. When set, webhooks must carry a valid HMAC `Signature` header. Payments are always re-verified with PayChangu either way |
| `CRON_SECRET` | Protects `/api/cron/reconcile-payments` |
| `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, `EMAILJS_TEMPLATE_WELCOME`, `EMAILJS_TEMPLATE_ENROLLMENT`, `EMAILJS_TEMPLATE_PAYMENT`, `EMAILJS_TEMPLATE_CERTIFICATE` | Transactional email. A missing key logs a warning and no email is sent |

## Payments (PayChangu)
- Flow: checkout creates a `pending` order → PayChangu hosted checkout → the buyer returns to `/courses/[slug]/checkout/return?tx_ref=…` and the webhook hits `/api/webhooks/paychangu`. Both call `settleOrder()`, which re-queries PayChangu and grants access only if status, currency and amount match. Settlement is idempotent.
- In the PayChangu dashboard, set the webhook URL to `https://learn.creativesites.site/api/webhooks/paychangu` and copy the webhook secret into `PAYCHANGU_WEBHOOK_SECRET`.
- **Schedule** `GET /api/cron/reconcile-payments` every 15 minutes with header `Authorization: Bearer $CRON_SECRET`, using Vercel Schedules or any external scheduler. It settles orders whose webhook was missed.
- ⚠️ **Currency:** PayChangu's public docs list only MWK and USD for standard checkout. Prices and orders here are in **ZMW**. Confirm ZMW support with PayChangu in sandbox before taking real payments, or move to a processor with ZMW and MTN/Airtel Zambia (e.g. Flutterwave or DPO). Only `src/lib/payments/paychangu.ts` needs to change.
