# World-Class AI Teacher — Decisions, Trade-offs, Risks and Open Questions

Status: proposal, 2026-11-24. Each decision is **Proposed** until the owner marks it **Accepted** or **Rejected**
(edit the status line). Referenced as D-xx from the other documents.

---

## Decision log

### D-01 · Consolidate, don't rewrite — Proposed
**Context.** Six tutor runtime paths, five flow editors, three voice stacks (audit §3, §5).
**Decision.** Keep `runTutorTurn(deps)`, the event contract, finalize, and the pure `lib/tutor` modules as the
foundation. Migrate other paths onto them (dock → `ask` origin; stress-test → Simulation Lab; editors → one Flow
Editor).
**Alternatives.** Rewrite on an agent framework (rejected: the core is sound and tested; a framework adds abstraction
without solving the real problems, which are memory, evidence and authz). Leave the dock separate (rejected: violates
"one teacher", no metering, no evidence).
**Consequences.** Migration work with flags and parity checklists rather than new code from scratch.

### D-02 · Stay on Gemini; add a thin provider interface — Proposed
**Context.** `CLAUDE.md` says Claude; the code is 100% Gemini (`src/lib/ai/`). Gemini supplies Live (realtime voice),
TTS, transcription and explicit context caching in one vendor, which the voice-first teacher depends on.
**Decision.** Gemini remains the default for all tasks. Introduce `src/lib/ai/provider.ts` + `aiCall()` so that any
*text* task can be routed to another provider (e.g. Claude for authoring or as an independent eval judge) by adding an
adapter, without touching call sites. Update `CLAUDE.md` to stop saying Claude is the default.
**Alternatives.** Switch authoring to Claude now (deferred: no evidence of a quality gap yet; Simulation Lab will provide
that evidence). Multi-provider routing gateway (Vercel AI Gateway) — reasonable later for fallbacks and spend
visibility, but it does not cover Gemini Live/TTS, so it does not remove the adapter.
**Open.** Owner to confirm. A second provider is most valuable as a **judge** (independent of the tutor model).

### D-03 · Model tiers per task — Proposed
Cheap model for summaries, memory extraction and learner simulation; fast-smart for turns and reports; smart for
authoring; realtime for Live; judge ≠ tutor model where possible. All defaults env-overridable (exists). Quarterly model
review runs the golden set before switching defaults.

### D-04 · Streaming JSON for Ask, with automatic fallback — Proposed
**Context.** The dock streams text; the runtime returns structured JSON.
**Decision.** Stream structured output and parse events incrementally. If a model or response fails incremental
parsing, fall back to non-streaming for that turn and show a "thinking" gesture immediately.
**Alternative.** Keep a plain-text stream for Ask and post-process into events (rejected: two contracts again).
**Risk.** Latency regression for Ask → acceptance criterion in P1-05 (≤ +300 ms p95).

### D-05 · Evolve `learner_mastery` and `learner_evidence` in place — Proposed
**Context.** Requirement: no parallel databases. The current tables are close to right but keyed on free text.
**Decision.** Add `objective_id`, weighting and scheduling columns; change the unique key to include `company_id`;
dual-write legacy `level` during transition; backfill. No new "mastery v2" table.
**Trade-off.** Some legacy rows never map to registered objectives; they remain as `legacy` keys, visible but
down-weighted and excluded from institutional aggregates.

### D-06 · Explainable weighted-evidence mastery now; BKT/IRT later — Proposed
**Context.** Need confidence, recency, decay, difficulty and source weighting, but there is little response data yet.
**Decision.** The update rule in Architecture §4.2 (exponential update with source/difficulty weights, confidence from
evidence mass, stability-based decay, FSRS-like scheduling). Parameters in one config file; parity-tested TS + SQL.
**Alternatives.** Bayesian Knowledge Tracing (needs per-skill parameter fitting; revisit at ~10k responses per
objective family). IRT/Elo item difficulty (needed for adaptive exams — Phase 5 gate). LLM-estimated mastery (rejected:
opinion, not evidence).
**Consequence.** Mastery values are interpretable to learners and staff ("why is this 'practising'?").

### D-07 · No vector database (for now) — Proposed
**Context.** Lesson content ≤24k chars fits in context; memory is small and structured per learner.
**Decision.** Deterministic retrieval: lesson content by lesson id, course outline by course id, memory by kind/recency,
Postgres full-text search for course-wide "where was this covered?" lookups.
**Trigger to revisit.** Course-wide Ask needs to cite across > ~200k chars of content with measurable misses in Lab
grounding judges, or semantic memory retrieval shows clear quality wins. Then use **pgvector in the same Supabase
database**, not a new service.

### D-08 · Keep service-role server access; harden with an authz layer and tests — Proposed
**Context.** All server code bypasses RLS by design (`src/lib/supabase/server.ts`). Moving to RLS-enforced user clients
needs a Clerk JWT template on every request and a large policy audit.
**Decision.** Keep the model for now (it is consistent and fast), but make it safe: one authz layer, tenant derived
from resources, `assertRefsInTenant` everywhere, a role × action test matrix, and RLS kept correct as defence in depth.
**Alternative.** Learner-facing reads via an RLS-bound client (Clerk JWT) — worth doing for the highest-risk learner
reads (memory, mastery) in Phase 2 if the authz tests reveal recurring mistakes.
**Risk.** One forgotten check = data leak. Mitigation: lint rule / code review checklist: "any action taking an id must
call authz".

### D-09 · Durable background execution for long AI jobs — Proposed
**Context.** Simulation Lab runs (~150 calls) and Autopilot batches (up to 24 calls) exceed comfortable request
lifetimes; failures mid-batch need resumption.
**Decision.** Use **Vercel Workflow** for Lab runs and Autopilot batches (durable steps, retries, survives deploys).
Simple post-session side effects stay on the Postgres outbox + `after()` + a scheduled sweeper (Vercel Schedules).
**Alternative.** Client-driven chunking (one request per persona) — acceptable fallback if Workflow adoption is
deferred; worse UX (tab must stay open).

### D-10 · Code execution in Vercel Sandbox only — Proposed
Programming widgets that run code use ephemeral Sandbox microVMs with no secrets, no network, strict timeouts and a
per-learner daily cap. Never execute learner code on the app server or with app credentials.

### D-11 · Rate limits and quotas in Postgres first — Proposed
In-memory limiters are per instance (ineffective on Fluid Compute). A Postgres `take_rate_limit()` function is enough
at current scale. Upstash Redis (Vercel Marketplace) if limiter queries show contention.

### D-12 · Teacher moments are the single placement model — Proposed
**Context.** `tutor_session` blocks and `teacher_moments` both place a teacher in a lesson and both gate completion.
**Decision.** New placements are moments only; existing `tutor_session` blocks keep rendering (never break content) and
the Flow Editor offers one-click conversion.
**Alternative.** Keep blocks only (rejected: moments support several placements per lesson and "after block X").

### D-13 · Who can do what in Studio — Proposed (owner input needed)
Today a course instructor who isn't tenant staff can create but not archive their flows, while any tenant teacher can
delete any flow. Proposal:
| Action | Course owner/co-author | Tenant teacher | Tenant admin |
|---|---|---|---|
| Edit/preview/test flows of their courses | ✓ | own courses | ✓ |
| Publish/archive flows of their courses | ✓ | own courses | ✓ |
| Personas, tenant settings, budgets | — | — | ✓ |
| Insights for their courses/classes | ✓ | own classes | ✓ |
| AI cost data | — | — | ✓ |

### D-14 · Certificate viva requires a human route — Proposed
**Context.** Pass/fail is decided by the AI alone; the gate fails open when misconfigured.
**Decision.** Outcomes `pass | needs_review | not_yet`; `needs_review` goes to staff; learners can request one human
review; misconfiguration shows an explicit state to staff instead of silently passing. Viva considers mastery evidence,
not one session's score.
**Why.** Certificates carry institutional reputation; an unappealable AI decision on a credential is an educational and
legal risk.

### D-15 · Local languages: bilingual support first, validated speech later — Proposed
**Context.** Bemba, Nyanja and Tonga packs exist; TTS/ASR quality for these languages is unverified.
**Decision.** Market local languages only after a validation programme (native-speaker educators rate explanation
correctness, TTS intelligibility, ASR word error rate on a fixed test set). Until then: "beta" label, and use local
languages for *explanations and encouragement* (bilingual support), not for speech *assessment*.
**Why.** Bad pronunciation feedback in a learner's home language erodes trust faster than not offering it.

### D-16 · Freeze avatar/scene expansion until Phase 2 lands — Proposed
Rive, Three.js and placeholder paths exist and are polished. New faces, scenes and 3D features add weight and do not
move learning outcomes. Performance work (lazy Rive, FPS guard) continues; new visual assets wait.

### D-17 · Memory scope: tenant-scoped learning data, global personal preferences — Proposed
Learning memory and mastery belong to the academy relationship (an employer must not see a learner's school data).
Device/accessibility preferences (voice/text, captions, speed, data saver, reduced motion) are global to the person.
A learner may explicitly copy goals between academies.

### D-18 · Evidence from Live sessions is not verified unless server-graded — Proposed
Live transcripts and events are posted by the client. Evidence derived from them is `teacher_judgement` (weight 0.5)
unless it is an interaction graded server-side. Billing uses server-measured time.

### D-19 · Public `/try` is opt-in per flow — Proposed
Tenant flows are publicly reachable only with `public_preview=true`, set by tenant staff. Platform showcase flows are
opted in by default.

---

## Challenges to the brief

The brief is directionally right. Where we recommend a different path:

1. **"Personal teacher who remembers everything" → "remembers what helps, visibly."** Unlimited memory is a privacy
   liability (especially for minors and employer-sponsored learners) and a prompt-injection surface. We recommend
   bounded, typed, learner-editable memory with retention limits. It is also cheaper and more accurate.
2. **"Teacher decides strategy dynamically" → "policy recommends, model teaches."** Pure LLM strategy selection is
   untestable and drifts. A small, explicit policy (unit-tested, A/B-able) plus model freedom within each move gives
   adaptivity you can evaluate.
3. **"Adaptive examinations" now → later.** Adaptive testing without calibrated item difficulty is not adaptive; it is
   random. Build the evidence base first (Phase 2), then adaptive practice, then adaptive exams (Phase 5).
4. **"Camera homework" is high value but should follow graded interactions.** It needs the same rubric/evidence
   plumbing and a human override; doing it first would create another one-off stack.
5. **"Collaborative learning"** — not recommended in this horizon (unclear outcome lift, heavy moderation).
6. **Feature velocity vs. trust.** The last 30 commits added many visible features while security and data-integrity
   debt accumulated. The roadmap deliberately starts with three sprints that add *no* visible features. This is the
   most important recommendation in the set.

---

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-01 | Cross-tenant data exposure before Phase 0 lands | Medium | Severe (B2B trust, legal) | S0.1 first; consider pausing new tenant onboarding until merged | Founder |
| R-02 | Unknown prod migration state causes silent feature gaps or failed inserts | High | Medium | P0-05 verification; stop silent `isSchemaUnavailableError` fallbacks for features marked live; startup schema check in a health route | Founder |
| R-03 | Gemini model/API changes (ids, schema limits, Live protocol) | Medium | High | `aiCall` choke point, fallback chains, golden set before switching, schema-limit guard test (exists) | Eng |
| R-04 | AI cost growth (quadratic history, Live, Lab runs, image turns) | Medium | High | Windowed context, shared caches, budgets with hard stops, per-plan caps, cost per outcome dashboard | Founder |
| R-05 | Mastery model mis-calibration demotivates learners or misleads staff | Medium | Medium | Conservative thresholds, evidence trail visible, learner can contest, review telemetry vs. quiz outcomes monthly | Eng/Ed |
| R-06 | Hallucinated or wrong teaching in published flows | Medium | High | Lab gates, grounding judge, staff sampling, "Report a problem" in session, rapid version rollback | Ed |
| R-07 | Learner manipulation of the AI to mark mastery | High (if unmitigated) | Medium | Server-graded interactions dominate weights; teacher judgement down-weighted | Eng |
| R-08 | Minors' data and images | Medium | Severe | Audience flag, stricter defaults, no images until policy, retention limits, staff visibility rules, DPA templates | Founder |
| R-09 | Low-end device performance makes the teacher unusable for core market | Medium | High | Compact presentation, lazy assets, FPS guard, JS budget enforced in CI (bundle analyser) | Eng |
| R-10 | Agent-parallel development collides (redesign agents + teacher agents) | High | Medium | File-ownership table per sprint (pattern from NEXT_PHASES_PLAN), HANDOFF log, small PRs | Founder |
| R-11 | Dirty working tree on `main` deployed by accident | Medium | Medium | Branch per work item; never commit WIP to `main`; CI check | Founder |
| R-12 | Local-language quality damages trust | Medium | Medium | D-15 validation programme | Ed |
| R-13 | Vendor lock-in to Gemini Live for voice | Medium | Medium | Voice/text turn mode always available as fallback (exists); provider interface for text | Eng |
| R-14 | Educator workload of reviewing AI drafts slows adoption | Medium | Medium | Good defaults, Lab gate replaces manual testing, batch review UI | Product |

---

## Unresolved questions for the owner

1. **Production schema:** which migrations are applied (P0-05)? Is `20261028000000_rls_hardening.sql` applied?
2. **Tenant onboarding:** pause new institutional tenants until S0.1 merges?
3. **Provider:** accept D-02 (Gemini default + interface)? Budget for a second provider as an eval judge?
4. **Retention defaults:** Ask conversations 90 days, episodes 12 months, evidence detail redaction at 12 months — acceptable?
   Any institutional or Zambian Data Protection Act (2021) requirements to encode?
5. **Minors:** which current tenants serve under-18 learners? Who signs off the minors policy?
6. **Staff visibility default:** should institutions be able to see private practice sessions by policy (opt-in at
   enrolment), or only shared/assignment sessions (current rule)?
7. **Viva:** required for certificates per course, or optional (current)? Who reviews `needs_review` in academies
   without active teachers?
8. **Budgets:** per-plan AI allowances (free, pro, institutional seat) — what monthly cost per learner is acceptable?
9. **Studio permissions:** accept the D-13 matrix?
10. **Local languages:** is there a partner school or linguist network for the D-15 validation programme?
11. **Redesign coordination:** should the teacher work wait for redesign B1/B2 (student shell) to merge, or proceed in
    parallel with the file-ownership split proposed in ROADMAP §1?
12. **Background jobs:** accept Vercel Workflow (D-09) as a new dependency for Lab and Autopilot?
