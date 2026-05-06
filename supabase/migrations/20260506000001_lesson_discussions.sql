-- Migration: Update Lesson Discussions System
-- Enables students to ask questions, mark them public/private, and allows for moderation.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discussion_status') THEN
        CREATE TYPE discussion_status AS ENUM ('pending', 'approved', 'flagged', 'hidden');
    END IF;
END $$;

-- Add new columns to existing discussions table
ALTER TABLE public.discussions 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS status discussion_status NOT NULL DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Add updated_at trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_discussions_updated_at') THEN
        CREATE TRIGGER set_discussions_updated_at BEFORE UPDATE ON public.discussions
          FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- Drop existing policies to refine them
DROP POLICY IF EXISTS "Enrolled users can read discussions" ON public.discussions;
DROP POLICY IF EXISTS "Enrolled users can post discussions" ON public.discussions;
DROP POLICY IF EXISTS "Users can update own posts" ON public.discussions;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.discussions;

-- Refined Policies for Discussions
-- 1. Selection Policy:
-- - Users can see their own discussions (public or private).
-- - Users can see public, approved discussions if they are enrolled in the course.
-- - Instructors can see all discussions in their courses.
CREATE POLICY "Refined select discussions"
ON public.discussions FOR SELECT
USING (
    (user_id = (auth.jwt() ->> 'sub')) -- Own posts
    OR (
        is_public = true 
        AND status = 'approved' 
        AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = discussions.course_id
            AND e.user_id = (auth.jwt() ->> 'sub')
        )
    ) -- Public approved posts in enrolled courses
    OR (
        EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = discussions.course_id
            AND c.instructor_id = (auth.jwt() ->> 'sub')
        )
    ) -- Instructor access
);

-- 2. Insertion Policy:
-- - Users can post if they are enrolled or the instructor.
CREATE POLICY "Refined insert discussions"
ON public.discussions FOR INSERT
WITH CHECK (
    (auth.jwt() ->> 'sub') = user_id
    AND (
        EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = discussions.course_id
            AND e.user_id = (auth.jwt() ->> 'sub')
        )
        OR EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = discussions.course_id
            AND c.instructor_id = (auth.jwt() ->> 'sub')
        )
    )
);

-- 3. Update Policy:
-- - Users can update their own posts.
-- - Instructors can moderate (update status).
CREATE POLICY "Refined update discussions"
ON public.discussions FOR UPDATE
USING (
    (auth.jwt() ->> 'sub') = user_id
    OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = discussions.course_id
        AND c.instructor_id = (auth.jwt() ->> 'sub')
    )
);

-- 4. Delete Policy:
-- - Users can delete their own posts.
-- - Instructors can delete anything in their courses.
CREATE POLICY "Refined delete discussions"
ON public.discussions FOR DELETE
USING (
    (auth.jwt() ->> 'sub') = user_id
    OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = discussions.course_id
        AND c.instructor_id = (auth.jwt() ->> 'sub')
    )
);
