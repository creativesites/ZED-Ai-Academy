# ZAI Tutor session API

Server API for ZAI Tutor sessions (the AI voice teacher). Every route needs a Clerk session (401 otherwise). Bodies are validated with zod and errors are JSON `{ error, ... }`.

Modes: **live** (Gemini Live over a single-use token), **voice** (turn audio, transcribe, structured JSON, TTS), **text** (typed turns, structured JSON, TTS).

## Routes

### `POST /api/tutor/sessions`: start a session

Body:

```json
{
  "origin": "lesson | assignment | practice",
  "scenarioId": "uuid (optional)",
  "lessonId": "uuid (required for lesson)",
  "assignmentId": "uuid (required for assignment)",
  "micPermission": "granted | denied | prompt",
  "rttMs": 120
}
```

`ask` and `placement` origins are not accepted yet.

Response 200, live:

```json
{
  "sessionId": "uuid",
  "mode": "live",
  "liveToken": "auth_tokens/...",
  "liveModel": "gemini-3.8-live",
  "liveTokenExpiresAt": "ISO timestamp",
  "persona": { "id", "name", "displayName", "languages", "riveVariant" },
  "scenario": { "id", "title", "goal", "maxMinutes" }
}
```

Response 200, voice or text: the same without `liveToken`, `liveModel`, `liveTokenExpiresAt`, plus `"openingEvents": [TeacherEvent]` (the teacher's first turn, with `audioUrl` on `say` events).

| Status | Meaning |
|---|---|
| 400 | Invalid body (for example a lesson origin without `lessonId`). |
| 401 | Not signed in. |
| 403 | `reason` says why: `not_tenant_member`, `tenant_inactive`, `not_enrolled`, `scenario_not_in_library`, `practice_disabled`, `free_minutes_exhausted`, `lesson_course_mismatch`, `assignment_scenario_mismatch`, `assignment_not_for_learner`, `scenario_not_published`, `persona_unavailable`, `no_modes_allowed`. |
| 404 | `reason` is `scenario_not_found`, `lesson_not_found` or `assignment_not_found`. |
| 429 | More than 30 session starts in the last hour (`Retry-After: 3600`). |
| 500 | The session row or its context could not be created. |
| 502 | The opening turn failed. The session is marked `abandoned`. Retry with a new start. |

### `GET /api/tutor/sessions/[id]`

Response 200:

```json
{
  "session": { "id", "origin", "mode", "status", "scenarioId", "lessonId", "assignmentId", "startedAt", "endedAt", "learnerSpeakingMs", "teacherSpeakingMs", "sharedWithTeacher", "viewer": "learner | staff" },
  "turns": [{ "idx", "learner_text", "learner_audio_ms", "events", "latency_ms", "created_at" }],
  "report": null
}
```

The learner sees their own session. Tenant staff see it only when it is a lesson or assignment session, the learner shared it, or it is flagged. Anyone else gets 404, as does an unknown id.

### `POST /api/tutor/sessions/[id]/turn`: Voice and Text turns

Send either JSON `{ "text": "..." }` (1 to 1000 characters) or `multipart/form-data` with an `audio` file (webm, ogg or wav, 2 MB at most). Not both.

Response 200:

```json
{ "turnIdx": 3, "learnerText": "transcript or typed text", "events": [TeacherEvent], "ended": false, "endReason": null }
```

`endReason` is `time_box`, `turn_limit` or `model_end` when `ended` is true. Past the time box or 60 turns, the session ends with an `end_session` event and no transcription or model call.

| Status | Meaning |
|---|---|
| 400 | Invalid body, empty text, or both text and audio. |
| 401 | Not signed in. |
| 404 | Unknown session, or not the learner's. |
| 409 | Session not active, a Live session (use `/events`), or a turn index collision. Retry. |
| 413 | Audio over 2 MB. |
| 415 | Audio type other than webm, ogg or wav. |
| 422 | Audio contained no speech. |
| 502 | The model or TTS failed. The turn was not stored. |

### `POST /api/tutor/sessions/[id]/events`: Live event sync

Live sessions only. Post the transcript in batches (20 turns per call at most):

```json
{ "turns": [{ "idx": 0, "learnerText": "optional", "events": [TeacherEvent], "latencyMs": 800 }] }
```

Events are validated. Invalid ones are dropped and counted. Rows upsert on `(session_id, idx)`, and a repeated idx in one batch keeps the last copy.

Response 200: `{ "saved": 2, "dropped": 0 }`.

| Status | Meaning |
|---|---|
| 400 | Invalid body. |
| 401 | Not signed in. |
| 404 | Unknown session, or not the learner's. |
| 409 | Not a Live session, or session not active. |
| 500 | Storage failed. Retry the batch (it is idempotent). |

### `POST /api/tutor/sessions/[id]/complete`

```json
{ "learnerSpeakingMs": 61000, "teacherSpeakingMs": 30000, "status": "completed | abandoned" }
```

Generates the report synchronously and applies learner-level effects. Response 200: `{ "report": {...}, "created": true }`.

Idempotent. A second call returns the stored report with `"created": false` and changes nothing. A flagged or already completed session keeps its status. Flush Live events before calling this.

| Status | Meaning |
|---|---|
| 400 | Invalid body. |
| 401 | Not signed in. |
| 404 | Unknown session, or not the learner's. |
| 502 | The report could not be generated. No report was stored, so call again. |

## Event shapes

Teacher events follow `src/lib/tutor/events.ts`: `say`, `gesture`, `mood`, `show_card`, `show_text`, `trace_tone`, `listen`, `note_mistake`, `advance_scene`, `end_session`.

`say` events get `audioUrl` when TTS succeeds. A model turn with no valid event gets a fallback: one spoken apology in the session's language (with an English `translation` for zh, es and fr) and a `gesture` `think`.

Stored `events` may end with a `{ "type": "debug_raw_output", "raw": "..." }` entry when the model's reply was unusable. This entry is outside the contract. Clients must ignore unknown event types. It is never sent back to the model.

## Live client connection

The server mints the token in `liveToken`. The client must:

1. Create the SDK client with the token as the API key and the v1alpha API version:
   `new GoogleGenAI({ apiKey: liveToken, httpOptions: { apiVersion: "v1alpha" } })`.
2. Connect with `model: liveModel` and no config overrides. The token locks the model, system prompt, tools, voice, audio response, transcription and context compression.
3. Respect the token limits: one use (`uses: 1`), expiry at `liveTokenExpiresAt` (30 minutes), and a new session must start within 2 minutes of minting. Session resumption does not count as a second use.
4. Post transcripts and events to `/events` in batches, then call `/complete` with the measured speaking times.

Token minting is metered as a zero-unit `llm` row. Audio seconds are metered on `/complete` as `live_audio_in` and `live_audio_out`.

## Known limitations

1. **Platform scenarios use the learner's home tenant.** For `visibility = platform`, the session is recorded under `profiles.company_id`. Confirm this for learners with several memberships.
2. **Free-practice minutes count after completion.** Speaking time is client-reported, so a session still in progress does not count toward the monthly allowance.
3. **Streaks use UTC days**, not the learner's timezone.
4. **Side effects can partly fail after the report is claimed.** Usage, profile and vocabulary writes run after the report row is stored. If one of them fails, a retry will not re-apply it, and the gap needs a manual fix.
5. **`ask` and `placement` origins are not supported** by `POST /api/tutor/sessions` yet.
6. **`next_scenario_id` is always null** in reports.
7. **Not built here:** the learner-facing client, the Live client wiring described above, and a unit test for `sessionLimitReason` (it is covered through the pipeline tests).
8. **Gemini and Supabase paths are type-checked only.** The transcription model, TTS output format and Live token flow have not been exercised against the live API.
