-- Add practical learning block types: ai_prompt, steps, checklist, key_takeaway
ALTER TABLE content_blocks
  DROP CONSTRAINT IF EXISTS content_blocks_type_check,
  ADD CONSTRAINT content_blocks_type_check
    CHECK (type IN (
      'video', 'text', 'quiz', 'resource',
      'image', 'callout', 'tool_spotlight', 'before_after',
      'ai_prompt', 'steps', 'checklist', 'key_takeaway'
    ));
