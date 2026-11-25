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
