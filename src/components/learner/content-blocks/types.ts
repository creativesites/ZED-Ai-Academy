export type Lesson = { id: string; title: string; position: number; is_preview: boolean };
export type Module = { id: string; title: string; position: number; lessons: Lesson[] };
export type ContentBlock = { id: string; type: string; position: number; content: Record<string, unknown> };

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_indices: number[];
  explanation: string | null;
  position: number;
};

export type Quiz = {
  id: string;
  title: string | null;
  pass_threshold: number;
  max_attempts: number;
  quiz_questions: QuizQuestion[];
} | null;
