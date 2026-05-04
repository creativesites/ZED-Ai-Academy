-- Add new content block types: expert_note, comparison_table, case_study, meeting
ALTER TABLE content_blocks
  DROP CONSTRAINT IF EXISTS content_blocks_type_check,
  ADD CONSTRAINT content_blocks_type_check
    CHECK (type IN (
      'video', 'text', 'quiz', 'resource',
      'image', 'callout', 'tool_spotlight', 'before_after',
      'ai_prompt', 'steps', 'checklist', 'key_takeaway',
      'expert_note', 'comparison_table', 'case_study', 'meeting'
    ));
