-- Clerk Organizations Sync migration
-- This migration updates companies and company_members to support Clerk's text-based organization IDs (org_...)

-- 1. Drop existing constraints
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_admin_id_fkey;
ALTER TABLE public.company_members DROP CONSTRAINT IF EXISTS company_members_company_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_company_id_fkey;

-- 2. Alter column types
ALTER TABLE public.companies ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.companies ALTER COLUMN admin_id TYPE text USING admin_id::text;
ALTER TABLE public.company_members ALTER COLUMN company_id TYPE text USING company_id::text;
ALTER TABLE public.profiles ALTER COLUMN company_id TYPE text USING company_id::text;

-- 3. Restore constraints
ALTER TABLE public.companies 
  ADD CONSTRAINT companies_admin_id_fkey 
  FOREIGN KEY (admin_id) REFERENCES public.profiles(id);

ALTER TABLE public.company_members 
  ADD CONSTRAINT company_members_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id);

-- 4. Sync name from name to Clerk's display name if needed (logic in webhook)
