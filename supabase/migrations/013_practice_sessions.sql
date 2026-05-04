-- Create practice_sessions table for autosaving user work
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id   uuid    NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  selected_tool text  NOT NULL,
  inputs      jsonb   NOT NULL DEFAULT '{}'::jsonb,
  output      text    NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own practice sessions"
  ON public.practice_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_practice_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_practice_session_updated_at_trigger
  BEFORE UPDATE ON public.practice_sessions
  FOR EACH ROW
  EXECUTE PROCEDURE update_practice_session_updated_at();
