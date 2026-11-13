# Zed AI Academy — Course Creator 2.0 Product & Technical Specification

## 1. Product Vision

Transform Zed AI Academy's course creator from a fragmented sequence of administrative forms into a **modern, AI-assisted (never AI-dependent) Course Authoring Studio** where independent multi-tenant academies can design, author, ingest source materials, verify quality, and publish world-class courses.

### Core Principles
1. **Manual-First Independence:** Every authoring workflow works 100% end-to-end without an AI API key or a single AI call.
2. **Three Clear Starting Paths:** *Start from Scratch*, *Start from Existing Materials (PDF/DOCX/PPTX)*, or *Start from an Idea with AI*.
3. **Human-in-the-Loop AI:** AI proposes; instructors review, diff, edit, accept, or reject. AI never silently overwrites instructor-authored content.
4. **Source-Grounded Integrity:** When generating from uploaded documents, AI cites exact source documents/pages/sections and never fabricates claims or placeholder URLs.
5. **Strict Multi-Tenant Isolation:** Every course, module, lesson, block, quiz, media asset, and source document belongs to a single tenant (`company_id`), enforced at both application and Postgres RLS/Storage levels.

---

## 2. User Personas & Three Starting Experiences

| Persona | Primary Starting Mode | Core Need |
|---|---|---|
| **Experienced Instructor** | **A. Create from Scratch** | Fast keyboard-friendly outline, rich block canvas, autosave, drag-and-drop, clean preview, zero AI clutter. |
| **Subject-Matter Expert (SME)** | **B. Create from Existing Materials** | Upload PDF/DOCX/PPTX handouts, manuals, or slides; choose either *Reference-Only* or *AI-Assisted Transformation* with citations. |
| **AI-First Creator / Solo Founder** | **C. Generate from an Idea** | Guided pedagogical interview → reviewable blueprint → stage-by-stage curriculum & lesson generation. |

### Mode A: Create from Scratch
- Minimal 1-step creation: Course Title, Domain Track (`COURSE_DOMAIN_PRESETS`), Visibility Scope (`tenant` vs `platform`), and optional Outcome Summary.
- Lands directly in the **3-Pane Course Studio** with an empty outline ready for manual module/lesson creation, TipTap rich text editing, YouTube embeds, private/public resource uploads, and native quiz/assignment builders.
- AI panels remain collapsed/optional.

### Mode B: Create from Existing Materials
1. Instructor uploads one or more `.pdf`, `.docx` (and `.doc` via server-side conversion or clear fallback), or `.pptx` files into **Source Materials** (separate from student-facing `resource` blocks).
2. System validates, stores in private tenant-scoped storage (`course-sources`), extracts structured sections/pages (`course_source_documents` + `course_source_sections`), and displays processing status.
3. Instructor chooses **how to use the materials**:
   - **Option 1 — Reference Mode (No Auto-Rewrite):** Source documents stay pinned in the Studio Reference Drawer. Instructor authors lessons manually while reading/searching extracted sections, with optional on-demand AI Q&A ("What does page 12 say about X?").
   - **Option 2 — AI Course Synthesis (Reviewable):** AI generates a proposed Course Blueprint (title, audience, prerequisites, learning objectives, modules, lesson outlines) **grounded in the extracted sections**, showing source citations (`[Doc 1, p. 4]`). Instructor edits/approves the structure before scaffolding, then generates lessons module-by-module or lesson-by-lesson.
4. **Crucial Separation:** Uploading a source document **never** makes it downloadable by students unless the instructor explicitly attaches a file to a `resource` block.

### Mode C: Generate Using AI (Iterative Guided Wizard)
Replaces the single-shot prompt with a **4-stage reviewable pipeline**:
1. **Stage 1 — Pedagogical Discovery:** Topic, target audience, starting knowledge, difficulty, target duration/depth, teaching style, and practical capstone outcome.
2. **Stage 2 — Blueprint Proposal:** AI proposes title, description, learning outcomes, and flexible module count (3–12 modules, not hardcoded to 4). Instructor edits/regenerates.
3. **Stage 3 — Curriculum Outline:** AI proposes lessons per module with lesson objectives. Instructor can add/remove/reorder/regenerate individual modules before committing.
4. **Stage 4 — Progressive Lesson & Assessment Drafting:** Inside the Studio, instructor generates one lesson or module at a time, with side-by-side preview/diff and instant rollback.

---

## 3. Modern Course Studio UX/UI Architecture

```
+-----------------------------------------------------------------------------------+
| [<- Courses]  Course Title (Draft v)   [Saved 2s ago]   [Readiness: 85%] [Preview] [Publish] |
+--------------------+--------------------------------------+-----------------------+
| LEFT RAIL (280px)  | CENTER CANVAS (flex-1)               | RIGHT PANEL (360px)   |
|                    |                                      | [AI] [Sources] [Props]|
| - Course Overview  | Lesson Title & Preview Toggle        |                       |
| - Readiness Check  | +----------------------------------+ | Contextual AI Copilot |
| - Source Library   | | Block 1: Learning Objectives     | | - Knows current       |
|                    | +----------------------------------+ |   course/module/      |
| MODULES & LESSONS  | | Block 2: Rich Text (TipTap)      | |   lesson/block        |
| v Mod 1: Basics    | |   [Inline AI: Rewrite/Simplify]  | | - Grounded in         |
|   * 1.1 Intro      | +----------------------------------+ |   Source Materials    |
|   * 1.2 Setup      | | + Add Block (/)                  | | - Proposes diffs      |
| > Mod 2: Practice  | +----------------------------------+ |   (Accept / Discard)  |
| + Add Module       |                                      |                       |
+--------------------+--------------------------------------+-----------------------+
```

### Key UX Upgrades
- **Unified Workspace:** Eliminate page-hopping between `/courses/[courseId]` and `/courses/[courseId]/lessons/[lessonId]` on desktop via a persistent **Left Curriculum Rail** (with inline drag-and-drop via `@dnd-kit`). Keep dedicated deep-link URLs working for mobile and direct bookmarks.
- **Autosave + Explicit Save State:** Debounced autosave (1.5s idle) for lesson metadata and content blocks with a live status indicator (`Saving…`, `Saved`, `Offline / Retry`), eliminating the "forgot to click per-block Save" data-loss bug.
- **Slash-Command & Curated Block Picker:** Group the 23 block types by **Domain Track** (`COURSE_DOMAIN_PRESETS`) so a Primary School teacher sees *Objectives, Text, Visual, Quiz, Assignment* first, while *Risk Assessment* or *AI Prompt* stay under "More blocks".
- **Student-View Preview Toggle:** Instant toggle between **Edit Canvas** and **Learner Preview** (Phone / Tablet / Desktop via existing `LessonPreviewPane`) without leaving the studio.
- **Undo & Revision Snapshots:** Auto-snapshot lesson blocks before any AI replacement or bulk edit (`lesson_revisions` table), allowing 1-click restore.

---

## 4. Intelligent AI Course Studio Assistant

### Architecture Fit
- Uses existing `@google/genai` client (`src/lib/ai/gemini.ts`) and centralized task registry (`src/lib/ai/models.ts`), adding new `AiTask` keys: `courseIngestion`, `courseQuality`, `inlineEdit`.
- **Modular, Small-Prompt Execution:** Never generate an entire multi-module course's lesson bodies in one HTTP request. Each stage (blueprint → outline → single lesson → quiz) is an independent, Zod-validated JSON call with progressive persistence.
- **Context-Aware Assistant (Right Panel):**
  - **Course-level:** Audit structure, identify missing learning outcomes, detect repetition, adapt tone/audience.
  - **Module-level:** Generate module summary, suggest lesson sequencing, spot missing prerequisites.
  - **Lesson-level:** Draft lesson blocks, simplify for beginners, add worked examples, generate summaries, suggest image descriptions (never fake `youtube_id` or `example.com` URLs).
  - **Assessment-level:** Generate quizzes/rubrics aligned to lesson objectives; check alignment.
  - **Inline Block Editing:** Rewrite, expand, shorten, simplify, change tone, or convert format — always rendered as a **proposed change** with *Apply*, *Regenerate*, or *Discard*.

---

## 5. Source-Material Ingestion Architecture

### Pipeline
1. **Upload & Validate:** Accept `.pdf`, `.docx`, `.pptx` (max 50 MB per file, configurable per tenant). Verify MIME type + magic bytes on server. Compute SHA-256 hash to detect duplicate uploads within the same course.
2. **Private Storage:** Store raw files in a **private** Supabase Storage bucket `course-sources` at path:
   `{company_id}/{course_id}/{document_id}/{sanitized_filename}`
   Access only via short-lived signed URLs after `assertCanManageCourse()`.
3. **Extraction & Structuring:**
   - **PDF:** Server-side text extraction (`pdf-parse` or `unpdf`) preserving page numbers (`page_number`). If extracted text density is near zero (scanned PDF), flag `ocr_required` and optionally run Gemini Vision OCR per page batch.
   - **DOCX:** Extract headings, paragraphs, and tables (`mammoth`) preserving section hierarchy.
   - **PPTX:** Extract slide titles, body text, and speaker notes (`jszip` + XML parser) preserving `slide_number`.
4. **Structured Storage (No Vector DB Required Initially):**
   - Store extracted sections in Postgres `course_source_sections` (`document_id`, `section_index`, `heading`, `page_or_slide_number`, `content_text`, `token_estimate`, plus a generated `tsvector` column for Postgres Full-Text Search).
   - **Why no vector DB yet:** Course source sets are typically 1–10 documents (10k–150k tokens). Postgres FTS (`GIN` index on `tsvector`) + section-level metadata selection + Gemini's large context window handles retrieval cleanly with zero new infrastructure, zero sync lag, and strict tenant RLS. A `pgvector` column can be added later if academies upload multi-thousand-page libraries.
5. **Error & Recovery States:** `uploaded` → `extracting` → `ready` | `failed` (with `error_message` and a **Retry Extraction** button).

---

## 6. Multi-Tenant Ownership & Security Model

1. **Tenant-Scoped Routes:** All academy authoring happens under `/academy/[domain]/admin/courses/...` (preserving `TenantAdminNavbar`, academy branding, and `teacher` role access). Platform-level authoring remains at `/creator/courses/...` scoped to `ZEDAI_TENANT_ID`.
2. **Unified Authorization (`assertCanManageCourse`):** Every Server Action (`courses.ts`, `modules.ts`, `lessons.ts`, `content-blocks.ts`, `quizzes.ts`, `course-ai.ts`, `upload.ts`, `source-documents.ts`) and every `/api/ai/*` route MUST verify:
   - Authenticated Clerk `userId`
   - `courses.company_id` matches the user's active `company_members` teaching role (`company_admin`, `teacher`, `instructor`), `companies.admin_id`, `course.instructor_id`, or `profiles.role === 'super_admin'`
   - Tenant `companies.status === 'active'` (suspended tenants cannot mutate).
3. **Visibility Scopes:** Add `visibility` (`'tenant_only' | 'platform_catalog'`) to `courses` so academy courses are never accidentally leaked into the global `/courses` marketplace unless explicitly opted in and approved.
4. **Database RLS Hardening:** Replace legacy `auth.uid()` policies on `modules`, `lessons`, `content_blocks`, `quizzes`, `quiz_questions`, and `course_source_*` with `(auth.jwt() ->> 'sub')` and `public.is_company_staff(company_id)` helpers matching `20261028000000_rls_hardening.sql`.

---

## 7. Proposed Data Model Changes

### New Tables (Migration: `supabase/migrations/20261113000000_course_creator_2_0.sql`)
1. **`course_source_documents`**
   - `id uuid PK`, `company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE`, `course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE`, `uploaded_by text NOT NULL`, `file_name text NOT NULL`, `mime_type text NOT NULL`, `file_size bigint NOT NULL`, `sha256 text NOT NULL`, `storage_path text NOT NULL`, `status text NOT NULL DEFAULT 'uploaded'` (`uploaded|extracting|ready|failed`), `page_count int`, `error_message text`, `created_at timestamptz`, `updated_at timestamptz`.
   - Indexes: `(course_id, created_at DESC)`, `(company_id, course_id)`, `UNIQUE(course_id, sha256)`.
2. **`course_source_sections`**
   - `id uuid PK`, `document_id uuid NOT NULL REFERENCES course_source_documents(id) ON DELETE CASCADE`, `company_id text NOT NULL`, `course_id uuid NOT NULL`, `section_index int NOT NULL`, `heading text`, `page_number int`, `content_text text NOT NULL`, `token_estimate int NOT NULL DEFAULT 0`, `search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading,'') || ' ' || content_text)) STORED`.
   - Indexes: `(document_id, section_index)`, `GIN(search_tsv)`.
3. **`lesson_revisions`**
   - `id uuid PK`, `lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE`, `course_id uuid NOT NULL`, `company_id text NOT NULL`, `created_by text NOT NULL`, `reason text NOT NULL` (`manual_snapshot|before_ai_edit|restore`), `title text NOT NULL`, `blocks_snapshot jsonb NOT NULL`, `created_at timestamptz DEFAULT now()`.
   - Index: `(lesson_id, created_at DESC)`.
4. **Alter `courses`**
   - Add `domain_preset text DEFAULT 'ai-professional'`, `learning_outcomes jsonb DEFAULT '[]'::jsonb`, `target_audience text`, `prerequisites text`, `visibility text NOT NULL DEFAULT 'tenant_only'` (`tenant_only|platform_catalog`), `quality_report jsonb`.
   - Backwards-compatible defaults ensure all existing courses continue working without downtime.

---

## 8. Course Quality & Readiness Engine

Replace the 4-item boolean checklist with an **Explainable Readiness & Quality Rubric** (`src/lib/courses/quality-evaluator.ts`):
- **Deterministic Checks (Zero AI Cost, Always Available):**
  1. Course identity: title, transformation summary (>50 chars), category, level, cover image.
  2. Learning outcomes: >=2 measurable outcomes defined.
  3. Structural balance: >=1 module, every module has >=1 lesson, no empty lessons (0 blocks).
  4. Assessment coverage: >=1 quiz, assignment, or practice exercise per course.
  5. Placeholder scan: flags unreplaced empty `image` URLs or `example.com` links.
- **Optional AI Pedagogical Review:** Evaluates objective-to-assessment alignment, difficulty progression, and engagement variety — returning actionable, per-lesson suggestions with 1-click jump links.

---

## 9. Acceptance Criteria (Real User Journeys)

1. Manual course creation, editing, quiz creation, preview, and publishing complete with **zero AI calls**.
2. Idea-to-course AI wizard produces editable, reviewable stages without hardcoded 4-module limits.
3. Uploading a PDF/DOCX/PPTX stores it privately, extracts sections, and supports both *Reference-Only* and *AI-Grounded* workflows with citations.
4. Regenerating or AI-editing a single lesson/block creates a `lesson_revisions` snapshot and never overwrites other lessons.
5. Tenant isolation holds across UI routes, Server Actions, API routes, Storage, and Postgres RLS for all roles (`company_admin`, `teacher`, `instructor`, `learner`, `super_admin`, cross-tenant).
6. Failed AI or document extraction leaves existing course data intact and provides a retry path.
