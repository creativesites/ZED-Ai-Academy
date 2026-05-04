-- Expanded site assets for all pages
INSERT INTO public.site_assets (key, url, description, page)
VALUES 
  ('home_hero', 'assets/images/resources/hero-v2-img1.jpg', 'Main hero image on home page', 'home'),
  ('home_about_img', 'assets/images/resources/about-v1-img1.jpg', 'About section image on home', 'home'),
  ('home_cta_img', 'assets/images/pexels-kindel-media-6774143-scaled.jpg', 'CTA section image on home', 'home'),
  ('about_hero', 'assets/images/resources/about-v1-img1.jpg', 'Hero image for about page', 'about'),
  ('about_mission_img', 'assets/images/resources/about-v1-img2.jpg', 'Mission section image on about page', 'about'),
  ('contact_hero', 'https://images.unsplash.com/photo-1534536281715-e28d76689b4d?w=1200&q=80', 'Hero image for contact page', 'contact'),
  ('blog_hero', 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80', 'Hero image for blog page', 'blog'),
  ('courses_hero', 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80', 'Hero image for courses page', 'courses'),
  ('pricing_hero', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80', 'Hero image for pricing page', 'pricing')
ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url, description = EXCLUDED.description, page = EXCLUDED.page;
