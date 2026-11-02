-- Academy timezone.
--
-- Recurring classes store wall-clock times ("Mondays 09:00") and one-off classes store instants.
-- Both need to be interpreted in the academy's own timezone, not in whichever browser or server
-- happens to read them. Default matches the primary market (Zambia, UTC+2, no DST).
--
-- Reads happen server-side with the service role, so this column does not need to be added to the
-- anon/authenticated column grants introduced by 20261028000000_rls_hardening.sql.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Lusaka';

COMMENT ON COLUMN public.class_schedules.day_of_week IS
  'ISO weekday for recurring classes: 1 = Monday ... 7 = Sunday. (An earlier comment said 0 = Sunday; the application has always used 1-7.)';
