# Zed AI Academy — Studio & Classroom Architecture & Production Plan

## Context

Zed AI Academy is a multi-tenant course platform built on Next 16, Clerk, Supabase and Vercel. Our own academy will be one tenant, and other academies run on the same code. The first offer is the "AI & Computer Literacy: Zero to Hero" programme: 10 cohort-style courses taught live, plus workshops. To deliver that we need a production-grade **live Studio** and **Classroom** where the lecturer picks the video provider (Jitsi, Zoom or Google Meet). There is no launch deadline, so the goal is to get it right, rebuilding parts where needed.

Decisions confirmed with you:
- Our academy becomes a **real tenant row**.
- **Google Meet:** each lecturer connects their Google account; the class opens in a new tab while our side panel stays open.
- **Zoom:** a **platform-owned account** at launch; each academy connecting its own Zoom comes later.
- **Scope:** Studio and Classroom, plus the critical platform fixes they depend on.

### Audit findings that drive this plan (read-only, verified in source)

**Security (blocking)**
- `jitsi/private-key.pk` is tracked in git.
- `src/actions/jitsi.ts`:
  - The browser decides whether a user is `moderator`.
  - Tokens use `room:'*'` and turn on recording and outbound calls for everyone.
  - The app ID and key ID are hard-coded, and the app ID is repeated in three client files.
- `ensureTenantMembership` is exported from a `"use server"` file (`src/actions/tenants.ts:67`). That makes it callable by anyone, so anyone can make themselves `company_admin`.
- `joinTenantBySlug` takes `role=teacher` from the form without checking the teacher code.
- `src/lib/tenants/access.ts:22-36` maps Clerk `org:admin` to `isSuperAdmin`.
- `classroom.ts`:
  - delete/duplicate schedule use `requireTenantMember("ignored")`.
  - group/attendance actions don't check that the child IDs belong to the tenant.
- `classroom-discussions.ts` has no tenant check.
- The legacy `api/zoom/signature` route and `src/data/getToken.ts` (host token, no auth) are still reachable.
- `public/zoom-bridge.html` accepts `postMessage` from any origin.
- The learn page sends `zoom_meetings(*)`, including the host `start_url` (stored as plaintext), to learners.

**Architecture**
- All server database access uses the service role (`src/lib/supabase/server.ts`), so RLS never applies.
- The browser Supabase client is anonymous, so Realtime under RLS can't be authorised.
- Live state is a set of booleans and IDs on `companies` (`is_session_active`, `active_room_name`, `active_session_id`, `active_schedule_id`).
- Sessions only end when someone clicks "End Session".
- There are two separate session systems:
  - classroom: `classroom_sessions` + `student_attendance`
  - 1:1 bookings: `live_session_bookings` + `zoom_meetings` + `live_session_attendance`
- The lesson `meeting-block.tsx` uses **Jitsi**, with the Zoom meeting ID as the room name.
- `src/actions/google-meet.ts` is dead code.

**Classroom bugs**
- `classroom/layout.tsx` redirects students away from their own classroom.
- `LiveSessionTab` unregisters all service workers and reloads the page on every visit.
- The timetable hides one-off schedules.
- Unscheduled sessions create duplicate attendance rows.
- Several buttons do nothing.
- Revalidate paths are wrong.

**Production hygiene**
- No tests, no CI and no `.env.example` (about 35 env vars in use).
- No error monitoring.
- Deploy logs and `scratch/` are committed.
- Some migrations probably fail on a fresh database (e.g. `student_attendance.profile_id uuid` referencing a text `profiles.id`).
- Tenant courses leak into the main catalog (`courses/page.tsx:144`).
- The PayChangu webhook doesn't verify the transaction with PayChangu.

**What "studio" means today:** four different things. In this plan, **Studio = the live teaching workspace.** The course builder stays "Course Builder", and the Practice Studio keeps its name.

### Do we need external tools like Google Meet?
No. **Jitsi as a Service (JaaS) embedded in our Studio is the default.** It is cheapest per class, gives full in-page control, and its webhooks give reliable attendance. Zoom is embedded too, for corporate clients and workshops. Google Meet is an optional, external-tab provider for lecturers who prefer it. Our own chat, Q&A, resources and attendance work the same whichever provider is used.

---

## Target architecture

### Domain model (one model for every teaching format)
```
Academy (companies row; ours included)
 └─ Classroom          persistent space: per course cohort, workshop series or coaching programme
     ├─ members        instructor | ta | learner (derived from enrolments plus explicit adds)
     ├─ Series         one-off | weekly recurring (replaces class_schedules recurrence)
     │   └─ LiveSession   one actual occurrence; provider snapshotted; state machine
     │        ├─ attendance_intervals (join/leave per person, source = webhook|client|manual)
     │        ├─ attendance (final status per person, computed + audited override)
     │        ├─ messages (chat / Q&A / announcements), hand_raises, polls (later)
     │        ├─ resources (shared files/links), agenda, notes (private / shared)
     │        └─ events (append-only audit)
     └─ announcements, discussions, resources
Workshop = Classroom with access_policy public|registered + registrations + capacity (+ price)
Coaching = existing booking flow; a confirmed booking creates a LiveSession (mode=coaching)
```
`mode` ∈ `class | workshop | coaching | office_hours` and changes only UI and policy, not the tables.

**Session states:** `draft → scheduled → live → ended`, and also `cancelled` and `failed`. Every transition goes through `transition(sessionId, to, actor)` in `src/lib/studio/domain/state-machine.ts`. The function rejects invalid transitions, is idempotent (a repeated call is a no-op), uses a row lock (`select … for update` inside an RPC) and writes a `session_events` row. A session stores both the planned and the actual start/end times.

**Auto-ending sessions:** a session never ends just because a tab closed. A Vercel cron runs every 5 minutes and also listens for provider "room destroyed" webhooks. It ends a session when the provider room is empty for more than 10 minutes, or when the planned end plus 60 minutes has passed. The lecturer is warned before this happens.

### Tenancy & authorisation
- **Clerk ↔ Supabase third-party auth** (native integration, no JWT template). With it, the browser Supabase client carries the Clerk session token, so RLS and Realtime authorisation actually work. Rewrite the RLS helpers to use `auth.jwt()->>'sub'` (text profile IDs).
- Server code keeps the service role but **always goes through one guard**: `src/lib/auth/authorize.ts → authorize(actor, action, resource)`.
  - The guard loads the resource and **derives the academy from the database row**, never from a `companyId` the client sends.
  - It then checks `company_members.role`.
  - Platform super admin is a separate, explicit check.
  - It replaces `requireTenantMember` / `requireTenantTeacher` (`src/lib/tenants/access.ts`).
- Roles: `company_members.role` ∈ `company_admin | instructor | ta | learner`. Merge `teacher` into `instructor`. Clerk org roles are used only for sign-in context and never grant academy permissions.
- Main academy: insert a `companies` row for Zed AI Academy, backfill `courses.company_id IS NULL` to it, and make the main catalog filter on that ID.

### Video provider layer — `src/lib/studio/providers/`
```
contracts.ts   VideoProviderAdapter, ProviderCapabilities, JoinPayload (discriminated union: embed-jitsi | embed-zoom | external-link)
registry.ts    resolveProvider(session) → adapter (session snapshot > classroom default > academy default)
jitsi/         room naming, RS256 JWT per room+role (env-loaded key), webhook verify + mapping
zoom/          S2S OAuth (reuse src/lib/zoom/api.ts), create/update/delete meeting, host ZAK, SDK signature (reuse src/lib/zoom-signature.ts), webhook verify
google-meet/   per-lecturer OAuth tokens, spaces.create (Meet REST v2) or Calendar conferenceData, post-session conferenceRecords.participants
```
`prepareMeeting(session)` runs when a session is scheduled or started and stores public meeting metadata in `live_sessions.provider_meeting`. Secrets go in a separate service-only table. `authorizeJoin(session, actor)` works out the role **on the server** and returns a short-lived payload.

| | Jitsi (JaaS) | Zoom (platform account) | Google Meet |
|---|---|---|---|
| Experience | Embedded (`@jitsi/react-sdk` JaaSMeeting, `disableDeepLinking`) | Embedded (Meeting SDK **Component View** inside our stage; replaces the `zoom-bridge.html` iframe) | External tab; our Studio panel stays open |
| Join auth | JWT: `room` = exact room name, `moderator` from server, recording etc. only for host, expires in 15 min (rejoin issues a fresh one) | SDK signature (role from server); lecturer joins as host using a **ZAK** for a pooled host user, so they need no Zoom account | Meet's own access; we only hand out the link to authorised users |
| Room ID | `vpaas-magic-cookie-…/{academySlug}-{sessionUUID}` | Meeting created via REST under a host from the pool, which caps concurrent meetings | Space created through the lecturer's OAuth |
| Attendance | JaaS webhooks `PARTICIPANT_JOINED/LEFT`, `ROOM_DESTROYED` (trusted), plus client heartbeat | Zoom webhooks `meeting.participant_joined/left`, `meeting.ended` | `conferenceRecords.participants` after the session where the account allows; otherwise self check-in plus lecturer confirmation |
| Low-bandwidth | `resolution: 360`, audio-only toggle | Built into the SDK | Meet's own settings |

**Provider settings**
- `academy_provider_settings`: enabled providers and the default.
- `lecturer_integrations`: Google OAuth refresh token, encrypted with pgcrypto using a server key or Supabase Vault, and never selectable by the client.
- Platform JaaS and Zoom credentials are env-only.

**Service-worker hack:** it exists because `public/coi-serviceworker.js` (COOP/COEP, used by the old Zoom Video SDK) breaks the Jitsi iframe. Fix:
- delete the coi worker and the Zoom Video SDK packages;
- ship a one-off, **scoped** unregister that only removes a registration whose `scriptURL` ends in `coi-serviceworker.js`, with no reload loop;
- remove the global unregister code from `LiveSessionTab` and `Videochat`.

### Realtime
- Each live session has one private Supabase Realtime channel `studio:{sessionId}`, authorised by RLS on `realtime.messages` (session participants only). It carries:
  - **Presence:** who has the Studio open.
  - **Broadcast:** ephemeral signals such as hand raise, "resource shared", state change.
- Durable data (chat, Q&A, attendance) is written to tables first, and then broadcast.
- On reconnect the client reloads state from the server.
- This replaces the shared `'company-session'` channel.

### Studio route & UX
- Route: `src/app/(marketing)/academy/[domain]/studio/[sessionId]/page.tsx`. It has its own full-screen layout, outside the tenant admin layout.
- Tenant subdomains already rewrite to `/academy/{slug}`, so the URL is `{academy}.zedai…/studio/{id}`.
- Components live in `src/components/studio/`:
  - `StudioShell`: top bar with title, state, timer, provider badge, connection status, a **Leave** button, and a separate host-only **End session for everyone** button with confirmation.
  - `PreJoin`: camera and mic preview with device pick, permission-denied help, a network check, and "audio-only / data saver" (important for data-bundle users).
  - `WaitingRoom`: a learner who arrives before `live` sees a countdown and the agenda.
  - `VideoStage`: renders a `JitsiStage`, `ZoomStage` or `ExternalMeetPanel` from the `JoinPayload`.
  - `SidePanel`: collapsible on desktop, a bottom sheet on mobile. Tabs:
    - **People** (presence + attendance; host can mark)
    - **Chat**
    - **Q&A** (upvote, mark answered; the workshop default)
    - **Resources** (share a file or link live)
    - **Agenda & Notes** (private by default)
  - `HostControls`: start, end, mute-all/remove where the provider's capabilities allow, attendance sheet, and "workshop mode" (chat off, Q&A only).
  - `PostSession`: attendance review and correction (audited), publish notes and resources, and a recap visible in the Classroom history.
- Capability flags hide controls the provider can't support. We never show a control that won't work.

### Classroom (rework of `src/components/classroom/*`)
- Keep the `ClassroomTabs` shell and tab components and point them at the new model:
  - **Live** becomes "Next / current session" cards that link to the Studio. The embedded meeting is removed from the tab.
  - **Timetable** shows series plus generated occurrences, including one-offs. Times are stored in UTC and shown in the academy's timezone (default `Africa/Lusaka`).
  - **History** reads from `live_sessions`.
  - **Students**: wire up or remove the dead buttons.
  - The **Discussions** tab gets tenant-checked.
- An academy can have **many classrooms** (one per course cohort or workshop). The current company-wide classroom becomes the academy's default classroom during migration.
- Fix the student redirect in `classroom/layout.tsx`.
- Mobile: no more than 5 bottom-nav tabs, with the rest under "More", plus safe-area handling.

### Workshops
- Public event page on the academy subdomain: `academy/[domain]/workshops/[slug]`.
- Registration with capacity and a waitlist.
- Optional payment through `src/lib/payments/`. Access is granted only from a **server-verified** payment.
- Reminder emails with an `.ics` attachment. WhatsApp reminders come later.
- A registration grants access to that workshop's classroom only.

### Data model (new migration set; reuse where marked)
- **New tables:**
  - `classrooms` (academy_id, course_id?, title, slug, mode_default, default_provider, timezone, access_policy, status)
  - `classroom_members` (classroom_id, profile_id, role)
  - `session_series` (classroom_id, kind, rrule-lite: weekdays + start time + duration, start/end date)
  - `live_sessions` (academy_id, classroom_id, series_id?, booking_id?, mode, status, provider, title, agenda, planned_start/end, actual_start/end, provider_meeting jsonb validated, created_by)
  - `live_session_secrets` (service-only)
  - `session_attendance_intervals`, `session_attendance` (status present/late/absent/excused/unknown, computed_seconds, override_by, override_reason)
  - `session_messages` (kind chat|question|announcement), `session_resources`, `session_notes`, `session_events`
  - `workshop_registrations`
  - `academy_provider_settings`, `lecturer_integrations`
  - `provider_webhook_events` (idempotency on provider event ID)
- **Reused:** `companies`, `company_members`, `announcements`, `classroom_groups*`, `live_session_services`, availability tables, `live_session_bookings`. Booking confirmation creates a `live_sessions` row.
- **Migrated, then dropped later:**
  - `class_schedules` → `session_series` / `live_sessions`
  - `classroom_sessions` + `student_attendance` → new attendance tables
  - `zoom_meetings` → `provider_meeting` + secrets
  - `live_session_attendance` → intervals
  - The `companies.active_*` and `is_session_active` columns become a read-only view, `academy_current_session`, during the transition.
- Every tenant table carries `academy_id`, guarded by a consistency trigger or composite FK against its parent. Add indexes on `(academy_id, status, planned_start)`.

---

## Phases (each phase = one or more PRs; exit gate must pass before the next)

### Phase 0 — Security & hygiene (start immediately)
1. **You:** rotate the JaaS key in the 8x8 console. **Me:** remove `jitsi/` and the root `private-key.pk`, add `*.pk` and `jitsi/` to `.gitignore`, and load `JAAS_APP_ID`, `JAAS_KEY_ID` and `JAAS_PRIVATE_KEY` (base64 PEM) from env. Rewriting git history is optional; rotation is what actually closes the leak.
2. Move `ensureTenantMembership` into a non-action module (`src/lib/tenants/membership.ts`).
3. `joinTenantBySlug`:
   - require a valid teacher code for elevated roles;
   - never downgrade an existing role;
   - replace the default code `'0000'` with a random per-academy code.
4. Fix the role mapping in `access.ts`: Clerk `org:admin` no longer means super admin.
5. Fix the classroom actions: proper guards on delete/duplicate, ownership checks on child IDs, and a tenant check in discussions.
6. Lock down Jitsi token issuance:
   - the server decides the role from classroom membership;
   - the token is bound to one exact room;
   - host-only features;
   - 15-minute expiry.
7. Delete or close off the legacy and debug code:
   - `api/zoom/signature`, `src/data/getToken.ts`, `src/actions/zoom.ts`
   - the `/test` routes, `Videochat*`, `src/middleware-test.ts`, `scratch/`, `*.log`, `deployment_*.txt`
   - check the origin in `zoom-bridge.html`, or remove it in Phase 2
   - stop sending `zoom_meetings(*)` to clients.
8. Fix the main catalog leak by filtering on the main academy ID, or `company_id is null` until Phase 1.
9. Tooling:
   - add `.env.example`;
   - Vitest (unit), Playwright (e2e smoke), `typecheck` script;
   - GitHub Actions CI: lint + typecheck + unit + build;
   - Sentry for Next.js.

**Exit gate:** CI green, every item above covered by a unit test where testable, and a manual check that a learner can no longer get a moderator token.

### Phase 1 — Foundation
- Turn on Clerk third-party auth in Supabase, and wire the browser client with `accessToken: () => session.getToken()`.
- `authorize()` module plus a test matrix covering roles × academies, including cross-academy access attempts.
- Create the main academy tenant row and backfill.
- New schema migrations, including RLS and the Realtime publication/policies, plus the `transition()` RPC.
- Fix any migrations that break on a fresh database. **Gate:** `supabase db reset` works locally from zero.
- Compatibility view `academy_current_session` so the old UI keeps working.

**Exit gate:** tenant-isolation tests pass, state-machine tests pass (invalid transitions, duplicate calls, concurrent start), and existing pages still render.

### Phase 2 — Providers
- Jitsi, Zoom and Google Meet adapters behind the contract.
- Webhook routes in `src/app/api/webhooks/{jaas,zoom}/route.ts`: check the signature, store idempotently in `provider_webhook_events`, then map to attendance intervals and room state.
- Google OAuth connect page for lecturers under academy settings.
- Zoom host-pool allocation.
- Remove `@zoom/videosdk*`, `coi-serviceworker`, and the `zoom-bridge.html` approach.

**Exit gate:** in a staging tenant, a real session on each provider can be started, joined by two accounts, rejoined and ended, and the attendance intervals recorded match reality.

### Phase 3 — Studio
- Studio route and components (above); Realtime channel; chat, Q&A, hand-raise, resources, notes; pre-join; waiting room; post-session review.
- Mobile layout, and handling for interruptions: reload, network drop, rotation, permission denied.

**Exit gate:** Playwright runs the full flow (lecturer starts, learner joins, chat and Q&A, share a resource, learner leaves and rejoins, lecturer ends, attendance review), with the provider stubbed. A manual run on a real Android phone over mobile data.

### Phase 4 — Classroom, scheduling, workshops, coaching
- Multiple classrooms per academy and the reworked tabs.
- Series → generated occurrences, with cancel and reschedule of a single occurrence.
- Workshops: public page, registration, capacity, payment verification, `.ics` and email reminders.
- Booking confirmation creates a `LiveSession`; implement reschedule, cancel, complete and no-show.
- Retire the old tables once the compatibility view has no consumers left.

**Exit gate:** an academy admin can run a 6-week cohort and a one-off paid workshop end to end without touching the database by hand.

### Phase 5 — Hardening & pilot
- Security pass on all of this: role escalation, expired tokens, webhook replay.
- Load test with 50 learners in a single JaaS room.
- Error states, monitoring dashboards, and a backup/restore drill.
- **Pilot:** run our free *Computer Basics* cohort as our academy, with a feature flag per academy, then open it to other tenants.

### Later (deliberately postponed)
- Recordings: JaaS `RECORDING_UPLOADED` → storage, and Zoom cloud recordings, with consent and retention.
- AI session summaries (Claude) from notes, Q&A and transcripts, opt-in per academy.
- Polls and in-class quizzes, breakout rooms, per-academy Zoom OAuth, attendance analytics.

### Launch track (runs alongside Phases 3–5; content work, not studio code)
- Add `courses.duration_label` / `delivery` (self-paced | cohort) and show prices in ZMW.
- Seed the 10 courses under the main academy, using the free and paid prices from the flyer.
- Each cohort course links to a classroom and series.
- Confirm PayChangu's ZMW and MoMo support, or switch to Flutterwave behind `src/lib/payments/`.
- Make the webhook call the provider's verify endpoint and check amount and currency.

---

## Existing code to reuse
- `src/components/classroom/ClassroomTabs.tsx` and the tab components (UI shell).
- `TimetableTab.tsx`, which is fully responsive.
- `src/lib/live-sessions/slots.ts` (slot generation).
- `src/actions/live-sessions.ts` (the booking flow).
- `src/lib/zoom/api.ts` (S2S OAuth plus token cache; add update/delete).
- `src/lib/zoom-signature.ts`.
- The `@jitsi/react-sdk` `JaaSMeeting` usage in `LiveSessionTab.tsx:379-401`.
- The tenant layout and subdomain rewrite in `src/middleware.ts`.
- `src/lib/payments/paychangu.ts` behind the payments abstraction.

## How to verify end to end
- **Each PR:** `npm run lint && npm run typecheck && npm test && npm run build` in CI.
- **Database:** `supabase db reset` from zero, then the RLS/tenant-isolation tests (Vitest against local Supabase), with Academy A users trying to read and write Academy B's sessions, messages, attendance and resources.
- **Providers:** a staging Vercel preview plus a staging tenant. Manually run each provider with two browsers (lecturer and learner) and one Android phone. Check that the `provider_webhook_events` rows and the attendance intervals line up.
- **E2E:** a Playwright scenario for the full class lifecycle and the workshop registration flow.
- **Pilot:** one real free cohort before turning it on for other academies.

## Progress

### Phase 0 — done in this branch
- Removed the committed JaaS key (`jitsi/`). Keys now come from env (`JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY`); see `.env.example`.
- JaaS tokens are minted only by `src/lib/jitsi/token.ts` (server-only):
  - bound to one exact room;
  - 15-minute expiry;
  - recording and livestreaming only for moderators;
  - outbound calls are off.
- `src/actions/jitsi.ts` exposes `getClassroomJitsiToken(companyId)` and `getBookingJitsiToken(bookingId)`. In both, the room and the moderator flag are decided on the server.
- Room names are generated on the server (`newRoomName`). `toggleClassroomSession` is idempotent and records `duration_seconds`.
- `ensureTenantMembership` has moved to `src/lib/tenants/membership.ts`. It is no longer a public server action, and it never downgrades a role.
- `joinTenantBySlug` always joins as learner. Staff go through onboarding with the academy code.
- Clerk `org:admin` no longer counts as super admin. `company_members` is the source of truth.
- Classroom actions check that groups, schedules and students belong to the academy. Delete/duplicate schedule are authorized against the owning academy. Discussions require membership. Self-attendance only counts for the live session.
- Students can open their classroom (the layout redirect loop is fixed).
- Legacy and debug code removed:
  - the unauthenticated Zoom signature route and Video SDK token
  - the `/test/[slug]` Videochat page and the global service-worker unregister/reload hack
  - `coi-serviceworker`, the `@zoom/videosdk*` packages, deploy logs and `scratch/`.
- The Zoom bridge only talks to its own origin. Learners no longer receive Zoom host or start-url data.
- The main catalog shows only platform courses. Search input can't inject PostgREST filters.
- Staff codes are now random per academy (migration `20261010000000_random_teacher_codes.sql`) and shown to academy admins in Settings. Branding changes require a teaching role.
- Tooling:
  - `npm run typecheck`, `npm test` (Vitest);
  - GitHub Actions CI: typecheck, test, build, with lint reported but not blocking until the existing lint debt is paid down.

**Still open from Phase 0**
- Sentry, which needs a DSN.
- Playwright smoke tests, which come with the Phase 3 Studio.
- The remaining `/test` builder prototypes.
- Global `instructor` access in `admin-enrollments.ts`, which comes with the Phase 1 `authorize()` work.

**Operator actions required**
1. In the 8x8 JaaS console, **revoke the old key and create a new API key**. The old private key was in git history and must be treated as public.
2. In Vercel, set `JAAS_APP_ID`, `JAAS_KEY_ID` and `JAAS_PRIVATE_KEY` (base64 of the new PEM).
3. Apply the new migration in Supabase.
4. Optional: purge `jitsi/private-key.pk` from git history. Rotating the key is what actually closes the leak.
