-- Migration: Add site settings and platform tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_platforms (
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  last_seen_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, platform)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_platforms ENABLE ROW LEVEL SECURITY;

-- Admin check function (useful for RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (auth.jwt() ->> 'sub')
      AND role IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies for site_settings
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings" ON public.site_settings
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read site settings" ON public.site_settings
  FOR SELECT USING (true);

-- Policies for user_platforms
DROP POLICY IF EXISTS "Users can read own platforms" ON public.user_platforms;
CREATE POLICY "Users can read own platforms" ON public.user_platforms
  FOR SELECT USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Admins can see all platforms" ON public.user_platforms;
CREATE POLICY "Admins can see all platforms" ON public.user_platforms
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage platforms" ON public.user_platforms;
CREATE POLICY "Service role can manage platforms" ON public.user_platforms
  FOR ALL USING (true); -- Usually for webhooks/server-side updates

-- Insert initial setting for onboarding course if it doesn't exist
INSERT INTO public.site_settings (key, value)
VALUES ('onboarding_course_id', '"00000000-0000-0000-0000-000000000000"')
ON CONFLICT (key) DO NOTHING;
