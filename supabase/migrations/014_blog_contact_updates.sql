-- Create contact_entries table
CREATE TABLE IF NOT EXISTS public.contact_entries (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    NOT NULL,
  email       text    NOT NULL,
  subject     text,
  message     text    NOT NULL,
  status      text    NOT NULL DEFAULT 'unread', -- unread, read, archived
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Create blog_comments table
CREATE TABLE IF NOT EXISTS public.blog_comments (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     text    NOT NULL, -- Use slug or ID
  user_id     uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text,
  email       text,
  content     text    NOT NULL,
  parent_id   uuid    REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

-- Policies for contact_entries
CREATE POLICY "Anyone can submit contact entries" ON public.contact_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view contact entries" ON public.contact_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Policies for blog_comments
CREATE POLICY "Anyone can view comments" ON public.blog_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can post comments" ON public.blog_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete their own comments" ON public.blog_comments FOR DELETE USING (auth.uid() = user_id);

-- Expand site_assets even more
INSERT INTO public.site_assets (key, url, description, page)
VALUES 
  ('home_banner_2', 'assets/images/20-Best-Fintech-Software-Development-Companies.webp', 'Secondary banner image on home', 'home'),
  ('home_cta_bg', 'assets/images/pexels-kindel-media-6774143-scaled.jpg', 'Background for home CTA', 'home'),
  ('about_hero_main', 'assets/images/resources/about-v1-img1.jpg', 'Main hero image for About page', 'about'),
  ('about_sub_1', 'assets/images/resources/about-v1-img2.jpg', 'Secondary image for About page', 'about'),
  ('contact_hero', 'https://images.unsplash.com/photo-1534536281715-e28d76689b4d?w=1200&q=80', 'Hero image for Contact page', 'contact'),
  ('blog_hero', 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80', 'Hero image for Blog page', 'blog'),
  ('courses_hero', 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80', 'Hero image for Courses page', 'courses')
ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url;
