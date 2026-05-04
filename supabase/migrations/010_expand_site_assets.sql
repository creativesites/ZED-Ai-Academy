-- Add page column and more data to site_assets
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS page text NOT NULL DEFAULT 'other';

-- Update existing data
UPDATE public.site_assets SET page = 'home' WHERE key IN ('home_hero', 'banner_image', 'cta_image');

-- Insert more assets for various pages
INSERT INTO public.site_assets (key, url, description, page)
VALUES 
  ('site_logo', 'assets/images/logo.png', 'Global site logo', 'global'),
  ('about_hero', 'https://images.unsplash.com/photo-1758612214917-81d7956c09de?w=800&q=80&auto=format&fit=crop', 'Main image on about page', 'about'),
  ('about_secondary', 'https://images.unsplash.com/photo-1499914485622-a88fac536970?w=600&q=80&auto=format&fit=crop', 'Secondary image on about page', 'about'),
  ('faq_image', 'assets/images/resources/faq-v1-img1.jpg', 'Image on the FAQ section', 'faq'),
  ('contact_image', 'https://images.unsplash.com/photo-1534536281715-e28d76689b4d?w=800&q=80&auto=format&fit=crop', 'Contact page side image', 'contact'),
  ('pricing_cta', 'https://images.unsplash.com/photo-1758691737583-e4cbfbc78377?w=500&q=80&auto=format&fit=crop', 'Image on pricing page CTA', 'pricing'),
  ('auth_bg', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80&auto=format&fit=crop', 'Background for auth pages', 'auth')
ON CONFLICT (key) DO NOTHING;
