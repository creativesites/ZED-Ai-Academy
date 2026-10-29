# Apply the security fix (RLS hardening)

This file is the short version of `docs/SECURITY_RLS.md`, for running in the **Supabase SQL editor**
(Dashboard → SQL Editor → New query). Do the steps in order. Steps 1 and 3 only read.

The migration runs inside `BEGIN … COMMIT`. If any statement fails, nothing is changed.

## Step 0: backup

Dashboard → Database → Backups. Check that a backup from today exists, or create one if your
plan allows it.

## Step 1: pre-check (read only)

Paste and run this. Every row should say `ok = true`. If any row says `false`, stop and send the
output to Claude.

```sql
with
types as (
  select table_name || '.' || column_name as item, data_type
  from information_schema.columns
  where table_schema = 'public'
    and (table_name, column_name) in (
      ('companies','id'), ('companies','admin_id'),
      ('company_members','profile_id'), ('company_members','company_id'),
      ('courses','company_id'), ('courses','instructor_id'),
      ('certificates','user_id'), ('orders','user_id'), ('profiles','id'))
),
fns as (
  select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('is_company_staff','is_tenant_role','verify_certificate')
)
select 'id column type: ' || item as check, data_type as value, (data_type = 'text') as ok from types
union all
select 'tables present', count(*)::text, count(*) = 9
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('profiles','enrollments','companies','certificates','orders','courses',
                       'company_members','user_platforms','notifications')
union all
select 'existing helper: ' || proname || '(' || args || ')', 'will be replaced',
       args in ('p_company_id text', 'p_company_id text, p_roles text[]', 'p_public_id text')
  from fns
union all
select 'super_admin accounts (check you know each one)',
       coalesce(string_agg(coalesce(email, id), ', '), 'none'), true
  from public.profiles where role = 'super_admin';
```

Check the last row by hand. Every super admin listed must be you, or someone you know. An unknown
super admin means someone has already used the hole: remove their role (Step 4b) before going on.

## Step 2: apply

Open `supabase/migrations/20261028000000_rls_hardening.sql` on GitHub, click **Raw**, copy all of
it, paste it into a new query, and run it. Expect "Success. No rows returned".

## Step 3: post-check (read only)

```sql
select 'profiles: columns learners may update' as check,
       string_agg(column_name, ', ' order by column_name) as value
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
union all
select 'companies: secret columns readable by the public key (expect none)',
       coalesce(string_agg(column_name, ', '), 'none')
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'companies' and grantee = 'anon'
  and privilege_type = 'SELECT'
  and column_name in ('teacher_code','admin_id','suspended_reason','suspended_at')
union all
select 'new policies present (expect 5)', count(*)::text
from pg_policies
where schemaname = 'public'
  and policyname in ('Users can update own profile','Users can view own certificates',
                     'Tenant staff can create own courses','Tenant staff can update own courses',
                     'Company admins can manage members');
```

Expect:
- `avatar_url, bio, full_name`
- `none`
- `5`

## Step 4: rotate staff codes

The old codes may already be known. This gives every academy a new 6-digit code, which academy
admins can see on their Staff page.

```sql
update public.companies
set teacher_code = (100000 + floor(random() * 900000))::int::text;
```

4b (only if Step 1 showed an unknown super admin):

```sql
update public.profiles set role = 'student' where email = '<the unknown email>';
```

## Step 5: smoke test on the live site (5 minutes)

1. As a learner, edit your profile name. It saves.
2. Open an academy page (`/academy/<slug>`). The name, logo and colours load.
3. As a teacher, create a draft course in your academy. It saves.
4. Open the Classroom → Live tab. Start a session as the teacher and watch the student view update.
   This is the one change that could behave differently on the live database (risk R1 in
   `docs/SECURITY_RLS.md`).
5. Open a certificate page, if you have one.

If step 4 breaks, send Claude the browser console error. The fix is one `GRANT` line, and the
rest of the hardening stays in place.
