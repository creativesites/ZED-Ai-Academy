-- Migration: Add branding fields to companies table

ALTER TABLE public.companies
ADD COLUMN primary_color text DEFAULT '#fd5523';

-- Add RLS policies for companies so subdomains can be resolved
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
CREATE POLICY "Anyone can view companies" ON public.companies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Company admins can update companies" ON public.companies;
CREATE POLICY "Company admins can update companies" ON public.companies FOR UPDATE USING (admin_id = auth.uid());

-- Add a column for custom subdomain if not using clerk's slug
-- (We use the 'slug' column already for the subdomain in middleware)
