-- ZAI Teacher Phase 3: Scale
-- Adds academy-branded teacher defaults on tutor_settings, optional per-course
-- Certificate Viva gating on courses, and viva outcome flag on tutor_reports.

alter table public.tutor_settings
  add column if not exists default_persona_id uuid references public.ai_personas(id) on delete set null,
  add column if not exists brand_look jsonb not null default '{}'::jsonb;

alter table public.courses
  add column if not exists require_certificate_viva boolean not null default false,
  add column if not exists viva_scenario_id uuid references public.practice_scenarios(id) on delete set null;

alter table public.tutor_reports
  add column if not exists viva_passed boolean;
