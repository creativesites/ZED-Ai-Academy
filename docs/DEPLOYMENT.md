# Deployment Guide — Zed AI Academy

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
