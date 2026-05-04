-- Migration: Recreate FK constraints dropped in 003_clerk_user_ids.sql
-- All user-column FKs now reference profiles.id as text (Clerk IDs).
-- The original profiles.id → auth.users.id FK is intentionally NOT recreated
-- since we are using Clerk (not Supabase Auth) to manage users.

-- Note: all UUID→text type changes already happened in migration 003.
-- These ADD CONSTRAINT calls will succeed once both sides are text.

-- profiles.id is the anchor — no FK needed (Clerk manages identity)

-- companies
ALTER TABLE companies
  ADD CONSTRAINT companies_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- company_members
ALTER TABLE company_members
  ADD CONSTRAINT company_members_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- courses
ALTER TABLE courses
  ADD CONSTRAINT courses_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- enrollments
ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- lesson_progress
ALTER TABLE lesson_progress
  ADD CONSTRAINT lesson_progress_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- quiz_attempts
ALTER TABLE quiz_attempts
  ADD CONSTRAINT quiz_attempts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- bookmarks
ALTER TABLE bookmarks
  ADD CONSTRAINT bookmarks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- notes
ALTER TABLE notes
  ADD CONSTRAINT notes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- certificates
ALTER TABLE certificates
  ADD CONSTRAINT certificates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- orders
ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- subscriptions (user_id is nullable — company plans have no direct user)
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
