-- Allow instructors to manage site assets as well
DROP POLICY IF EXISTS "Only super admins can manage site assets" ON public.site_assets;

CREATE POLICY "Admins and Instructors can manage site assets"
  ON public.site_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'instructor')
    )
  );
