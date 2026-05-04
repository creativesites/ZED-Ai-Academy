-- ============================================================
-- Page media slots and blog posts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.page_media_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key      text NOT NULL,
  slot_key      text NOT NULL,
  label         text NOT NULL,
  description   text,
  image_url     text,
  media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  alt_text      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_media_slots_page_slot_unique UNIQUE (page_key, slot_key)
);

CREATE INDEX IF NOT EXISTS page_media_slots_page_key_idx
  ON public.page_media_slots (page_key);

ALTER TABLE public.page_media_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read page media slots" ON public.page_media_slots;
CREATE POLICY "Anyone can read page media slots"
  ON public.page_media_slots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins and Instructors can manage page media slots" ON public.page_media_slots;
CREATE POLICY "Admins and Instructors can manage page media slots"
  ON public.page_media_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'instructor')
    )
  );

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE,
  title              text NOT NULL,
  excerpt            text NOT NULL,
  category           text NOT NULL,
  author_name        text NOT NULL DEFAULT 'Zed AI Team',
  read_time          text NOT NULL,
  tags               jsonb NOT NULL DEFAULT '[]'::jsonb,
  content            jsonb NOT NULL DEFAULT '[]'::jsonb,
  card_image_url     text,
  card_media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  hero_image_url     text,
  hero_media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'published',
  published_at       timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS blog_posts_status_published_at_idx
  ON public.blog_posts (status, published_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published blog posts" ON public.blog_posts;
CREATE POLICY "Anyone can read published blog posts"
  ON public.blog_posts FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Admins and Instructors can manage blog posts" ON public.blog_posts;
CREATE POLICY "Admins and Instructors can manage blog posts"
  ON public.blog_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'instructor')
    )
  );

INSERT INTO public.page_media_slots (page_key, slot_key, label, description, image_url, alt_text)
VALUES
  ('global', 'breadcrumb_background', 'Breadcrumb Background', 'Background image used in the shared page header across marketing pages.', '/assets/images/backgrounds/page-header-bg.jpg', 'Decorative background pattern'),
  ('home', 'banner_primary', 'Home Banner Image', 'Primary image in the home page hero section.', 'https://images.unsplash.com/photo-1604933762021-54a5858c9832?w=1200&q=80&auto=format&fit=crop', 'Professional using AI tools'),
  ('home', 'about_primary', 'Home About Primary', 'Primary image in the home about section.', 'https://images.unsplash.com/photo-1587614382231-d1590f0039e7?w=800&q=80&auto=format&fit=crop', 'Professional learning AI skills'),
  ('home', 'about_secondary', 'Home About Secondary', 'Secondary image in the home about section.', 'https://images.unsplash.com/photo-1762341119317-fb5417c18407?w=600&q=80&auto=format&fit=crop', 'Zambian professionals using AI'),
  ('home', 'cta_primary', 'Home CTA Image', 'Main image in the home CTA section.', 'https://images.unsplash.com/photo-1704652838446-edc4448d6261?w=800&q=80&auto=format&fit=crop', 'Team training on AI skills'),
  ('about', 'hero_primary', 'About Hero Image', 'Main image on the about page hero section.', 'https://images.unsplash.com/photo-1758612214917-81d7956c09de?w=1200&q=80', 'About page hero image'),
  ('faq', 'feature_primary', 'FAQ Feature Image', 'Feature image displayed beside the FAQ accordion.', '/assets/images/resources/faq-v1-img1.jpg', 'AI learning Zambia')
ON CONFLICT (page_key, slot_key) DO NOTHING;
