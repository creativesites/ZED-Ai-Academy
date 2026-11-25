-- ============================================================
-- P1-03: record which tutor event contract version produced each turn.
-- CONTRACT_VERSION lives in src/lib/tutor/contract/index.ts (2 at the time of writing).
-- NULL = written before this column existed (contract v1 or v2).
--
-- Additive and idempotent. The app writes this column when present and falls back to
-- the old insert when it is missing, so code can ship before this migration is applied.
-- ============================================================

alter table public.tutor_turns
  add column if not exists contract_version smallint;

comment on column public.tutor_turns.contract_version is
  'Tutor event contract version (src/lib/tutor/contract CONTRACT_VERSION) used for this turn; null = before tracking.';
