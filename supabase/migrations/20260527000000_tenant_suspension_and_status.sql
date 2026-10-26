-- Migration: Add status and suspension fields to companies for platform super admin control
BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended'));

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS suspended_reason text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);

COMMIT;
