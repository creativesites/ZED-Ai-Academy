# Zed AI Academy — Course Creator Technical Audit

**Audit Date:** 2026-11-13  
**Scope:** End-to-end course authoring, curriculum management, AI generation, document/media upload, multi-tenant isolation, and publishing workflows.  
**Methodology:** Direct code inspection of App Router pages, Server Actions, API routes, React components, Supabase migrations, and test execution (`npm run test:courses`, `npm run test:tutor`). *Note: `node_modules` is not installed in this workspace, so live Next.js server rendering and browser execution were not run; runtime findings are verified from source code.*

---

## 1. Actual Technology Stack & Architecture (vs. Outdated Docs)

Several foundational docs (`CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md`, `docs/DATABASE.md`) are **outdated** and contradict the actual implementation:

| Layer | Outdated Docs Claim | Actual Implementation |
|---|---|---|
| **Framework** | Next.js 14+ | **Next.js 16.2.4**, React **19.2.4**, Tailwind CSS v4, `@base-ui/react` + Shadcn (`package.json`) |
| **Authentication** | Supabase Auth (`auth.users`, `auth.uid()`) | **Clerk** (`@clerk/nextjs` `^7.3.0`) with Clerk Organizations mapped to `companies.id` |
| **Database Access** | `createServerClient` with RLS enforced | `src/lib/supabase/server.ts` (`createClient` & `createServiceClient`) **both use `SUPABASE_SERVICE_ROLE_KEY`**, bypassing Postgres RLS on all server-side calls |
| **AI Provider** | Anthropic Claude (`claude-sonnet-4-6`) | **Google Gemini** (`@google/genai` `^1.29.0`) via `src/lib/ai/gemini.ts` and `src/lib/ai/models.ts` (`gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-image-preview`) |
| **Course Ownership** | `courses.instructor_id` only | Dual model: `courses.instructor_id` + `courses.company_id` (Clerk Org ID) |
| **Content Blocks** | 4 types (`video`, `text`, `quiz`, `file`) | **23+ block types** (`video`, `text`, `image`, `callout`, `tool_spotlight`, `before_after`, `resource`, `quiz`, `ai_prompt`, `steps`, `checklist`, `key_takeaway`, `practice_exercise`, `expert_note`, `comparison_table`, `case_study`, `meeting`, `learning_objectives`, `glossary`, `discussion_prompt`, `assignment`, `risk_assessment`, `tutor_session`) |
| **Storage Buckets** | `course-thumbnails`, `course-resources` (private) | `src/actions/upload.ts` uploads **all** media & documents to a single **public** bucket `courses_media` via `getPublicUrl()` |

---

## 2. Current User Journeys & Persona Evaluation

### Persona 1: Experienced Instructor (Manual Authoring)
- **Journey:** Navigates to `/creator/courses/new` or `/academy/[domain]/admin/courses/new` → fills out `NewCourseForm` → clicks **Deploy Course Studio** → lands in Course Studio → switches to Curriculum tab → creates modules/lessons → opens Lesson Editor → adds/reorders blocks → clicks per-block **Save** → previews → clicks **Publish**.
- **Friction & Failures:**
  - **Tenant Blocker (Fixed in P0):** Creating a course from `/academy/[domain]/admin/courses/new` previously redirected to `/academy/[domain]/admin/courses/[courseId]`, which **did not exist (404)**.
  - **Broken Quiz Creation:** Clicking "Create Quiz" inside a `quiz` block in `LessonEditorClient` (`src/components/creator/lesson-editor-client.tsx:333`) passed `lessonId={block.id}` instead of `lessonId={lessonId}`, causing a Postgres foreign-key violation (`quizzes.lesson_id -> lessons.id`). *(Fixed in P0).*
  - **Manual Save Trap:** Every `SortableBlock` requires clicking its own individual **Save** button; the header **Commit Changes** button (`lesson-editor-client.tsx:813`) only saves `title` and `is_preview`, silently discarding unsaved block edits on navigation.
  - **No Autosave or Undo:** No dirty-state warning, no autosave, and no revision history.
  - **Overwhelming Block Library:** All 23 block types are dumped into a flat right-hand sidebar (`TOOLBAR_GROUPS`), including domain-specific blocks (`risk_assessment`, `tutor_session`, `ai_prompt`) even when irrelevant to the course track.

### Persona 2: Subject-Matter Expert (No Course-Design Experience)
- **Journey:** Wants to upload existing PDFs, Word docs (`.docx`), or slide decks (`.pptx`) and turn them into a structured course, or get guided pedagogical help.
- **Friction & Failures:**
  - **No Document Ingestion:** Cannot upload a PDF/DOCX/PPTX to create or scaffold a course. `ResourceBlockEditor` only attaches a raw public file URL to a single lesson block.
  - **Form-First, Outcome-Last:** `NewCourseForm` asks for "Commercial Identity", "Price (ZMW)", and "Visual Identity (URL)" before the user has defined learning outcomes, audience prerequisites, or syllabus structure.
  - **No Quality Guidance:** The Publish Checklist (`course-studio-view.tsx`) only checks 4 trivial boolean conditions (title/description non-empty, category/level set, >=1 module & lesson, >=1 content block). A course with 1 empty text block passes 100% readiness.

### Persona 3: AI-First Creator (Minimal Manual Input)
- **Journey:** Wants AI to propose a blueprint, scaffold curriculum, draft lessons, and generate quizzes.
- **Friction & Failures:**
  - **Fragmented, Disconnected AI Tools:** 5 separate AI widgets (`CourseBlueprintAssistant`, `AIBlueprintAssistant` copy-paste JSON modal, `AICurriculumGenerator`, `AILessonGenerator`, and per-block `AI Block Assistant`) that do not share context or state.
  - **Discarded Blueprint Data:** `CourseBlueprintAssistant` generates `audience`, `quick_win`, `capstone`, and `module_outline`, but `NewCourseForm` (`src/components/creator/new-course-form.tsx`) never submits `module_outline` or `domain_preset` to `createCourse`, throwing away the AI-proposed syllabus!
  - **Rigid 4-Module Constraint:** Both `/api/ai/generate-course-blueprint` and `/api/ai/generate-curriculum` hardcode **exactly 4 modules** regardless of subject depth.
  - **Placeholder Hallucinations:** `/api/ai/generate-lesson-content` instructs Gemini to emit `youtube_id: "dQw4w9WgXcQ"` and `file_url: "https://example.com/handout.pdf"` (`route.ts:73,76`).
  - **No Source Grounding:** AI cannot read uploaded course documents, leading to generic or fabricated content.

---

## 3. Feature Capability Inventory

| Capability | Status | Evidence & Notes |
|---|---|---|
| **Create Course (Generic `/creator/courses/new`)** | **Working (Basic)** | `src/actions/courses.ts` inserts `courses` row; ignores `domain_preset` and `module_outline`. |
| **Create Course (Tenant `/academy/[domain]/admin/courses/new`)** | **Broken → Fixed (P0)** | `createCourse` redirected to non-existent `/academy/[domain]/admin/courses/[courseId]`. Cancel button hardcoded to `/creator/courses`. |
| **Course Settings & Cover Upload** | **Partial** | `CourseSettingsForm` uploads cover to public `courses_media` bucket. `updateCourse`/`publishCourse`/`deleteCourse` previously broke for tenant staff when Clerk `orgId` was unset or belonged to another instructor. |
| **Curriculum Builder (Modules & Lessons)** | **Partial** | Drag-and-drop via `@dnd-kit` works, but `modules.ts` & `lessons.ts` only checked `instructor_id === userId`, blocking tenant `company_admin`/`teacher`/`super_admin`. *(Fixed in P0).* |
| **Lesson Block Editor (23 block types)** | **Implemented, Unreliable UX** | Manual per-block Save only; header "Commit Changes" ignores blocks; no autosave; no undo/versioning. |
| **Quiz Builder** | **Broken → Fixed (P0)** | `lesson-editor-client.tsx:333` passed `block.id` instead of `lessonId` to `QuizBuilder`, breaking `createQuiz` FK constraint. `quizzes.ts` also had **zero** ownership checks. |
| **Lesson Device Preview** | **Working** | `LessonPreviewPane` renders Phone/Tablet/Desktop shells with live client state. |
| **Course Preview (Tenant)** | **Broken for Staff** | `src/app/(marketing)/academy/[domain]/courses/[slug]/page.tsx:82` returns `notFound()` for draft courses unless `course.instructor_id === userId \|\| isSuperAdmin` — blocking `company_admin` and `teacher` of the same academy. |
| **AI Blueprint Assistant (New Course)** | **Partial** | Calls `/api/ai/generate-course-blueprint`, but `module_outline` is discarded on submit. |
| **AI Blueprint Export/Import Modal** | **Unreliable / Legacy** | `AIBlueprintAssistant` forces manual copy-paste JSON into external ChatGPT/Claude; `importCourseBlueprint` has **no authorization check**. |
| **AI Curriculum Generator** | **Partial** | Calls `/api/ai/generate-curriculum`; hardcoded 4 modules; `instructor_id` only auth check (fails for tenant admins/teachers). |
| **AI Lesson Generator** | **Partial** | Calls `/api/ai/generate-lesson-content`; `instructor_id` only auth check; generates fake YouTube/PDF URLs; appends directly to DB without preview/diff. |
| **AI Block Assistant (Inline)** | **Partial** | Calls `/api/ai/edit-block-content`; **no course/lesson auth check**; overwrites block state without undo history. |
| **AI Quiz Generator** | **Partial** | Calls `/api/ai/generate-quiz`; `instructor_id` only auth check; auto-inserts into DB without review step. |
| **Source Material Ingestion (PDF/DOCX/PPTX)** | **Missing Entirely** | No document upload, parsing, chunking, or source-grounded AI generation exists. |
| **Course Quality & Readiness Assistant** | **UI-Only / Trivial** | 4-item boolean checklist in `CourseStudioView`; no pedagogical, alignment, or completeness analysis. |
| **Versioning / Undo / Recovery** | **Missing Entirely** | Direct destructive mutations on `content_blocks`, `modules`, `lessons`. |

---

## 4. Confirmed Bugs, Security & Tenant-Isolation Findings

### Critical (P0 — Security & Data Integrity)

1. **Missing Ownership/Tenant Authorization in Server Actions & AI Routes (IDOR):**
   - `src/actions/quizzes.ts` (`createQuiz`, `updateQuiz`, `addQuestion`, `updateQuestion`, `deleteQuestion`): Only checks `if (!userId)`. **Any authenticated user** (including a learner) can create, modify, or delete quizzes/questions on **any course** across any tenant.
   - `src/actions/course-ai.ts` (`exportCourseBlueprint`, `importCourseBlueprint`): Only checks `if (!userId)`. Any authenticated user can exfiltrate any course's full structure or overwrite any course's metadata/modules/lessons/blocks.
   - `src/actions/upload.ts` (`uploadMedia`, `deleteMedia`): Only checks `if (!userId)`. Any authenticated user can upload files under any `courseId` or delete any file in `courses_media`.
   - `src/actions/lessons.ts` (`updateLesson`, `deleteLesson`, `reorderLessons`): Previously had **no** ownership check at all. *(Fixed in P0).*
   - `src/app/api/ai/edit-block-content/route.ts`: Only checks `if (!userId)` — no verification that the user can edit the target block/lesson/course.

2. **Broken Tenant Course Creation & Navigation Flow (Confirmed P0 — Fixed):**
   - `src/actions/courses.ts:168` redirected to `/academy/${tenantSlug}/admin/courses/${course.id}`, which did not exist.
   - `src/app/(marketing)/academy/[domain]/admin/courses/page.tsx:227` linked "Edit Curriculum" to `/creator/courses/${course.id}`, which broke tenant layout and **kicked tenant `teacher` users out to `/dashboard`** because `src/app/(creator)/layout.tsx:49` only allows `["instructor", "super_admin", "company_admin"]` (omitting `"teacher"`).
   - `src/components/creator/new-course-form.tsx:267` hardcoded Cancel `href="/creator/courses"`.

3. **Broken Quiz Creation in Lesson Editor (Confirmed P0 — Fixed):**
   - `src/components/creator/lesson-editor-client.tsx:333` passed `lessonId={block.id}` to `<QuizBuilder>`, violating the `quizzes.lesson_id -> lessons.id` foreign key.

4. **Database-Level RLS Gaps on Course Child Tables:**
   - `supabase/migrations/20261028000000_rls_hardening.sql` (not yet applied to live DB per `docs/SECURITY_RLS.md`) hardened `courses`, **but left `modules`, `lessons`, `content_blocks`, `quizzes`, and `quiz_questions` unhardened** (`001_initial_schema.sql` still uses `auth.uid()` which fails with Clerk text IDs, and `Anyone can view modules/lessons of published courses` exposes published tenant courses globally via PostgREST `anon` key).

### High (P1 — Functional & Tenant Isolation)

5. **Tenant Staff Blocked from Authoring in Shared Courses:**
   - `src/actions/course-ai.ts` (`scaffoldCurriculum`), `src/app/api/ai/generate-curriculum/route.ts`, `src/app/api/ai/generate-lesson-content/route.ts`, and `src/app/api/ai/generate-quiz/route.ts` all check `course.instructor_id !== userId`, blocking `company_admin`, `teacher`, and `super_admin` from using AI tools on courses in their own academy.
6. **Clerk `orgId` Session Mismatch in `courses.ts` & `creator/courses/page.tsx`:**
   - `src/app/(creator)/creator/courses/page.tsx:42` filters by `orgId` if active in Clerk, otherwise `instructor_id`. Users belonging to multiple academies who don't switch Clerk's active org switcher see the wrong academy or empty list.
7. **Unscoped Child Updates/Deletes:**
   - `src/actions/modules.ts` (`updateModule`, `deleteModule`) previously did not include `.eq("course_id", courseId)`. *(Fixed in P0).*
8. **Public Storage Bucket for All Course Assets:**
   - `src/actions/upload.ts` stores all files in `courses_media` with `getPublicUrl()`. There is no private bucket or signed-URL mechanism for paid resources or instructor source materials.
9. **Draft Course Preview 404 for Tenant Staff:**
   - `src/app/(marketing)/academy/[domain]/courses/[slug]/page.tsx:82` blocks `company_admin` and `teacher` from previewing draft courses they didn't personally create.

### Medium (P2 — Technical Debt & Reliability)

10. **Hydration Mismatch Risk:** `lesson-editor-client.tsx:634` reads `window.localStorage` inside `useState()` initializer.
11. **Non-Transactional Batch Operations:** `scaffoldCurriculum` (`src/actions/course-ai.ts:300`) inserts modules and lessons in sequential loops; a mid-loop failure leaves partial orphan modules.
12. **Dead/Duplicate Controls:** `CourseStudioView` has `PublishButton` in the header AND inside the Overview card AND another "Go Live Now" button in `CourseSettingsForm`.
13. **Test Suite Dependency Gap:** `npm run test:tutor` fails on 10 of 133 tests when `node_modules` is absent because `zod` is imported in `events.ts`/`scenario.ts` without a mock or local install.

---

## 5. Summary of P0 Fixes Implemented in This Audit

- Created `src/lib/courses/course-routes.ts` and `src/lib/courses/course-auth.ts` + `src/lib/courses/course-auth-server.ts`.
- Created missing tenant-scoped routes:
  - `src/app/(marketing)/academy/[domain]/admin/courses/[courseId]/page.tsx`
  - `src/app/(marketing)/academy/[domain]/admin/courses/[courseId]/lessons/[lessonId]/page.tsx`
- Extracted shared `CourseStudioView` (`src/components/creator/course-studio-view.tsx`) and `LessonStudioView` (`src/components/creator/lesson-studio-view.tsx`).
- Fixed `createCourse`, `updateCourse`, `publishCourse`, `deleteCourse` (`src/actions/courses.ts`), `createLesson`, `updateLesson`, `deleteLesson`, `reorderLessons` (`src/actions/lessons.ts`), and `createModule`, `updateModule`, `deleteModule`, `reorderModules` (`src/actions/modules.ts`) to use `assertCanManageCourse` and preserve `tenantSlug`.
- Fixed `NewCourseForm` Cancel link and added `useFormStatus` pending state on **Deploy Course Studio**.
- Fixed `QuizBuilder` `lessonId={lessonId}` bug in `src/components/creator/lesson-editor-client.tsx`.
- Added 9 automated regression tests in `src/lib/courses/course-routes.test.ts` (`npm run test:courses` — 9/9 passing).
