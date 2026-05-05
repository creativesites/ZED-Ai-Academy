# Live Sessions, Zoom Studio, and Practice Exercise Plan

Date: 2026-05-04

## Purpose

Replace the current static live meeting block with a proper scheduling, confirmation, and embedded Zoom studio workflow. Also add lesson-level practice exercises as first-class content blocks with upload/text/studio submissions and AI scoring without pass/fail gates.

This document is the implementation plan before code changes. It is intentionally specific enough to turn into migrations, routes, components, and tickets.

## Current State

### Live sessions

The current live session implementation is a content block that asks the creator to manually enter a Zoom meeting ID.

Relevant files:
- `src/components/creator/blocks/meeting-block.tsx`
- `src/components/learner/lesson-player-client.tsx`
- `src/components/shared/zoom-meeting.tsx`
- `src/app/api/zoom/signature/route.ts`
- `src/lib/zoom-signature.ts`
- `package.json` includes `@zoom/meetingsdk`

Problems:
- There is no instructor availability model.
- There is no student booking request flow.
- There is no instructor confirmation flow.
- There is no Zoom meeting creation/update/delete lifecycle.
- The lesson content stores `meeting_id` directly, and some seeded content has blank IDs.
- The Zoom signature endpoint only checks that the user is signed in, not that the user is allowed to join that meeting.
- The current block cannot represent reschedules, cancellations, attendance, reminders, or booking history.
- There is no dedicated live session studio route. Zoom is embedded inside the lesson page.

Conclusion: keep the existing block only as a temporary compatibility path. The new system should be built around bookings and confirmed session instances.

### Practice Studio

The current Practice Studio is an overlay opened from the lesson player. It provides generic AI tools such as prompt optimization, workflow generation, social hooks, code explanation, and Midjourney prompts.

Relevant files:
- `src/components/learner/practice-studio.tsx`
- `src/app/api/ai/practice-studio/route.ts`
- `src/actions/practice.ts`
- `supabase/migrations/013_practice_sessions.sql`
- `supabase/migrations/20260504000002_project_submissions_bucket.sql`

Problems:
- Practice Studio is not driven by lesson content blocks.
- The current history is stored in browser `localStorage`, not reliable course progress data.
- There is no assignment definition, submission record, rubric, AI score, instructor review, or resubmission flow.
- `practice_sessions` was created after the Clerk user migration and still uses `uuid REFERENCES auth.users(id)`. The rest of the app uses Clerk user IDs as text in many places, so this table needs correction before relying on it.
- The project submissions bucket exists and can be reused or generalized, but there is no per-exercise submission table.

Conclusion: keep the generic Practice Studio as a tool surface, but add a new `practice_exercise` lesson block and a proper submission/scoring model.

## Product Direction

### Live Session Goal

Learners should be able to pick available times from a Calendly-like calendar. The instructor should confirm the request. After confirmation, the platform should create or attach a Zoom meeting and expose a secure on-site Live Session Studio where the learner and instructor join the session.

### Practice Exercise Goal

Creators should be able to add practical assignments inside lessons. A practice exercise can ask the learner to:
- complete an in-app Practice Studio task,
- submit screenshots or images,
- upload a PDF,
- paste text,
- upload another allowed file type,
- complete an offline phone/laptop task and submit evidence.

AI should score and give feedback, but there is no pass mark. Scores are used for guidance, instructor visibility, and learner reflection, not gating.

## Guiding Decisions

1. A live session is not a content block with a meeting ID. It is a scheduled booking with participants, status, Zoom data, and audit history.
2. Lesson content may reference a booking flow, but bookings should live independently so they can be rescheduled, cancelled, confirmed, and tracked.
3. Zoom has two distinct roles in the system:
   - Zoom REST API creates and manages meetings after confirmation.
   - Zoom Meeting SDK embeds the confirmed meeting inside the website.
4. The Zoom signature endpoint must authorize against a booking or session ID, not a raw meeting number.
5. Practice exercises are content blocks. Submissions and scores are separate records.
6. AI scoring has no pass/fail threshold. Store `score`, `feedback`, `rubric_breakdown`, `confidence`, and `needs_instructor_review`.
7. Files should be private Supabase Storage objects with signed URLs generated server-side only for authorized users.

## Live Sessions System

### Core User Flows

#### Learner booking flow

1. Learner opens a course or lesson live session CTA.
2. Learner sees available dates and time slots in their local timezone.
3. Learner selects a slot and optionally adds goals/questions.
4. System creates a booking request with status `requested`.
5. Instructor receives a notification.
6. Instructor confirms, declines, or proposes a new time.
7. On confirmation, the system creates a Zoom meeting and stores the meeting metadata.
8. Learner receives confirmation and reminders.
9. At session time, learner opens `/live-sessions/[bookingId]/studio`.

#### Instructor confirmation flow

1. Instructor opens Live Sessions dashboard.
2. Instructor reviews pending requests.
3. Instructor confirms a request.
4. System creates Zoom meeting via server-side Zoom REST API.
5. Status becomes `confirmed`.
6. Instructor can join the same studio route with host/co-host privileges.

#### Reschedule flow

1. Learner or instructor requests a new time.
2. Booking status becomes `reschedule_requested`.
3. Other party accepts or rejects.
4. If accepted, update the booking and Zoom meeting.
5. Preserve the old time in `live_session_events`.

### Booking Status Model

Use explicit statuses:
- `requested`
- `confirmed`
- `declined`
- `reschedule_requested`
- `cancelled_by_learner`
- `cancelled_by_instructor`
- `completed`
- `no_show`

Recommended transitions:
- `requested` -> `confirmed`
- `requested` -> `declined`
- `confirmed` -> `reschedule_requested`
- `reschedule_requested` -> `confirmed`
- `confirmed` -> `cancelled_by_learner`
- `confirmed` -> `cancelled_by_instructor`
- `confirmed` -> `completed`
- `confirmed` -> `no_show`

### Database Plan

#### `live_session_services`

Defines what can be booked.

Fields:
- `id`
- `instructor_id`
- `course_id` nullable
- `lesson_id` nullable
- `title`
- `description`
- `duration_minutes`
- `buffer_before_minutes`
- `buffer_after_minutes`
- `min_notice_hours`
- `max_booking_days`
- `requires_instructor_confirmation` default true
- `is_active`
- `created_at`
- `updated_at`

Use cases:
- 30-minute course Q&A.
- 45-minute project review.
- 60-minute private coaching session.
- Lesson-specific live clinic.

#### `instructor_availability_rules`

Weekly recurring availability.

Fields:
- `id`
- `instructor_id`
- `weekday` integer 0-6
- `start_time` time
- `end_time` time
- `timezone`
- `is_active`
- `created_at`
- `updated_at`

Example:
- Mondays, Wednesdays, Fridays, 09:00-12:00 Africa/Lusaka.

#### `instructor_availability_exceptions`

Overrides availability.

Fields:
- `id`
- `instructor_id`
- `date`
- `timezone`
- `start_time` nullable
- `end_time` nullable
- `kind` enum: `unavailable`, `extra_available`
- `reason`
- `created_at`

Use cases:
- Block a public holiday.
- Add extra Saturday office hours.

#### `live_session_bookings`

The central booking/request table.

Fields:
- `id`
- `service_id`
- `course_id` nullable
- `lesson_id` nullable
- `instructor_id`
- `learner_id`
- `status`
- `starts_at`
- `ends_at`
- `timezone`
- `learner_notes`
- `instructor_notes`
- `meeting_agenda` jsonb
- `confirmed_at`
- `declined_at`
- `cancelled_at`
- `completed_at`
- `created_at`
- `updated_at`

Indexes:
- `(instructor_id, starts_at)`
- `(learner_id, starts_at)`
- `(status, starts_at)`
- unique partial index to prevent double-booking confirmed/requested slots.

#### `zoom_meetings`

Stores Zoom meeting metadata for confirmed bookings.

Fields:
- `id`
- `booking_id` unique
- `zoom_meeting_id`
- `zoom_uuid`
- `host_id`
- `host_email`
- `topic`
- `start_url_encrypted` nullable
- `join_url`
- `password_encrypted` nullable
- `settings` jsonb
- `created_at`
- `updated_at`

Important:
- Do not expose `start_url` to learners.
- Prefer generating host access server-side for instructors only.
- Learners join through the Meeting SDK with a signed, authorized session payload.

#### `live_session_events`

Audit log for lifecycle events.

Fields:
- `id`
- `booking_id`
- `actor_id`
- `event_type`
- `metadata` jsonb
- `created_at`

Examples:
- `booking_requested`
- `booking_confirmed`
- `zoom_meeting_created`
- `booking_rescheduled`
- `booking_cancelled`
- `learner_joined`
- `instructor_joined`
- `session_completed`

#### `live_session_attendance`

Tracks actual join/leave data.

Fields:
- `id`
- `booking_id`
- `user_id`
- `role`
- `joined_at`
- `left_at`
- `duration_seconds`
- `client_metadata` jsonb

### Slot Generation

Slot generation should be server-side.

Inputs:
- `service_id`
- learner timezone
- date range

Process:
1. Load service duration, buffers, min notice, max booking window.
2. Load instructor weekly availability rules.
3. Apply availability exceptions.
4. Load existing active bookings.
5. Generate candidate slots in 15-minute increments.
6. Remove slots that overlap existing confirmed/requested/reschedule-pending bookings including buffers.
7. Return slots in learner timezone plus canonical UTC timestamps.

API shape:
```ts
GET /api/live-sessions/services/[serviceId]/slots?from=2026-05-04&to=2026-05-18&timezone=Africa/Lusaka
```

Response:
```json
{
  "timezone": "Africa/Lusaka",
  "days": [
    {
      "date": "2026-05-05",
      "slots": [
        {
          "starts_at": "2026-05-05T08:00:00.000Z",
          "ends_at": "2026-05-05T08:30:00.000Z",
          "label": "10:00"
        }
      ]
    }
  ]
}
```

### Zoom Integration Plan

Use two Zoom app capabilities:

1. Server-side Zoom REST API credentials for creating, updating, and deleting meetings.
2. Zoom Meeting SDK credentials for embedding confirmed meetings in the browser.

Zoom documentation checked while planning:
- Meeting SDK Component View supports embedding a meeting in a page component: https://marketplacefront.zoom.us/sdk/meeting/web/components/index.html
- Component View requires meeting details plus a generated SDK signature before joining: https://marketplacefront.zoom.us/sdk/meeting/web/components/index.html
- The embedded client exposes meeting controls/events we can use later for a richer studio: https://marketplacefront.zoom.us/sdk/meeting/web/components/modules/EmbeddedClient.html

Environment variables:
- `ZOOM_ACCOUNT_ID`
- `ZOOM_SERVER_CLIENT_ID`
- `ZOOM_SERVER_CLIENT_SECRET`
- `ZOOM_HOST_USER_ID` or instructor-level Zoom user mapping
- `ZOOM_MEETING_SDK_KEY`
- `ZOOM_MEETING_SDK_SECRET`
- `NEXT_PUBLIC_ZOOM_MEETING_SDK_KEY`

Meeting creation should happen after instructor confirmation:
1. Instructor confirms booking.
2. Server obtains Zoom OAuth access token.
3. Server creates scheduled meeting for the instructor/host.
4. Server stores meeting ID, UUID, join URL, password, settings.
5. Server sends confirmation notifications.

Meeting settings:
- waiting room enabled
- join before host disabled unless intentionally enabled
- participant video configurable
- host video configurable
- mute upon entry enabled
- screen sharing host-only by default, instructor can allow during session
- recording disabled by default unless explicitly supported

Signature endpoint replacement:
```ts
POST /api/live-sessions/[bookingId]/zoom-signature
```

Request:
```json
{ "role": "learner" }
```

Server checks:
- user is authenticated
- booking exists
- booking is `confirmed`
- user is the learner, instructor, admin, or approved participant
- current time is within the allowed join window
- Zoom meeting exists for the booking

Response:
```json
{
  "signature": "...",
  "meetingNumber": "...",
  "password": "...",
  "sdkKey": "...",
  "displayName": "..."
}
```

### Live Session Studio

Route:
- `/live-sessions/[bookingId]/studio`

Studio areas:
- header with session title, time, status, participants, connection state
- pre-join device check
- embedded Zoom component
- agenda panel
- learner goals/questions
- lesson/course context
- shared resources
- session notes
- chat/Q&A panel if we choose to keep platform-side notes separate from Zoom chat
- post-session summary and next steps

MVP studio features:
- secure route authorization
- pre-join state
- embedded Zoom Meeting SDK component
- leave session
- session details panel
- learner notes
- instructor notes
- mark completed

Full-featured studio later:
- attendance tracking
- host controls surfaced where SDK supports them
- resource sharing
- session agenda checklist
- action items
- post-session AI summary from instructor notes
- recording link support if Zoom recording is enabled
- session feedback form

### Creator/Admin UI

New creator navigation:
- `/creator/live-sessions`

Pages:
- Availability settings
- Bookable services
- Pending requests
- Upcoming confirmed sessions
- Past sessions
- Session detail

Course/lesson integration:
- Course settings can enable bookable live sessions.
- Lesson editor gets a new block such as `live_session_cta`, not a raw Zoom meeting block.
- The block links learners to the booking calendar for the correct service.

### Learner UI

New learner surfaces:
- Dashboard card: upcoming live sessions.
- Course lesson block: book a session.
- Calendar picker: date, slot, notes.
- Booking detail page: status, time, actions.
- Studio route: join confirmed session.
- Past sessions: notes and follow-up items.

## Practice Exercise System

### New Content Block

Add content block type:
- `practice_exercise`

This is different from `ai_prompt`. `ai_prompt` is a prompt learners can try. `practice_exercise` creates a trackable assignment with submissions and AI scoring.

Recommended content JSON:
```json
{
  "title": "Create a client-ready AI retouching workflow",
  "brief": "Use the Practice Studio to design a workflow for retouching 10 portrait images.",
  "mode": "studio_workbench",
  "estimated_minutes": 25,
  "instructions": [
    "Describe the current manual workflow.",
    "Use the workflow generator.",
    "Refine the output into steps you can actually follow."
  ],
  "deliverables": [
    {
      "type": "text",
      "label": "Final workflow",
      "required": true
    },
    {
      "type": "image",
      "label": "Screenshot of your tool setup",
      "required": false
    }
  ],
  "allowed_file_types": ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"],
  "max_files": 5,
  "rubric": [
    {
      "criterion": "Practicality",
      "description": "The workflow can be followed by a real learner with available tools.",
      "weight": 30
    },
    {
      "criterion": "Specificity",
      "description": "The submission includes concrete tools, steps, and outputs.",
      "weight": 30
    },
    {
      "criterion": "Quality control",
      "description": "The workflow includes human review and error checking.",
      "weight": 25
    },
    {
      "criterion": "Reflection",
      "description": "The learner explains what they changed or learned.",
      "weight": 15
    }
  ],
  "ai_scoring_enabled": true,
  "instructor_review_required": false,
  "resubmissions_allowed": true
}
```

### Exercise Modes

#### `studio_workbench`

Learner completes work inside Practice Studio. The exercise can preselect a tool, prefill context, and require the learner to submit the final studio output.

Examples:
- Prompt optimizer assignment.
- Workflow designer assignment.
- AI image prompt assignment.
- Code explanation assignment.

#### `upload_submission`

Learner completes work outside the app and uploads evidence.

Examples:
- phone screenshot,
- edited image,
- before/after image,
- PDF plan,
- spreadsheet export,
- ZIP package.

#### `text_response`

Learner writes directly in the lesson player.

Examples:
- reflection,
- business plan,
- prompt,
- critique,
- step-by-step process.

#### `hybrid`

Learner uses Practice Studio and uploads files or screenshots.

Examples:
- Use Studio to generate a plan, execute it on phone, upload screenshot evidence and final notes.

### Database Plan

#### `practice_exercises`

Optional normalized table if we do not want all exercise config only in `content_blocks.content`.

Fields:
- `id`
- `content_block_id` unique
- `lesson_id`
- `course_id`
- `title`
- `mode`
- `rubric` jsonb
- `settings` jsonb
- `created_at`
- `updated_at`

Recommendation: start with `content_blocks.content` for the exercise definition, then add this table only if reporting and analytics require easier joins.

#### `practice_exercise_submissions`

Fields:
- `id`
- `exercise_block_id`
- `course_id`
- `lesson_id`
- `user_id`
- `status` enum: `draft`, `submitted`, `scored`, `needs_review`, `reviewed`
- `attempt_number`
- `text_response`
- `studio_tool_id` nullable
- `studio_inputs` jsonb
- `studio_output` text nullable
- `metadata` jsonb
- `submitted_at`
- `scored_at`
- `reviewed_at`
- `created_at`
- `updated_at`

Indexes:
- `(user_id, exercise_block_id)`
- `(course_id, status)`
- `(lesson_id, exercise_block_id)`

#### `practice_exercise_files`

Fields:
- `id`
- `submission_id`
- `user_id`
- `bucket_id`
- `storage_path`
- `file_name`
- `mime_type`
- `file_size`
- `created_at`

Storage:
- create a new `practice-submissions` bucket or reuse `project-submissions` with a new folder convention.
- recommended folder convention: `practice-submissions/{user_id}/{exercise_block_id}/{submission_id}/{filename}`.

#### `practice_exercise_scores`

Fields:
- `id`
- `submission_id` unique
- `score` numeric
- `max_score` numeric default 100
- `rubric_breakdown` jsonb
- `feedback_summary`
- `strengths` jsonb
- `improvements` jsonb
- `model`
- `confidence` numeric
- `needs_instructor_review` boolean
- `raw_ai_response` jsonb
- `created_at`

No `passed` field. No pass mark.

#### `practice_exercise_reviews`

Instructor override/review.

Fields:
- `id`
- `submission_id`
- `reviewer_id`
- `score_override` nullable
- `feedback`
- `status`
- `created_at`
- `updated_at`

### AI Scoring Flow

1. Learner submits exercise.
2. Server validates lesson access and file ownership.
3. Server prepares a scoring payload:
   - exercise brief,
   - instructions,
   - rubric,
   - text response,
   - studio inputs/output,
   - extracted text from PDFs where possible,
   - file metadata,
   - image URLs or image bytes only if the selected model supports vision.
4. AI returns structured JSON:
```json
{
  "score": 82,
  "rubric_breakdown": [
    {
      "criterion": "Practicality",
      "score": 25,
      "max": 30,
      "feedback": "The steps are realistic, but the timeline is missing."
    }
  ],
  "feedback_summary": "Strong workflow with clear tool choices.",
  "strengths": ["Clear sequence", "Good human review step"],
  "improvements": ["Add estimated time per step", "Include backup tool options"],
  "confidence": 0.78,
  "needs_instructor_review": false
}
```
5. Store score and feedback.
6. Show learner feedback immediately.
7. If confidence is low, file type cannot be interpreted, or rubric detects possible academic integrity issues, mark `needs_review`.

### Scoring Guardrails

- Do not treat AI score as certification.
- Do not block course progress using a pass mark.
- Always show feedback as guidance.
- Show a clear state when AI could not inspect a file and only evaluated the text or metadata.
- Allow instructor review and override.
- Keep original submissions unchanged for auditability.

### Creator UI

Lesson editor adds `Practice Exercise` under Practical Learning.

Creator can configure:
- title
- brief
- mode
- instructions
- deliverables
- allowed file types
- max files
- rubric criteria and weights
- whether AI scoring is enabled
- whether instructor review is required
- resubmission policy

Creator can preview:
- learner exercise card
- submission form
- scoring rubric

### Learner UI

Practice exercise block in lesson player:
- title, brief, estimated time
- instructions checklist
- deliverable inputs
- file uploader
- Practice Studio launch button when mode requires studio
- save draft
- submit
- submission status
- AI score and feedback after scoring
- resubmit if allowed

Learner dashboard:
- pending practice exercises
- submitted/scored exercises
- feedback history

### Instructor UI

New review area:
- `/creator/practice-submissions`

Views:
- needs review
- recent submissions
- by course
- by learner
- by exercise

Instructor can:
- open submission files through signed URLs,
- read AI feedback,
- add human feedback,
- override score,
- request resubmission,
- mark reviewed.

## Phased Implementation

### Phase 0: Repair and Stabilize Current Surfaces

Goal: reduce current breakage while building the new system.

Tasks:
- Fix or deprecate the existing `meeting` block UI so blank meeting IDs show a useful booking-coming-soon state instead of rendering nothing.
- Correct Zoom environment naming so Meeting SDK key/secret and REST API credentials are clearly separated.
- Add authorization checks to the existing Zoom signature endpoint if it remains temporarily available.
- Fix `practice_sessions.user_id` to align with Clerk user IDs, or stop using it and replace it with the new submission tables.
- Update docs to mark static meeting blocks as legacy.

### Phase 1: Live Session Booking MVP

Goal: learners can request a time and instructors can confirm manually.

Tasks:
- Add live session database migrations.
- Build availability settings.
- Build service settings.
- Build server-side slot generation.
- Build learner booking calendar.
- Build instructor pending request dashboard.
- Send basic in-app/email notifications.
- No embedded Zoom yet; confirmation can store manual meeting data for a short interim if needed.

Acceptance criteria:
- Learner sees only available slots.
- Learner can request a slot.
- Instructor can confirm or decline.
- Double bookings are prevented.
- Booking status history is visible.

### Phase 2: Zoom Lifecycle Integration

Goal: confirmed sessions automatically create Zoom meetings and expose secure join data.

Tasks:
- Add Zoom REST API client.
- Add token caching for Zoom OAuth.
- Create meeting on confirmation.
- Update meeting on reschedule.
- Delete or cancel meeting on cancellation where appropriate.
- Store Zoom metadata.
- Replace raw meeting ID signature API with booking-based signature API.
- Add Zoom webhook endpoint for meeting started/ended/participant events if needed.

Acceptance criteria:
- Confirming a booking creates a Zoom meeting.
- Learner cannot obtain Zoom signature for another learner's booking.
- Learner can join only during allowed window.
- Instructor can start or join as host/co-host through the studio route.

### Phase 3: Live Session Studio MVP

Goal: learners and instructors conduct the session inside the website.

Tasks:
- Build `/live-sessions/[bookingId]/studio`.
- Add pre-join screen.
- Embed Zoom Meeting SDK component.
- Add session details and agenda panel.
- Add learner/instructor notes.
- Track attendance events.
- Add completed/no-show actions.

Acceptance criteria:
- Confirmed learner and instructor can join the same embedded session.
- Unauthorized users are blocked.
- Session notes persist.
- Session can be marked completed.

### Phase 4: Practice Exercise Content Block MVP

Goal: lesson exercises become submit-and-score assignments.

Tasks:
- Add `practice_exercise` content block type.
- Add creator block editor.
- Add learner renderer and submission form.
- Add private storage path for uploads.
- Add submission tables.
- Support text and file upload submissions.
- Add AI scoring route for text and supported files.
- Show score and feedback without pass/fail.

Acceptance criteria:
- Creator can add a practice exercise to a lesson.
- Learner can submit text and/or files.
- Submission persists.
- AI returns score and feedback.
- Lesson progress is not blocked by a pass mark.

### Phase 5: Studio-Based Practice Exercises

Goal: Practice Studio becomes assignment-aware.

Tasks:
- Allow a `practice_exercise` block to launch Practice Studio with preselected tool and prefilled context.
- Persist studio inputs/output server-side.
- Submit studio output into `practice_exercise_submissions`.
- Keep generic Practice Studio available from the lesson player.
- Add learner submission history.

Acceptance criteria:
- Exercise can require a specific Practice Studio tool.
- Learner output is attached to the exercise submission.
- AI scoring evaluates the exercise rubric, not just generic output quality.

### Phase 6: Instructor Review and Analytics

Goal: instructors can manage the learning loop.

Tasks:
- Build creator review dashboard.
- Add human feedback and score override.
- Add request resubmission.
- Add per-exercise analytics.
- Add course-level practice completion summary.
- Add learner dashboard cards for pending/scored exercises.

Acceptance criteria:
- Instructor can find submissions needing review.
- Instructor can review files securely.
- Learner sees instructor feedback separately from AI feedback.
- Course dashboard shows exercise completion and average score trends.

## Security and RLS Requirements

Live sessions:
- Learners can read and mutate only their own booking requests.
- Instructors can read and mutate bookings for their services/courses.
- Admins can read all.
- Zoom `start_url` and passwords must not be broadly readable.
- Booking-based signature route is required before embedded join.

Practice exercises:
- Learners can read exercise definitions for enrolled courses.
- Learners can create/update drafts for their own submissions.
- Learners can read their own scores.
- Instructors can read submissions for courses they own.
- Storage policies must restrict object paths by user and review role.

AI:
- Do not send private files to AI unless the exercise has AI scoring enabled and the learner has submitted.
- Store the model name and scoring payload metadata for audit.
- Avoid storing unnecessary extracted sensitive data.

## Notifications

Live session notifications:
- booking requested
- booking confirmed
- booking declined
- reschedule proposed
- reschedule accepted
- cancellation
- 24-hour reminder
- 1-hour reminder
- session completed follow-up

Practice notifications:
- submission received
- AI score ready
- instructor feedback ready
- resubmission requested

## Open Decisions

1. Should learners book one-on-one sessions only, or should the system also support cohort sessions with many learners?
2. Should instructors connect their own Zoom accounts, or should all meetings be created under one academy Zoom host account?
3. Should recordings be supported in MVP, or postponed because of storage, consent, and privacy requirements?
4. Should AI scoring run synchronously on submit or as a background job?
5. Should practice file uploads support video/audio in the first release, or start with images, PDF, text, ZIP?
6. Should live sessions be included in course purchase access, sold separately, or both?

## Recommended MVP Scope

Build in this order:

1. Live session booking tables, availability, services, slot generation.
2. Learner calendar and instructor confirmation dashboard.
3. Zoom meeting creation on confirmation.
4. Booking-authorized studio route with embedded Zoom.
5. `practice_exercise` block with text/image/PDF upload submissions.
6. AI scoring with rubric feedback and no pass/fail.
7. Instructor review dashboard.

This sequence gets the broken Zoom flow out of the lesson content model first, then turns Practice Studio into a trackable learning system without delaying live sessions.

## Implementation Notes

- Read the local Next.js docs in `node_modules/next/dist/docs/` before editing app routes, server actions, or route handlers.
- Keep Zoom REST API code server-side only.
- Keep Meeting SDK browser code client-only with dynamic import.
- Avoid passing raw `meetingNumber` from content blocks into the signature API.
- Prefer server actions for authenticated mutations that already match app patterns.
- Use API routes for streaming AI scoring and Zoom webhooks.
- Use Supabase Storage signed URLs for instructor review; do not make submissions public.
- Add tests around slot overlap logic because booking bugs are costly.
