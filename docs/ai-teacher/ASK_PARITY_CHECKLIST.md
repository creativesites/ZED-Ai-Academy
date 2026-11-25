# Ask dock on the Teacher Runtime: parity checklist (P1-06)

The lesson dock (`src/components/learner/ai-tutor.tsx`) has two paths:

- **Legacy**: `/api/ai/tutor`, plain-text stream with `:::directive:::` widgets, history in `localStorage`. Unchanged.
- **Runtime**: one `ask` session per learner + lesson (`POST /api/tutor/ask`, find-or-create), turns through
  `POST /api/tutor/sessions/:id/turn?stream=1` (SSE), events rendered by `AskThread` + the pinned `TeachingBoard`,
  avatar driven by `EventPlayer`. Conversation loaded from the server.

The runtime path is used only when **all** hold: `NEXT_PUBLIC_TEACHER_ASK_RUNTIME` is on (`1`/`true`/`on`/`yes`,
default off), the visitor is signed in, and `POST /api/tutor/ask` succeeds (it answers 404 when the flag is off,
401/403 when not signed in or not allowed on the lesson, 503 when the database cannot store an `ask` session).
Any failure falls back to the legacy path for that lesson. `/api/ai/tutor` stays in place (retire one release after
the flag is on everywhere).

Legend: **Code** = verified by reading code and unit tests; **Browser** = needs a manual browser check (not run:
no app/DB/Gemini in the build environment).

| # | Area | Legacy behaviour | Runtime behaviour | Verified |
|---|---|---|---|---|
| 1 | Starter prompts | 4 cards until the first message | Same 4 cards (shared `ASK_QUICK_ACTIONS`) until the first message, then a chip row above the input | Code; layout Browser |
| 2 | Quick actions as learner input | Card text sent as the message | Card/chip text sent as the learner's turn text (stored in `tutor_turns.learner_text`) | Code |
| 3 | Streaming feel | Text chunks appear as they stream | Each event appears as soon as its JSON object closes (first `say` before the turn finishes); "Thinking…" until then | Code + unit tests (`turn-stream.test.ts`); latency Browser |
| 4 | Lesson seek (`:::lesson_ref`) | Inline jump button + pinned chips; `dispatchLessonSeek` | `show_lesson_ref` → inline jump chip + pinned chips in `TeachingBoard`; same `dispatchLessonSeek` | Code; video seek Browser |
| 5 | Board (`:::board`) | Latest board pinned above the thread | Latest `show_board` (with `reveal_step`) pinned via `TeachingBoard`; board survives reload (derived from stored turns) | Code + unit tests (`deriveAskBoard`) |
| 6 | Knowledge checks | `:::knowledge_check` graded in the browser, `recordDockKnowledgeCheck` | `ask_choice` inline card; pick sends `I choose: <option>`; the teacher's `note_evidence` is recorded per turn via `persistSessionMastery` (enrolled learners only) as teacher judgement until server grading (Stream F / P2-04). Line "Recorded: x of y correct" + why? | Code; mastery write needs DB |
| 7 | Confidence | n/a | `ask_confidence` → Lost/Unsure/Got it chips, sent as the learner's reply | Code |
| 8 | Read-aloud ("Voice on") | Whole reply read after streaming ends | Each `say` line read as it arrives (EventPlayer speak hook → `TeacherAudio.speak`) | Code; audio Browser |
| 9 | Listen / Copy per reply | Yes | Yes (spoken text of the reply's `say` events) | Code; Browser |
| 10 | Regenerate | Yes | Not offered (turns are stored; ask again instead) | Code (intentional gap) |
| 11 | Clear | Clears localStorage | "New chat": closes the `ask` session (kept in history), opens a new one | Code; Browser |
| 12 | Data saver / lite mode | Placeholder avatar, lite board | Same toggle; same `lite` prop to `Teacher` and `TeachingBoard`; avatar proxy follows the swap | Code; Browser |
| 13 | Dictation (mic) | Browser speech recognition fills the input | Unchanged | Code |
| 14 | Guest (free preview, signed out) | `/api/ai/tutor`, in-memory, rate-limited per IP | Unchanged: `isGuest` skips the runtime; nothing persisted | Code |
| 15 | Signed in, not enrolled | `/api/ai/tutor` 403 (dock errors) | `/api/tutor/ask` 403 → legacy path → same 403 as before. Every `ask` turn re-checks lesson access (`askTurnAllowed`), so a lapsed enrollment stops an open conversation | Code |
| 16 | Conversation on another device | No (localStorage) | Yes: loaded from `tutor_turns` | Code; Browser + DB |
| 17 | No conversation in localStorage | Stored | Runtime never writes it (legacy key left untouched for fallback) | Code |
| 18 | Metering | None per tenant for the dock | Turn tokens recorded with session id via `recordUsage` (same as non-stream turns) | Code; ledger rows need DB |
| 19 | Mobile | Full-screen panel + backdrop | Same shell; chips row scrolls horizontally | Browser |
| 20 | Errors | "Something went wrong" bubble | Inline error on the reply; conversation-ended (409) restarts on next send | Code |
| 21 | Lesson change while open | localStorage key per lesson | Find-or-create per lesson; "Loading your conversation…" while it loads | Code; Browser |

## Legacy `:::directive:::` widgets without an event equivalent

The runtime prompt asks for contract events, but `expandLegacyDirectives` (`src/lib/tutor/runtime/ask.ts`) converts
any directive a model still writes inside a `say` line, so nothing renders as raw markup:

| Directive | Mapped to | Lost |
|---|---|---|
| `board` | `show_board` (same kind/title/items/text) | — |
| `lesson_ref` | `show_lesson_ref` | — |
| `knowledge_check` | `ask_choice` | `correctIndex`/`explanation` (no client grading; server grading P2-04) |
| `workflow_steps` | `show_board kind=steps` ("title: description") | step icons |
| `checklist` | `show_board kind=bullets` | tick-off state |
| `comparison_table` | `show_board kind=table` (header row first, caption → title) | >5 columns, >8 rows |
| `code_snippet` | `show_board kind=code` | copy button styling (board has its own) |
| `prompt_template` | `show_board kind=note` (title, prompt) | description, copy-prompt button |
| `prompt_iteration` | `show_board kind=compare` (before/after) | reasoning |
| `tool_spotlight` | `show_board kind=note` (name, description, url as text) | clickable link, category |
| `resource_link` | `show_board kind=note` | clickable link, type icon |
| `action_card` | `show_board kind=note` | the action button |
| `course_card` | `show_board kind=note` | course link, thumbnail |

Follow-up for the widget registry (Architecture §6.2): `prompt_template` (copyable prompt), `resource_link`/
`tool_spotlight` (safe external link), `checklist` (tickable) are the ones worth real board kinds.

## Not in this change

- "History" link listing earlier Ask conversations for the course (UX §4.2): sessions are kept; no list UI yet.
- Selected-text / paused-video chips (UX §4.2), bottom-sheet heights on mobile (UX §4.1).
- Retention job for `ask` sessions (90 days, Architecture §3.1).
- Learner-memory summariser for `ask` sessions (they never call `/complete`).
