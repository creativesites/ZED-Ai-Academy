-- Migration: Site Assets Management
-- This table stores mapping of page keys to image URLs

CREATE TABLE IF NOT EXISTS public.site_assets (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text    UNIQUE NOT NULL,
  url         text    NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site assets"
  ON public.site_assets FOR SELECT USING (true);

CREATE POLICY "Only super admins can manage site assets"
  ON public.site_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Seed some initial data for common page images
INSERT INTO public.site_assets (key, url, description)
VALUES 
  ('home_hero', '/images/zed-ai-logo2.png', 'Logo used in header'),
  ('banner_image', '/images/20-Best-Fintech-Software-Development-Companies.webp', 'Main banner image on home page'),
  ('cta_image', '/images/pexels-kindel-media-6774143-scaled.jpg', 'CTA image for team training')
ON CONFLICT (key) DO NOTHING;
