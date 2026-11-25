-- ============================================================
-- Stream F: adaptive teacher runtime (P2-04 graded interactions, P2-05 session state + teaching policy,
-- P2-06 context window, summaries and shared prompt caches). Architecture §3.3–3.5.
--
-- Additive and idempotent. The app reads/writes every column below only when present and falls back to
-- today's behaviour (no state, no policy, inline system prompt, no token telemetry) when it is missing,
-- so code can ship before this migration is applied.
-- ============================================================

-- P2-05: server-owned session state (versioned jsonb, see src/lib/tutor/runtime/state.ts). Null = not
-- tracked yet; the app recomputes from turns. It never holds answer keys (learners can read their own
-- tutor_sessions rows under RLS); keys live in tutor_pending_checks below.
alter table public.tutor_sessions
  add column if not exists state jsonb;

comment on column public.tutor_sessions.state is
  'Teacher runtime SessionState (src/lib/tutor/runtime/state.ts, v=1): objectives, strategy, pending check reference, rolling summary. Advisory only; never holds answer keys.';

-- P2-04: server-held answer keys for graded interactions (ask_choice/ask_order/ask_fill/ask_numeric).
-- Server-only: RLS on with NO policies, so neither learners nor staff can read keys through the Data API;
-- only the service role (server routes) reads and writes. A check is single-use (answered_at) and only
-- the session's latest turn's checks are open (enforced in app code, runtime/interactions.ts).
create table if not exists public.tutor_pending_checks (
  session_id uuid not null references public.tutor_sessions(id) on delete cascade,
  check_id text not null,
  turn_idx integer not null,
  kind text not null check (kind in ('choice', 'order', 'fill', 'numeric')),
  prompt text not null default '',
  objective text,
  spec jsonb not null,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  result text check (result is null or result in ('correct', 'partial', 'misconception')),
  score numeric(4, 3),
  primary key (session_id, check_id)
);

alter table public.tutor_pending_checks enable row level security;

comment on table public.tutor_pending_checks is
  'Answer keys for server-graded tutor interactions (P2-04). Service role only: never expose through RLS.';

-- P2-04 / P2-05 / P2-06 per-turn telemetry.
alter table public.tutor_turns
  add column if not exists policy_move text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists cached_tokens integer,
  add column if not exists ungraded_checks smallint;

comment on column public.tutor_turns.policy_move is 'Teaching-policy move recommended for this turn (advisory), null = none.';
comment on column public.tutor_turns.input_tokens is 'Model prompt tokens for this turn (flat after turn 8 with the context window).';
comment on column public.tutor_turns.cached_tokens is 'Prompt tokens served from the shared context cache.';
comment on column public.tutor_turns.ungraded_checks is 'Answerable events the model sent without a usable answer key (shown ungraded).';

-- P2-05: optional persona teaching philosophy that biases the policy
-- ({ defaultStrategy, hintGenerosity, strictness, languageMix, formality }; see runtime/strategies.ts).
alter table public.ai_personas
  add column if not exists teaching_philosophy jsonb;

-- P2-06: shared Gemini context caches, so every server instance reuses one cache per prompt prefix.
-- key = sha256(model + prefix). provider_name = the provider's handle (e.g. cachedContents/abc).
-- Server-only: RLS on with no policies, so only the service role (server code) can read or write it.
create table if not exists public.ai_prompt_caches (
  key text primary key,
  provider text not null default 'gemini',
  provider_name text not null,
  model text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_prompt_caches_expires_at_idx on public.ai_prompt_caches (expires_at);

alter table public.ai_prompt_caches enable row level security;

comment on table public.ai_prompt_caches is
  'Shared provider context-cache handles for tutor prompt prefixes (P2-06). Service role only; expired rows are ignored and overwritten.';
