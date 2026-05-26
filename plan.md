# Plan: Course Creation Studio

## Goal

Unify course creation around the existing DB-backed `content_blocks` system in `src/components/creator/*`, then adapt the strongest UI and preview patterns from `src/components/drag-and-drop/*` onto that model.

The target experience is:

- mobile-first and fully responsive
- strong live preview, especially phone preview
- heavy optional AI support during course creation
- support for AI, technical, mining safety, primary school, and secondary school courses
- one production-grade block system, not two parallel builders

## Current State

### Production creator flow

- Course creation entry: `src/app/(creator)/creator/courses/new/page.tsx`
- Course curriculum builder: `src/components/creator/curriculum-builder.tsx`
- Lesson editor: `src/components/creator/lesson-editor-client.tsx`
- Content block actions: `src/actions/content-blocks.ts`
- Lesson AI generation: `src/components/creator/ai-lesson-generator.tsx`
- Course blueprint import/export: `src/actions/course-ai.ts`

### Legacy builder worth mining for UI patterns

- Visual builder: `src/components/drag-and-drop/DragDropModuleBuilder.tsx`
- Phone shell preview: `src/components/drag-and-drop/MobilePreviewContainer.tsx`
- Preview cards/components: `src/components/drag-and-drop/MobilePreviewComponents.tsx`
- Mining-centric template inventory: `src/components/drag-and-drop/templates.ts`

### Current gaps

- The production lesson editor still relies on `window.location.reload()` after adding AI/generated blocks.
- Creator preview and learner rendering are not clearly standardized around one shared renderer.
- The drag-and-drop builder has stronger preview UX, but its data model is mining-specific and separate from `content_blocks`.
- AI generation currently targets the existing block set only.
- The block taxonomy is still too narrow for primary/secondary school content.

## Architecture Decision

We will standardize on the existing `content_blocks` system and keep `src/components/creator/*` as the source of truth.

We will not port the mining builder as-is.

We will instead extract and adapt these parts from the drag-and-drop builder:

- mobile preview shell
- editor/preview interaction patterns
- stronger block-picker UX
- better content navigation ideas
- useful generalized block concepts

## Product Shape

### Target creator flow

1. Create course
2. Build curriculum
3. Open lesson studio
4. Add/edit/reorder blocks
5. Preview as learner on mobile/tablet/desktop
6. Use AI to generate or refine curriculum, lesson structure, and block content
7. Publish

### AI support should exist at four levels

1. Course blueprint generation
2. Module and lesson scaffolding
3. Full lesson block generation
4. Block-level AI assist: expand, simplify, rewrite, create examples, create assessments

### Domain presets

We should support creator presets that influence suggested blocks, starter structures, and AI prompting:

- AI and digital skills
- technical and vocational
- mining safety
- primary school
- secondary school

## Block Strategy

### Keep and continue using existing generic blocks

- `text`
- `image`
- `video`
- `callout`
- `resource`
- `quiz`
- `ai_prompt`
- `steps`
- `checklist`
- `key_takeaway`
- `practice_exercise`
- `expert_note`
- `comparison_table`
- `case_study`
- `meeting`

### Generalize the strongest mining-specific concepts into reusable training blocks

- `safety-inspection` -> `inspection_checklist`
- `hazard-assessment` -> `risk_assessment`
- `incident-report` -> `incident_scenario`
- `permit-to-work` -> `compliance_workflow`
- `operating-procedure` -> `procedure_steps`
- `maintenance-schedule` -> `schedule_tracker`
- `equipment-specs` -> `specification_card`
- `troubleshooting` -> `diagnostic_flow`
- `pictogram-hazard` -> `visual_hazard_card`
- `ppe-visual-guide` -> `visual_requirements_guide`

### Add school-friendly blocks

- `learning_objectives`
- `glossary`
- `worked_example`
- `flashcards`
- `discussion_prompt`
- `assignment`
- `worksheet`
- `reading_passage`
- `teacher_note`
- `student_reflection`

### First rule for new blocks

Every new block must have:

- a compact JSON schema
- a creator editor
- a preview renderer
- a learner renderer path
- AI prompting guidance

If a proposed block cannot satisfy all five, it should be folded into an existing block instead.

## Execution Plan

## Phase 1: Shared preview foundation

### Objective

Create a single render path for lesson preview and learner display so creator preview matches what learners will see.

### Work

- Audit `src/components/learner/lesson-player-client.tsx` and locate current block rendering boundaries.
- Extract a shared renderer layer, likely under a new area such as:
  - `src/components/course-blocks/`
  - or `src/components/shared/content-blocks/`
- Move production block rendering responsibility there.
- Build a creator preview wrapper around the same renderer.
- Recreate the best parts of the mining-style phone preview using `src/components/drag-and-drop/MobilePreviewContainer.tsx` as design inspiration, not as the actual rendering engine.

### Deliverable

- One shared content-block renderer used by both learner lesson playback and creator preview.

### Success criteria

- Same block content renders consistently in preview and learner view.
- No mining-specific component data remains in the preview path.

## Phase 2: Lesson studio redesign

### Objective

Upgrade the existing lesson editor into a stronger mobile-first studio without changing the storage model.

### Work

- Refactor `src/components/creator/lesson-editor-client.tsx`.
- Keep the current DB-backed block editing flow.
- Replace page reload add-flow with local optimistic state updates where safe.
- Introduce clearer preview toggles:
  - mobile
  - tablet
  - desktop
- Improve the block library and insertion UI using patterns from the drag-and-drop builder.
- Preserve mobile bottom-sheet access to the block library and AI tools.
- Keep block-level save/delete/reorder, but tighten responsiveness and reduce accidental layout friction.

### Deliverable

- A production lesson studio with editor and live preview modes.

### Success criteria

- Smooth mobile authoring.
- No hard reload required after block insertion.
- Preview can be opened and trusted during authoring.

## Phase 3: Block taxonomy expansion

### Objective

Expand beyond AI-course-only assumptions and support broader education/training use cases.

### Work

- Extend `ContentBlockType` in `src/types/database.ts`.
- Add new default schemas and metadata in `src/components/creator/lesson-editor-client.tsx` or extract them into dedicated config files.
- Create editors for each approved new block under `src/components/creator/blocks/`.
- Add matching shared renderers in the new shared block-rendering layer.
- Update any seed/demo content only after the renderer path is stable.

### Deliverable

- A generalized block library usable across mining safety, technical training, and school content.

### Success criteria

- A creator can build at least one credible course in each of these categories:
  - mining safety
  - technical/vocational
  - primary school
  - secondary school

## Phase 4: AI authoring upgrade

### Objective

Make AI assistance deeper and block-aware without forcing it on the user.

### Work

- Expand `src/app/api/ai/generate-lesson-content/route.ts` to target the broader block taxonomy.
- Update `src/components/creator/ai-lesson-generator.tsx` to support:
  - domain preset selection
  - lesson generation style choices
  - review-before-insert where needed
- Expand `src/actions/course-ai.ts` so blueprint prompts include new block schemas.
- Add block-level AI actions over time:
  - rewrite
  - simplify
  - create examples
  - create quiz/checklist/practice blocks from existing text

### Deliverable

- AI authoring that is useful for both full-course generation and assisted manual creation.

### Success criteria

- AI output uses the right block types for the selected course domain.
- Manual creators can still ignore AI entirely and have a strong experience.

## Phase 5: Curriculum-to-lesson cohesion

### Objective

Make curriculum building and lesson authoring feel like one coherent studio.

### Work

- Improve `src/components/creator/curriculum-builder.tsx`.
- Add clearer lesson state indicators:
  - draft
  - preview
  - content started
  - content complete
- Add lightweight lesson summaries or preview stats from `content_blocks`.
- Connect curriculum-level AI generation more tightly with lesson-level authoring.

### Deliverable

- A course creator can move from course outline to lesson authoring without context switching friction.

### Success criteria

- The creator dashboard clearly shows what still needs work in a course.

## File-by-file first implementation pass

### First files to touch

- `src/components/creator/lesson-editor-client.tsx`
- `src/components/learner/lesson-player-client.tsx`
- `src/types/database.ts`
- `src/app/api/ai/generate-lesson-content/route.ts`
- `src/actions/course-ai.ts`

### Files to treat as design/reference input

- `src/components/drag-and-drop/DragDropModuleBuilder.tsx`
- `src/components/drag-and-drop/MobilePreviewContainer.tsx`
- `src/components/drag-and-drop/MobilePreviewComponents.tsx`
- `src/components/drag-and-drop/templates.ts`

### New files likely needed

- shared block renderer components
- shared block schema/default config
- preview-shell components for creator mode
- block-specific editors for newly approved block types

## Scope guardrails

- Do not create a second persisted builder model.
- Do not couple new production blocks to mining-only terminology.
- Do not add many new blocks before shared rendering is in place.
- Do not let creator preview diverge from learner rendering.
- Do not force AI generation into the default happy path.

## Recommended sprint order

### Sprint 1

- shared renderer foundation
- creator preview shell
- lesson editor preview integration

### Sprint 2

- block taxonomy expansion
- first generalized mining-derived blocks
- first school-friendly blocks

### Sprint 3

- AI lesson generation expansion
- domain presets
- block-level AI assist

### Sprint 4

- curriculum/lesson cohesion
- polish
- responsive QA

## Immediate next task

Start with Phase 1.

Concretely:

1. Inspect `src/components/learner/lesson-player-client.tsx` and identify current block rendering boundaries.
2. Design a shared block-rendering layer for existing `content_blocks`.
3. Refactor `src/components/creator/lesson-editor-client.tsx` to consume that renderer in a mobile-first preview panel.
4. Use the mining builder phone-shell patterns as visual inspiration only.
