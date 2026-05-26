# Clerk & Supabase Integration Guide

This document outlines the configuration required to integrate Clerk authentication with Supabase, allowing for Row Level Security (RLS) based on Clerk user IDs.

## 1. Clerk JWT Template

In the Clerk Dashboard (JWT Templates -> New Template -> Supabase), use the following JSON configuration:

```json
{
	"app_metadata": {},
	"aud": "authenticated",
	"email": "{{user.primary_email_address}}",
	"role": "authenticated",
	"user_metadata": "{{user.public_metadata}}",
	"user_id":"{{user.id}}",
	"academies": "{{user.organizations}}",
	"metadata": "{{user.unsafe_metadata}}"
}
```

## 2. Supabase Schema Requirements

Clerk user IDs (e.g., `user_2...`) are strings, not UUIDs. You must ensure your Supabase tables use `text` for user ID columns.

### Fix UUID Type Mismatch
If you see errors like `invalid input syntax for type uuid`, run the following SQL in your Supabase SQL Editor:

```sql
-- 1. Drop foreign keys that reference profiles.id
ALTER TABLE profiles          DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE companies         DROP CONSTRAINT IF EXISTS companies_admin_id_fkey;
ALTER TABLE company_members   DROP CONSTRAINT IF EXISTS company_members_profile_id_fkey;
ALTER TABLE courses           DROP CONSTRAINT IF EXISTS courses_instructor_id_fkey;
ALTER TABLE enrollments       DROP CONSTRAINT IF EXISTS enrollments_user_id_fkey;
ALTER TABLE lesson_progress   DROP CONSTRAINT IF EXISTS lesson_progress_user_id_fkey;
ALTER TABLE quiz_attempts     DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;
ALTER TABLE bookmarks         DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;
ALTER TABLE notes             DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
ALTER TABLE certificates      DROP CONSTRAINT IF EXISTS certificates_user_id_fkey;
ALTER TABLE orders            DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE subscriptions     DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

-- 2. Change column types to text
ALTER TABLE profiles ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE companies ALTER COLUMN admin_id TYPE text USING admin_id::text;
ALTER TABLE company_members ALTER COLUMN profile_id TYPE text USING profile_id::text;
ALTER TABLE courses ALTER COLUMN instructor_id TYPE text USING instructor_id::text;
ALTER TABLE enrollments ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE lesson_progress ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE quiz_attempts ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE bookmarks ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE notes ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE certificates ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE orders ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE subscriptions ALTER COLUMN user_id TYPE text USING user_id::text;

-- 3. (Optional) Recreate foreign keys if needed, ensuring target types match.
```

## 3. RLS Policies

Your RLS policies should use `auth.jwt() ->> 'sub'` to match the Clerk user ID:

```sql
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = (auth.jwt() ->> 'sub'));
```

## 4. Frontend Implementation

When initializing the Supabase client on the frontend, always provide the Clerk token:

```javascript
const token = await getToken({ template: 'supabase' });
const supabase = createClient(token);
```
