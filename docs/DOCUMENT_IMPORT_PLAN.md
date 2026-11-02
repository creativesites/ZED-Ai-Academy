# Importing existing teaching material (DOCX / PDF)

Status: proposal, nothing built yet. Written to decide scope before we spend time on it.

## The problem

Many teachers and academies already have their course in Word documents and PDFs. Today they must re-create it block by block in the lesson editor. That is the biggest barrier to onboarding a real academy: it turns "sign up" into "two weeks of copy-paste". The goal is **upload a file, get a reviewable draft course**, not a perfect course.

## What we already have (reuse, don't rebuild)

- A block-based course model (`content_blocks`) and a creator UI around it.
- AI course tooling: `src/app/api/ai/generate-course-blueprint`, `generate-curriculum`, `generate-lesson-content`, `generate-quiz`, and `src/actions/course-ai.ts`, which already **imports a course blueprint**. A document importer only has to produce a blueprint; the existing code turns it into modules, lessons and blocks.
- `@google/genai` is already a dependency, and Gemini accepts PDFs and images directly.
- Supabase Storage buckets and a media library (`media_assets`).

## Principles

1. **Preserve the teacher's words.** Teachers get upset when AI paraphrases their material. Default to structure-only: AI decides *where the breaks go*, the text is copied through verbatim. A separate, opt-in "improve this lesson" action can rewrite later.
2. **Always produce a draft the teacher reviews.** Never publish automatically. Import ends on a review screen.
3. **Deterministic first, AI second.** Word headings are a reliable outline; use them. Use AI only when a document has no usable structure (most PDFs).
4. **Cheap and bounded.** Every import costs money and time; cap size, pages and imports per academy per day.

## Proposed pipeline

```
upload -> store (private, tenant-scoped) -> extract -> outline -> blueprint -> draft course -> review UI
```

### 1. Extraction

| Input | Approach | Notes |
|---|---|---|
| `.docx` | `mammoth` -> semantic HTML (headings, lists, tables, bold/italic, images) | Reliable, no AI needed, preserves heading levels. |
| Text-based `.pdf` | Send the PDF to Gemini with a structured-output schema (the blueprint) | PDFs have no real structure; a model recovers headings and sections better than regex on extracted text. |
| Scanned `.pdf` (images) | Same Gemini path (it reads pages as images) | Slower and costlier; show a warning and an estimate first. |
| `.pptx`, Google Docs link | Phase 3 | Slides map naturally to lessons. |

### 2. Outline rules (DOCX, deterministic)

- Heading 1 = module, Heading 2 = lesson, everything under a heading = that lesson's blocks.
- No headings: fall back to the AI path rather than guessing.
- Paragraphs -> rich-text block. Tables -> table block. Images -> uploaded to the media bucket, image block. Lists stay lists.
- Detect YouTube/Vimeo URLs on their own line -> video block (the player already embeds YouTube).
- Detect question patterns ("1. ... a) b) c) d)", "Answer: ...") -> propose quiz blocks, via the existing quiz generation, marked as suggestions.

### 3. Draft + review (the part that decides whether teachers trust it)

A tree view of the proposed course: rename, merge, split, reorder and drop modules/lessons, with a preview of each lesson. "Create draft course" is the only action that writes to the course tables. Show what was *not* imported (unsupported objects, text boxes, equations) rather than silently dropping it.

### 4. Execution model

Large documents will exceed a normal request. Use an `import_jobs` table (`id, company_id, created_by, file_path, status, progress, result_blueprint, error`), run extraction in a background route with a raised `maxDuration`, and poll or subscribe for progress. The UI shows steps ("Reading file", "Finding structure", "Building lessons"). Failed jobs keep the file and can be retried.

## Risks and how to handle them

- **Security.** Treat every upload as hostile. Allow-list MIME *and* extension, cap size (start at 20 MB) and page count, reject encrypted files, store under `company_id/...` in a private bucket, sanitise generated HTML with an allow-list before it reaches a block, and authorise with `requireTenantTeacher`. DOCX is a zip: guard against zip bombs (cap decompressed size).
- **Cost abuse.** Per-academy daily import quota and a visible page estimate before any AI call. (The audit already flagged missing rate limits on AI routes; this feature must not add another.)
- **Copyright.** Add a confirmation that the uploader has the right to use the material.
- **Fidelity.** Equations, text boxes, tracked changes and complex layouts will not survive. Say so up front.
- **Privacy.** Documents may contain student data. Do not log content; delete the original after N days unless the teacher keeps it as a resource.

## Phasing

1. **Phase 1 (about a week): DOCX, deterministic.** Upload, `mammoth`, heading-based outline, images, tables, review screen, draft creation. No AI cost. This alone covers the best-prepared teachers.
2. **Phase 2: PDF via Gemini.** Same review screen, blueprint from the model, page/cost estimate, quotas, background job.
3. **Phase 3:** scanned-PDF warnings and OCR quality, PPTX, Google Docs/Drive import, "import into an existing course", and an opt-in "improve with AI" pass.

## Decisions needed from you

1. Is **structure-only, verbatim text** the right default, or do teachers expect AI to tidy the writing?
2. Should an import create a **new course** only, or also **append lessons to an existing one**?
3. How many imports per academy per day on the free plan? (Sets cost exposure.)
4. Is Phase 1 (DOCX only) enough to start, or do your first academies mostly have PDFs?
