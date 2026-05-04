-- Add status, phone, and notes to enrollments for manual payment flow
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending_payment', 'active', 'revoked')),
  ADD COLUMN IF NOT EXISTS student_phone text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS enrollments_status_idx ON public.enrollments(status);

-- Allow service-role INSERT with any status (used by admin actions — service client bypasses RLS)
-- Allow users to insert their own enrollments (needed for manual enroll action called server-side as the user)
DROP POLICY IF EXISTS "Users can enroll in courses" ON public.enrollments;
CREATE POLICY "Users can insert own enrollments" ON public.enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid());
