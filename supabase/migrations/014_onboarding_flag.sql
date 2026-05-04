-- Add onboarding_completed flag to profiles so every new account is
-- forced through the onboarding flow regardless of whether Clerk OAuth
-- already provided a full_name on first insert.

alter table profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Existing accounts that have a full_name are considered already onboarded.
update profiles
  set onboarding_completed = true
  where full_name is not null and full_name <> '';
