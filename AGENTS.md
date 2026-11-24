<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deployment Rule
- **Production deploys automatically via Vercel when commits are pushed to `main`** (`origin/main`).
- Before pushing to `main`, run relevant unit tests (`npm run test:tutor`, `npm run test:courses`, `npm run test:tenant-admin`) and verify TypeScript (`npx tsc --noEmit`).
- Apply any new SQL migrations in `supabase/migrations/` before or alongside deploying dependent code. See `docs/DEPLOYMENT.md` for full details.
