-- ============================================================
-- Course Studio: tutor_session lesson block.
--
-- Adds 'tutor_session' to content_blocks_type_check. The list below is the
-- full current list from 20260518000000_expand_course_studio_block_types.sql
-- (the newest migration that touches this constraint) plus the new type.
--
-- Content shape (validated in src/lib/tutor/tutor-session-block.ts):
--   { scenarioId: uuid, style: 'scene' | 'guided_lesson' | 'oral_check',
--     required: boolean, title?: string, intro?: string }
--
-- NOT APPLIED. This file is written for review only.
-- Idempotent: safe to re-run.
-- ============================================================

BEGIN;

ALTER TABLE public.content_blocks
  DROP CONSTRAINT IF EXISTS content_blocks_type_check,
  ADD CONSTRAINT content_blocks_type_check
    CHECK (type IN (
      'video', 'text', 'quiz', 'resource',
      'image', 'callout', 'tool_spotlight', 'before_after',
      'ai_prompt', 'steps', 'checklist', 'key_takeaway',
      'expert_note', 'comparison_table', 'case_study', 'meeting',
      'practice_exercise', 'learning_objectives', 'glossary',
      'discussion_prompt', 'assignment', 'risk_assessment',
      'tutor_session'
    ));

COMMIT;
