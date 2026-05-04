-- Migration: Switch from Supabase Auth UUIDs to Clerk text user IDs
-- Run this AFTER setting up Clerk and BEFORE any users sign in via Clerk.
-- Safe to run on a fresh/dev database.

-- ============================================================
-- 1. Drop ALL RLS policies on affected tables
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can upsert profiles" ON profiles;

-- courses
DROP POLICY IF EXISTS "Instructors can manage own courses" ON courses;
DROP POLICY IF EXISTS "Instructors can create courses" ON courses;
DROP POLICY IF EXISTS "Instructors can update own courses" ON courses;
DROP POLICY IF EXISTS "Instructors can delete own courses" ON courses;
DROP POLICY IF EXISTS "Published courses are public" ON courses;

-- modules
DROP POLICY IF EXISTS "Course owners can manage modules" ON modules;
DROP POLICY IF EXISTS "Published modules visible to enrolled users" ON modules;
DROP POLICY IF EXISTS "Published modules visible to all" ON modules;

-- lessons
DROP POLICY IF EXISTS "Course owners can manage lessons" ON lessons;
DROP POLICY IF EXISTS "Enrolled users can view lessons" ON lessons;
DROP POLICY IF EXISTS "Published lessons visible to enrolled or preview" ON lessons;

-- content_blocks
DROP POLICY IF EXISTS "Course owners can manage content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Enrolled users can view content blocks" ON content_blocks;

-- enrollments
DROP POLICY IF EXISTS "Users can view own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Users can enroll themselves" ON enrollments;
DROP POLICY IF EXISTS "Users can update own enrollments" ON enrollments;

-- lesson_progress
DROP POLICY IF EXISTS "Users can manage own progress" ON lesson_progress;

-- quizzes
DROP POLICY IF EXISTS "Instructors can manage quizzes" ON quizzes;
DROP POLICY IF EXISTS "Course owners can manage quizzes" ON quizzes;
DROP POLICY IF EXISTS "Enrolled users can view quizzes" ON quizzes;

-- quiz_questions
DROP POLICY IF EXISTS "Instructors can manage quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Course owners can manage quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Enrolled users can view quiz questions" ON quiz_questions;

-- quiz_attempts
DROP POLICY IF EXISTS "Users can manage own quiz attempts" ON quiz_attempts;

-- certificates
DROP POLICY IF EXISTS "Users can view own certificates" ON certificates;
DROP POLICY IF EXISTS "System can insert certificates" ON certificates;
DROP POLICY IF EXISTS "Users can insert own certificates" ON certificates;
DROP POLICY IF EXISTS "Users can update own certificates" ON certificates;

-- orders
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;

-- company_members
DROP POLICY IF EXISTS "Members can view own company" ON company_members;
DROP POLICY IF EXISTS "Members can view own company membership" ON company_members;
DROP POLICY IF EXISTS "Admins can manage members" ON company_members;
DROP POLICY IF EXISTS "Company admins can manage members" ON company_members;

-- bookmarks
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON bookmarks;

-- notes
DROP POLICY IF EXISTS "Users can manage own notes" ON notes;

-- subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;

-- ============================================================
-- 2. Drop trigger + function that created Supabase auth profiles
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- ============================================================
-- 3. Drop ALL foreign keys that reference profiles.id
--    (must happen before we change profiles.id type)
--    Using IF EXISTS so this is safe to re-run.
-- ============================================================

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

-- ============================================================
-- 4. Change column types: uuid → text
-- ============================================================

-- profiles.id  (the root — must come first since others FK to it)
ALTER TABLE profiles ALTER COLUMN id TYPE text USING id::text;

-- companies
ALTER TABLE companies ALTER COLUMN admin_id TYPE text USING admin_id::text;

-- company_members  — column is profile_id, NOT user_id
ALTER TABLE company_members ALTER COLUMN profile_id TYPE text USING profile_id::text;

-- courses
ALTER TABLE courses ALTER COLUMN instructor_id TYPE text USING instructor_id::text;

-- enrollments
ALTER TABLE enrollments ALTER COLUMN user_id TYPE text USING user_id::text;

-- lesson_progress
ALTER TABLE lesson_progress ALTER COLUMN user_id TYPE text USING user_id::text;

-- quiz_attempts
ALTER TABLE quiz_attempts ALTER COLUMN user_id TYPE text USING user_id::text;

-- bookmarks
ALTER TABLE bookmarks ALTER COLUMN user_id TYPE text USING user_id::text;

-- notes
ALTER TABLE notes ALTER COLUMN user_id TYPE text USING user_id::text;

-- certificates
ALTER TABLE certificates ALTER COLUMN user_id TYPE text USING user_id::text;

-- orders
ALTER TABLE orders ALTER COLUMN user_id TYPE text USING user_id::text;

-- subscriptions  (user_id is nullable)
ALTER TABLE subscriptions ALTER COLUMN user_id TYPE text USING user_id::text;

-- ============================================================
-- 5. Add email column to profiles (Clerk provides it)
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- ============================================================
-- 6. Recreate RLS policies using Clerk JWT sub claim
--    auth.jwt() ->> 'sub'  returns the Clerk user ID string
-- ============================================================

-- profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = (auth.jwt() ->> 'sub'));

-- Webhook uses service role which bypasses RLS, so INSERT just needs to be open
CREATE POLICY "Service role can upsert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- courses
CREATE POLICY "Instructors can create courses"
  ON courses FOR INSERT
  WITH CHECK (instructor_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Instructors can update own courses"
  ON courses FOR UPDATE
  USING (instructor_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Instructors can delete own courses"
  ON courses FOR DELETE
  USING (instructor_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Published courses are public"
  ON courses FOR SELECT
  USING (status = 'published' OR instructor_id = (auth.jwt() ->> 'sub'));

-- modules
CREATE POLICY "Course owners can manage modules"
  ON modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = modules.course_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = modules.course_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Published modules visible to all"
  ON modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = modules.course_id
        AND courses.status = 'published'
    )
  );

-- lessons
CREATE POLICY "Course owners can manage lessons"
  ON lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Published lessons visible to enrolled or preview"
  ON lessons FOR SELECT
  USING (
    is_preview = true
    OR EXISTS (
      SELECT 1 FROM enrollments e
      JOIN modules m ON m.course_id = e.course_id
      WHERE m.id = lessons.module_id
        AND e.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

-- content_blocks
CREATE POLICY "Course owners can manage content blocks"
  ON content_blocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE lessons.id = content_blocks.lesson_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE lessons.id = content_blocks.lesson_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Enrolled users can view content blocks"
  ON content_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN enrollments e ON e.course_id = modules.course_id
      WHERE lessons.id = content_blocks.lesson_id
        AND e.user_id = (auth.jwt() ->> 'sub')
    )
  );

-- enrollments
CREATE POLICY "Users can view own enrollments"
  ON enrollments FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Users can enroll themselves"
  ON enrollments FOR INSERT
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Users can update own enrollments"
  ON enrollments FOR UPDATE
  USING (user_id = (auth.jwt() ->> 'sub'));

-- lesson_progress
CREATE POLICY "Users can manage own progress"
  ON lesson_progress FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- quizzes
CREATE POLICY "Course owners can manage quizzes"
  ON quizzes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE lessons.id = quizzes.lesson_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE lessons.id = quizzes.lesson_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Enrolled users can view quizzes"
  ON quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN enrollments e ON e.course_id = modules.course_id
      WHERE lessons.id = quizzes.lesson_id
        AND e.user_id = (auth.jwt() ->> 'sub')
    )
  );

-- quiz_questions
CREATE POLICY "Course owners can manage quiz questions"
  ON quiz_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
        AND courses.instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Enrolled users can view quiz questions"
  ON quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      JOIN modules ON modules.id = lessons.module_id
      JOIN enrollments e ON e.course_id = modules.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
        AND e.user_id = (auth.jwt() ->> 'sub')
    )
  );

-- quiz_attempts
CREATE POLICY "Users can manage own quiz attempts"
  ON quiz_attempts FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- certificates
CREATE POLICY "Users can view own certificates"
  ON certificates FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Users can insert own certificates"
  ON certificates FOR INSERT
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Users can update own certificates"
  ON certificates FOR UPDATE
  USING (user_id = (auth.jwt() ->> 'sub'));

-- orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- bookmarks
CREATE POLICY "Users can manage own bookmarks"
  ON bookmarks FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- notes
CREATE POLICY "Users can manage own notes"
  ON notes FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

-- company_members  — column is profile_id (not user_id)
CREATE POLICY "Members can view own company membership"
  ON company_members FOR SELECT
  USING (profile_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Company admins can manage members"
  ON company_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
        AND cm.profile_id = (auth.jwt() ->> 'sub')
        AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
        AND cm.profile_id = (auth.jwt() ->> 'sub')
        AND cm.role = 'admin'
    )
  );
