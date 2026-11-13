# Zed AI Academy — Course Creator 2.0 Implementation Roadmap

**Goal:** Incrementally transform the course creator from its current form-based prototype into a reliable, multi-tenant, AI-assisted Course Authoring Studio without disrupting live academies.

---

## P0 — Broken Functionality & Critical Security Issues (Immediate)

### P0.1 — Deploy Course Studio Tenant Routing & Context Preservation *(Implemented)*
- **Why it matters:** Creating a course in an academy (`/academy/[domain]/admin/courses/new`) previously inserted the DB row and redirected to a 404 route (`/academy/[domain]/admin/courses/[courseId]`). Tenant `teacher` users were also kicked out of `/creator/courses/...`.
- **Changes:** Added `/academy/[domain]/admin/courses/[courseId]/page.tsx` and `/lessons/[lessonId]/page.tsx`; extracted `CourseStudioView` & `LessonStudioView`; wired `tenantSlug` through `createCourse`, `updateCourse`, `publishCourse`, `deleteCourse`, `createLesson`, `deleteLesson`, `CurriculumBuilder`, `CourseSettingsForm`, `PublishButton`, `NewCourseForm`.
- **Files:** `src/lib/courses/course-routes.ts`, `src/lib/courses/course-auth.ts`, `src/lib/courses/course-auth-server.ts`, `src/actions/courses.ts`, `src/actions/lessons.ts`, `src/actions/modules.ts`, `src/components/creator/*`, `src/app/(marketing)/academy/[domain]/admin/courses/*`.
- **Tests:** `src/lib/courses/course-routes.test.ts` (`npm run test:courses` — 9/9 passing).

### P0.2 — Fix Quiz Builder Foreign-Key Bug *(Implemented)*
- **Why it matters:** `LessonEditorClient` passed `block.id` instead of `lessonId` to `QuizBuilder`, breaking all quiz creation.
- **Changes:** Fixed prop in `src/components/creator/lesson-editor-client.tsx:333`.
- **Tests:** Add integration test verifying `createQuiz(lessonId, courseId)` links to `lessons.id` and `block.content.quiz_id` updates.

### P0.3 — Close Remaining IDOR & Cross-Tenant Authorization Holes *(Next Immediate PR)*
- **Why it matters:** `quizzes.ts`, `course-ai.ts` (`exportCourseBlueprint`/`importCourseBlueprint`), `upload.ts`, and `/api/ai/edit-block-content` currently only check `if (!userId)`, allowing any authenticated user to mutate/exfiltrate any tenant's courses or files.
- **What needs to change:**
  - Call `assertCanManageCourse(supabase, courseId, userId)` in all functions in `src/actions/quizzes.ts`, `src/actions/course-ai.ts`, `src/actions/upload.ts` (and validate `path` prefix `{courseId}/` on `deleteMedia`).
  - Update `/api/ai/generate-curriculum`, `/api/ai/generate-lesson-content`, `/api/ai/generate-quiz`, and `/api/ai/edit-block-content` to use `canManageCourse()` instead of `course.instructor_id !== userId`.
  - Fix draft course preview check in `src/app/(marketing)/academy/[domain]/courses/[slug]/page.tsx:82` to allow `isTeachingRole(access?.tenantRole)`.
- **Dependencies:** `src/lib/courses/course-auth-server.ts`.
- **Tests:** Automated tests verifying cross-tenant requests, learner requests, and suspended-tenant requests return 403/Unauthorized.

### P0.4 — Harden Postgres RLS & Storage Policies for Course Tables
- **Why it matters:** `20261028000000_rls_hardening.sql` left `modules`, `lessons`, `content_blocks`, `quizzes`, and `quiz_questions` on legacy `auth.uid()` policies and global `status = 'published'` SELECTs.
- **What needs to change:** New migration `supabase/migrations/20261113000001_course_child_rls_hardening.sql` replacing policies with `public.is_company_staff(company_id)` and tenant-aware published reads.
- **Tests:** Postgres harness tests (matching `docs/SECURITY_RLS.md` section 8) verifying `anon` and cross-tenant `authenticated` JWTs cannot read/write another tenant's drafts, modules, lessons, blocks, or quizzes.

---

## P1 — Core Course Creator Transformation

### P1.1 — 3-Mode Course Creation Entry & Guided Wizards
- **Why it matters:** Replaces the form-first `NewCourseForm` with clear starting paths: *From Scratch*, *From Existing Materials*, and *From an Idea (AI)*.
- **What needs to change:**
  - Redesign `NewCourseForm` into a 3-mode launcher component (`src/components/creator/course-launcher.tsx`).
  - Persist `domain_preset`, `learning_outcomes`, `target_audience`, `prerequisites`, and `visibility` on `courses` (new migration).
  - Fix `createCourse` to scaffold `module_outline` when coming from the Blueprint wizard, and remove the hardcoded 4-module constraint in `/api/ai/generate-course-blueprint` & `/api/ai/generate-curriculum`.
- **Tests:** E2E journeys #1 (manual), #2 (idea-to-course AI), and #17 (tenant route navigation).

### P1.2 — Source-Material Ingestion Pipeline (PDF / DOCX / PPTX)
- **Why it matters:** Enables SMEs to upload real teaching materials and choose *Reference Mode* or *AI Synthesis* with citations.
- **What needs to change:**
  - Create private Supabase Storage bucket `course-sources` with tenant-scoped RLS.
  - Add tables `course_source_documents` and `course_source_sections` (with `tsvector` FTS index).
  - Implement upload/validation/extraction service (`src/lib/courses/source-ingestion.ts`) supporting `.pdf`, `.docx`, `.pptx` + signed URLs + SHA-256 deduplication + retryable `failed` state.
  - Build Source Library UI (`src/components/creator/source-library-panel.tsx`) and `/api/courses/[courseId]/sources` endpoints.
- **Tests:** Journeys #3 (PDF → course), #4 (DOCX → reference only), #5 (manual after reference upload), #13 (cross-tenant document isolation), #16 (failed extraction recovery).

### P1.3 — Unified 3-Pane Course Studio & Autosave
- **Why it matters:** Eliminates manual per-block Save data loss and constant page-hopping between course and lesson editors.
- **What needs to change:**
  - Build unified `CourseStudioShell` (`Left Outline Rail` + `Center Block Canvas` + `Right Contextual Panel`).
  - Add debounced autosave (`1500ms`) with dirty-state indicator and `beforeunload` guard.
  - Curate block picker by `domain_preset` so beginners aren't overwhelmed by 23 blocks at once.
  - Fix `LessonEditorTour` hydration mismatch (`useEffect` instead of `useState` `localStorage` read).
- **Tests:** Journeys #6 (edit AI content), #8 (quizzes & assignments), #9 (learner preview), #10 (publish).

### P1.4 — Private Resource Storage & Signed Downloads
- **Why it matters:** Paid lesson `resource` blocks currently use public `courses_media` URLs.
- **What needs to change:** Move downloadable lesson resources to a private `course-resources` bucket served via signed URLs after enrollment verification.

---

## P2 — Advanced AI, Quality & Recovery Features

### P2.1 — Contextual AI Studio Copilot & Safe Inline Diffs
- **Why it matters:** Unifies the 5 disconnected AI widgets into one persistent, context-aware assistant that never silently overwrites instructor work.
- **What needs to change:**
  - Create `lesson_revisions` table and auto-snapshot before any AI edit/regeneration.
  - Build `/api/ai/studio-assist` supporting course/module/lesson/block/assessment scopes + source-section retrieval (`course_source_sections` FTS).
  - Render inline diff / preview cards with *Accept*, *Regenerate*, and *Discard* actions.
  - Remove Rick Astley `youtube_id` and `example.com` placeholders from `/api/ai/generate-lesson-content`.
- **Tests:** Journeys #7 (regenerate single lesson safely), #15 (failed AI generation preserves existing content).

### P2.2 — Explainable Course Quality & Readiness Engine
- **Why it matters:** Ensures courses have measurable outcomes, complete lessons, aligned assessments, and no placeholder assets before publishing.
- **What needs to change:**
  - Implement deterministic `evaluateCourseQuality()` (`src/lib/courses/quality-evaluator.ts`) + optional AI pedagogical audit (`/api/ai/course-quality-review`).
  - Surface actionable readiness checklist in Studio header and Overview tab.

### P2.3 — Transactional Curriculum Scaffolding & Course Duplication
- **Why it matters:** Prevents partial orphan modules on AI scaffold failure and lets academies clone/templatize courses.
- **What needs to change:** Wrap multi-module/lesson inserts in a Postgres RPC (`scaffold_course_curriculum`) and add `duplicateCourse(courseId, targetCompanyId)`.

---

## P3 — Future Opportunities

- **Collaborative Multi-Instructor Authoring:** Block-level presence, review comments, and approval workflows (Draft → In Review → Published).
- **Academy Template Marketplace:** Allow `zedai` platform or verified academies to publish reusable course templates (`visibility = 'template'`).
- **SCORM / Common Cartridge Export & Import:** Interoperability for institutional and corporate B2B clients.
- **Automated Video Transcript & Chapter Ingestion:** Extract transcripts from uploaded/linked videos into `course_source_sections` for AI Tutor & quiz generation.
