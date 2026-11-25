-- CS Learn (CreativeSites Learn) rebrand — data + defaults only, no schema changes.
-- The platform tenant keeps its technical identifiers (slug 'zedai', org id); only display data changes.
-- Guarded so values an admin has already customised are left alone. Idempotent: safe to re-run.

BEGIN;

-- 1. Platform tenant display name + brand colour.
UPDATE public.companies
SET name = 'CS Learn'
WHERE slug = 'zedai'
  AND name IN ('Zed AI Academy', 'ZED AI Academy', 'Zed AI');

UPDATE public.companies
SET primary_color = '#075BEB'
WHERE slug = 'zedai'
  AND (primary_color IS NULL OR lower(primary_color) = '#fd5523');

-- 2. Defaults for new tenants / cohorts / folders use CS Learn Royal Blue.
ALTER TABLE public.companies ALTER COLUMN primary_color SET DEFAULT '#075BEB';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'classroom_groups' AND column_name = 'color') THEN
    EXECUTE 'ALTER TABLE public.classroom_groups ALTER COLUMN color SET DEFAULT ''#075BEB''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'classroom_folders' AND column_name = 'color') THEN
    EXECUTE 'ALTER TABLE public.classroom_folders ALTER COLUMN color SET DEFAULT ''#075BEB''';
  END IF;
END $$;

-- 3. Blog author byline.
ALTER TABLE public.blog_posts ALTER COLUMN author_name SET DEFAULT 'CS Learn Team';
UPDATE public.blog_posts SET author_name = 'CS Learn Team' WHERE author_name = 'Zed AI Team';

-- 4. CMS logo asset seeded with the old Zed AI logo.
UPDATE public.site_assets
SET url = '/brand/cs-learn-logo-on-dark.png'
WHERE key = 'home_hero'
  AND url IN ('/images/zed-ai-logo2.png', '/images/zed-ai-logo.png');

UPDATE public.site_assets
SET url = '/brand/cs-learn-logo-on-light.png'
WHERE key = 'site_logo'
  AND url IN ('/images/logo-dark.png', 'images/logo-dark.png', 'assets/images/logo.png', '/images/zed-ai-logo.png', '/images/zed-ai-logo2.png');

COMMIT;
