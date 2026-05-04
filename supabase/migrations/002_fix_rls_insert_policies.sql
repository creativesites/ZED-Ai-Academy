-- ============================================================
-- Fix missing INSERT / UPDATE RLS policies
-- ============================================================

-- Enrollments: authenticated users can enroll themselves
CREATE POLICY "Users can insert own enrollment"
  ON public.enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Enrollments: allow updating own enrollment (e.g. marking completed_at)
CREATE POLICY "Users can update own enrollment"
  ON public.enrollments FOR UPDATE
  USING (user_id = auth.uid());

-- Certificates: authenticated users can insert their own certificate
CREATE POLICY "Users can insert own certificate"
  ON public.certificates FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Certificates: allow updating own certificate (e.g. file_url)
CREATE POLICY "Users can update own certificate"
  ON public.certificates FOR UPDATE
  USING (user_id = auth.uid());

-- Orders: authenticated users can create their own orders
CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Orders: allow updating own order status
CREATE POLICY "Users can update own orders"
  ON public.orders FOR UPDATE
  USING (user_id = auth.uid());
