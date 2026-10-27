# Row Level Security: model, hardening migration, and checks

Status: `supabase/migrations/20261028000000_rls_hardening.sql` is written and verified on a local Postgres 16 harness. **It has not been applied to any database.**

## 1. The model

- **Server code uses the service role.** `src/lib/supabase/server.ts` (`createClient`, `createServiceClient`) uses `SUPABASE_SERVICE_ROLE_KEY`. It bypasses RLS. Server actions, route handlers, webhooks and pages all go through it, and authorization is enforced in application code.
- **RLS matters for direct PostgREST calls.** Two callers reach the database directly:
  - `anon`: anyone holding the publishable key, which ships in the browser bundle.
  - `authenticated`: a Clerk session token minted with the `supabase` JWT template (`docs/clerk-supabase-integration.md`). Policies read the Clerk user id from `(auth.jwt() ->> 'sub')`. Never use `auth.uid()`, which is uuid-typed and does not match Clerk ids.
- **Browser client** (`src/lib/supabase/client.ts`) runs as `anon` when called without a token. Its importers are listed in section 4. Those reads must keep working.

Because the publishable key is public, every hole in an `anon` or `authenticated` policy is exploitable by anyone.

## 2. What the migration changes

Finding IDs refer to `RLS_AUDIT.md`.

| ID | Table | Change |
|---|---|---|
| C1 | profiles | Own-row UPDATE with `WITH CHECK`. Column grant: `UPDATE (full_name, avatar_url, bio)` only for `authenticated`. Role, company_id, email, onboarding_completed and id are server-owned. |
| C2 | enrollments | Self INSERT and UPDATE policies dropped. Learner SELECT kept. `INSERT, UPDATE` revoked from `anon, authenticated`. |
| C3 | companies | `anon` and `authenticated` get column SELECT only on id, name, slug, logo_url, primary_color, home_template, home_content, status, is_session_active, active_schedule_id, active_session_id, active_room_name. `teacher_code`, `admin_id`, `suspended_reason`, `suspended_at` are not granted. Duplicate "Anyone can view active session" policy dropped. |
| H1 | profiles | PUBLIC `WITH CHECK (true)` insert policy dropped. |
| H2 | profiles | Public instructor read policy dropped (it exposed instructor email to anon). See section 6 for the alternative. |
| H3 | user_platforms | PUBLIC `FOR ALL USING (true)` dropped. Owner SELECT kept. |
| H4 | certificates | Public `USING (true)` SELECT dropped, and self INSERT and UPDATE dropped. Owner SELECT recreated. New `public.verify_certificate(p_public_id text)` (SECURITY DEFINER, `search_path = public`, granted to anon and authenticated) returns only the fields the public page shows. |
| H5 | orders | Self INSERT and UPDATE dropped. Owner SELECT kept. |
| H6 | courses | Self-attributed INSERT and UPDATE replaced. Writes need `instructor_id = sub` and `public.is_company_staff(company_id)`. The UPDATE `WITH CHECK` blocks moving a course to another tenant or reassigning it. |
| H7 | company_members | Admin ALL policy rewritten with `public.is_tenant_role(company_id, ARRAY['company_admin'])`. This removes the recursion and the invalid `'admin'` role. |
| M1 | notifications | PUBLIC `WITH CHECK (true)` insert dropped (same class of hole as H1 and H3). |

Helpers added:
- `public.is_tenant_role(text, text[])`: SECURITY DEFINER, used by H7.
- `public.is_company_staff(text)`: SECURITY DEFINER, active membership with role company_admin, teacher or instructor, in an active tenant. The definition matches the ZAI Tutor migration byte-for-byte, so that migration can `CREATE OR REPLACE` it.
- `public.verify_certificate(text)`: see H4.

Not changed: table structure, column types, MEDIUM, LOW and BROKEN items (except where listed above).

## 3. Not fixed in this migration

- **H8 classroom tables** (announcements, class_schedules, classroom_groups, classroom_group_members, classroom_sessions, student_attendance). Their policies cannot exist as written (text vs uuid), so the live state is unknown. Fixing them needs the live schema, from the "Before applying" queries below. Expected follow-up: rebuild on `is_tenant_role`, with `author_id = sub` on announcement inserts.
- **B-items** (BROKEN). Clerk ids in `uuid` columns (practice_sessions, blog_comments, media_assets.created_by, student_attendance.profile_id), anon realtime on discussions (B7), anon read of media_assets for home slots (B8). These are functional fixes, not security fixes.
- **M2 to M5, L1 to L9**, except as listed above.
- Policies the audit could not see live. If "Company admins can update companies" or "Company admins can view enrollments" exist with `auth.uid()` as in the file history, they error and are left alone. See risk R3.

## 4. Browser and anon reads that must keep working

Checked against the migration. Each one is an `anon` (or `authenticated`) call from a client component or a client-side helper.

| Call site | Table and columns | Status |
|---|---|---|
| `src/components/classroom/LiveSessionTab.tsx:81-104` | `companies` realtime UPDATE, reads `is_session_active`, `active_room_name`, `active_schedule_id`, `active_session_id` (filter `id`) | Preserved by the column grant. See R1. |
| `src/components/classroom/DiscussionsTab.tsx:28-49` | `discussions` realtime INSERT | Unchanged (B7 already prevents delivery to anon). |
| `src/components/layout/SearchPopup.js:22-24` | `courses` published (`id, title, slug, thumbnail_url, category`) | Unchanged. |
| `src/lib/page-media.ts:27-70` | `media_assets`, `page_media_slots` | Unchanged. |
| `src/lib/site-assets.ts:15-30` | `site_assets` | Unchanged. |
| `src/components/shared/user-nav.tsx` | browser client, no table reads found | Unchanged. |

No browser or anon code selects `*` from `companies` or writes `profiles`, `enrollments`, `orders`, `certificates`, `notifications` or `user_platforms`. Every server-side `companies` read in `src/` uses the service role, so the column grants do not affect it.

The public certificate page (`src/app/(marketing)/certificates/[publicId]/page.tsx`) uses the server client, so it does not need `verify_certificate`. It is kept for future client or PostgREST verification.

## 5. Before applying (run in the Supabase SQL editor, read only)

Run these on the **live** database first. Compare the output with the expectations below. Any difference changes the risk.

```sql
-- 1. Live policies on the affected tables
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','enrollments','companies','certificates','orders','courses',
                    'company_members','user_platforms','notifications')
order by tablename, policyname;

-- 2. Table and column grants for anon and authenticated
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
  and table_name in ('profiles','enrollments','companies','certificates','orders','courses','company_members');

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon','authenticated')
  and table_name in ('profiles','companies')
order by table_name, column_name, privilege_type;

-- 3. Unexpected roles (a super_admin you do not recognise is an incident, not a schema issue)
select role, count(*) from public.profiles group by role order by role;
select id, role, company_id, email from public.profiles where role = 'super_admin';

-- 4. Id column types the helpers rely on (expect text for all of these)
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('companies','id'), ('companies','admin_id'),
    ('company_members','profile_id'), ('company_members','company_id'),
    ('courses','company_id'), ('courses','instructor_id'),
    ('certificates','user_id'), ('orders','user_id'), ('profiles','id'))
order by 1, 2;

-- 5. Helper or function name collisions (the ZAI Tutor migration owns is_company_staff)
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_company_staff','is_tenant_role','verify_certificate');

-- 6. Certificates with a public_id (you will use one of these to test verify_certificate)
select public_id from public.certificates limit 3;
```

Expectations:
1. Policies match the audit (section 2). Some CREATE POLICY statements in the migration history cannot exist as written, so a missing policy is normal. A policy with `USING (true)` on profiles, user_platforms, notifications, certificates or companies (other than the companies SELECT) is a finding.
2. `anon` has no `teacher_code` or `admin_id` privilege. Some column grants may already exist and are harmless.
3. Only expected super_admins. Zero in company_members with role `admin` (it is not a valid role).
4. All text. A uuid `company_id` or `profile_id` would make the helper comparisons fail, so stop and report it.
5. Expect no rows, or only ZAI Tutor's definition of `is_company_staff`. If the ZAI Tutor migration is already live, its definition must match the one in the migration. Compare the body with `pg_get_functiondef`.
6. At least one row, to test `verify_certificate`.

Also confirm backups: a point-in-time restore or a `pg_dump` of the affected tables before applying.

## 6. After applying

Run the same query 1 and check that the vulnerable policies are gone and the new ones exist (`Users can update own profile`, `Users can view own certificates`, `Tenant staff can create own courses`, `Tenant staff can update own courses`, `Company admins can manage members`).

```sql
-- Column grants for profiles: expect only full_name, avatar_url, bio for authenticated
select column_name from information_schema.column_privileges
where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE';

-- companies: expect no teacher_code, admin_id, suspended_reason or suspended_at for anon
select column_name from information_schema.column_privileges
where table_schema='public' and table_name='companies' and grantee='anon' and privilege_type='SELECT';

-- Verify a real certificate through the function (run as postgres)
select * from public.verify_certificate('<a public_id from step 6 of section 5>');
```

Through the REST API with only the publishable key (`anon`), these should fail or return nothing:
- `GET /rest/v1/companies?select=teacher_code` returns a permission error.
- `GET /rest/v1/certificates` returns an empty array.
- `GET /rest/v1/profiles?role=eq.instructor` returns an empty array.
- `POST /rest/v1/user_platforms` is rejected.

Through `POST /rest/v1/rpc/verify_certificate` with the publishable key, this should return the verification row.

Manual test list (use a test account and a test academy, not production data):
1. **Sign in as a learner and edit the profile** (name, avatar, bio). The change saves. Changing role via the API is rejected.
2. **Enrollment through checkout or the PayChangu webhook** still creates the enrollment, and the learner can open the course content.
3. **Academy subdomain page** (`/academy/<slug>`) and its join page still load tenant name, logo and branding.
4. **Certificate public page** (`/certificates/<publicId>`) shows the learner name, course and date.
5. **Course creation by a teacher** in their academy succeeds. The same action from a learner, or from a teacher of a suspended academy, fails.
6. **Classroom live session**: the `LiveSessionTab` realtime status updates when the instructor starts and ends a session (R1).
7. **Staff admin page** (`/academy/<slug>/admin/staff`): the company admin can list and change members. Previously this could error (H7).

## 7. Risks to check before applying

- **R1. Realtime and column privileges.** `LiveSessionTab` depends on realtime `postgres_changes` for `companies`. Realtime is believed to honour column grants, but this is unverified (audit section 8). Test step 6 above is the check. If live session updates stop, the cause is a column the handler reads that is missing from the grant list in section 2 (C3). Add that column to the grant and re-run.
- **R2. Revoked anon SELECT on companies.** Any live policy evaluated as `anon` or `authenticated` that reads `companies.admin_id` or `companies.teacher_code` from invoker context will now get "permission denied". Run query 1 and look for policies that reference `companies` (for example "Company admins can view enrollments", which only exists if the file history was patched live).
- **R3. Policies that reference companies or company_members as the invoker.** After the H7 change, admin checks use the SECURITY DEFINER helpers. Other policies that query `company_members` directly can still recurse. Query 1 shows them.
- **R4. H2 approach.** The public instructor read is dropped, not replaced by a view. If you want a public instructor directory later, create a view with only `id, full_name, avatar_url, bio` and grant it to `anon`.
- **R5. H6 stricter writes.** Course creation and update now need active tenant membership with a staff role. A teacher whose membership is `invited`, or whose academy is `suspended`, can no longer write. That is intended. Course creation in the app uses the service role, so this only affects direct API calls.
- **R6. Helper signature collision.** `is_company_staff` must stay identical to the ZAI Tutor version. Compare the bodies before applying (query 5).
- **R7. Migration history.** The file history does not replay (`RLS_AUDIT.md` section 1). This migration is written to run on the live state, not on a clean replay. Run it only after section 5 confirms the live policies.

## 8. Local verification

Harness (not committed): a Postgres 16 cluster with a production-shaped baseline, the Supabase stubs, and the creatable vulnerable policies from the audit. Results on that harness:

- Before the migration: 30 of 78 checks passed. The other 48 were attacks that succeeded (for example a learner setting their own role, an anon read of `teacher_code`, forged certificates and orders).
- After the migration, applied twice: 78 of 78 passed. The checks cover allowed use (learner profile edits, owner reads, service-role writes, `verify_certificate`, staff course creation, anon realtime columns) and denied use (privilege escalation, cross-tenant writes, staff of a suspended tenant).
- A fresh apply on a database without the legacy policies also succeeded.
