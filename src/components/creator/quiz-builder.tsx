"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  CheckSquare,
  Loader2,
  GripVertical,
  Settings,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  createQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  updateQuiz,
} from "@/actions/quizzes";

type Question = {
  id: string;
  question: string;
  options: string[];
  correct_indices: number[];
  explanation: string | null;
  position: number;
};

type Quiz = {
  id: string;
  title: string | null;
  pass_threshold: number;
  max_attempts: number;
};

function QuestionEditor({
  q,
  courseId,
  lessonId,
  onDelete,
  onChange,
}: {
  q: Question;
  courseId: string;
  lessonId: string;
  onDelete: (id: string) => void;
  onChange: (id: string, updated: Partial<Question>) => void;
}) {
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [local, setLocal] = useState(q);

  function toggleCorrect(idx: number) {
    const ci = local.correct_indices.includes(idx)
      ? local.correct_indices.filter((i) => i !== idx)
      : [...local.correct_indices, idx];
    setLocal((prev) => ({ ...prev, correct_indices: ci }));
  }

  function setOption(idx: number, val: string) {
    const opts = [...local.options];
    opts[idx] = val;
    setLocal((prev) => ({ ...prev, options: opts }));
  }

  function addOption() {
    setLocal((prev) => ({ ...prev, options: [...prev.options, ""] }));
  }

  function removeOption(idx: number) {
    const opts = local.options.filter((_, i) => i !== idx);
    const ci = local.correct_indices
      .filter((i) => i !== idx)
      .map((i) => (i > idx ? i - 1 : i));
    setLocal((prev) => ({ ...prev, options: opts, correct_indices: ci }));
  }

  function handleSave() {
    startSave(async () => {
      await updateQuestion(q.id, courseId, lessonId, {
        question: local.question,
        options: local.options,
        correct_indices: local.correct_indices,
        explanation: local.explanation,
      });
      onChange(q.id, local);
      toast.success("Question saved");
    });
  }

  function handleDelete() {
    if (!confirm("Delete this question?")) return;
    startDelete(async () => {
      await deleteQuestion(q.id, courseId, lessonId);
      onDelete(q.id);
      toast.success("Question deleted");
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-2 h-4 w-4 shrink-0 text-slate-400" />
        <div className="flex-1 space-y-3">
          <Textarea
            value={local.question}
            onChange={(e) => setLocal((prev) => ({ ...prev, question: e.target.value }))}
            placeholder="Question text..."
            className="resize-none border-slate-300 bg-white text-sm text-slate-900"
            rows={2}
          />

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Options — check correct answer(s)</p>
            {local.options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  onClick={() => toggleCorrect(idx)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    local.correct_indices.includes(idx)
                      ? "border-green-500 bg-green-600 text-white"
                      : "border-slate-300 text-slate-400 hover:border-slate-400"
                  }`}
                >
                  {local.correct_indices.includes(idx) && <CheckSquare className="h-3 w-3" />}
                </button>
                <Input
                  value={opt}
                  onChange={(e) => setOption(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="h-8 flex-1 border-slate-300 bg-white text-sm text-slate-900"
                />
                <button onClick={() => removeOption(idx)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              onClick={addOption}
              variant="outline"
              className="h-7 border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50"
            >
              <Plus className="mr-1 h-3 w-3" /> Add Option
            </Button>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Explanation (shown after answer)</p>
            <Textarea
              value={local.explanation ?? ""}
              onChange={(e) => setLocal((prev) => ({ ...prev, explanation: e.target.value }))}
              placeholder="Why is this the correct answer?"
              className="resize-none border-slate-300 bg-white text-sm text-slate-900"
              rows={2}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Button onClick={handleSave} disabled={saving} className="h-7 bg-[#062e39] text-xs text-white hover:bg-[#0a4055]">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
          <button onClick={handleDelete} disabled={deleting} className="p-1 text-slate-400 hover:text-red-500">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function QuizBuilder({
  lessonId,
  courseId,
  initialQuiz,
  initialQuestions,
}: {
  lessonId: string;
  courseId: string;
  initialQuiz: Quiz | null;
  initialQuestions: Question[];
}) {
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [creating, startCreate] = useTransition();
  const [addingQ, startAddQ] = useTransition();
  const [savingSettings, startSaveSettings] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [threshold, setThreshold] = useState(initialQuiz?.pass_threshold ?? 70);
  const [maxAttempts, setMaxAttempts] = useState(initialQuiz?.max_attempts ?? 3);
  const [quizTitle, setQuizTitle] = useState(initialQuiz?.title ?? "Quiz");

  function handleCreateQuiz() {
    startCreate(async () => {
      const newQuiz = await createQuiz(lessonId, courseId);
      setQuiz(newQuiz);
      setQuizTitle(newQuiz.title ?? "Quiz");
      setThreshold(newQuiz.pass_threshold);
      setMaxAttempts(newQuiz.max_attempts);
      toast.success("Quiz created");
    });
  }

  function handleAddQuestion() {
    if (!quiz) return;
    startAddQ(async () => {
      const newQ = await addQuestion(quiz.id, courseId, lessonId, {
        question: "New question?",
        options: ["Option A", "Option B", "Option C"],
        correct_indices: [0],
        explanation: "",
      });
      setQuestions((prev) => [
        ...prev,
        {
          id: newQ.id,
          question: newQ.question,
          options: newQ.options as string[],
          correct_indices: newQ.correct_indices,
          explanation: newQ.explanation,
          position: newQ.position,
        },
      ]);
      toast.success("Question added");
    });
  }

  async function handleGenerateQuestions() {
    if (!quiz) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, courseId, count: 3 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation failed");
      }
      const { questions: generated } = await res.json();

      for (const q of generated) {
        const saved = await addQuestion(quiz.id, courseId, lessonId, {
          question: q.question,
          options: q.options,
          correct_indices: q.correct_indices,
          explanation: q.explanation,
        });
        setQuestions((prev) => [
          ...prev,
          {
            id: saved.id,
            question: saved.question,
            options: saved.options as string[],
            correct_indices: saved.correct_indices,
            explanation: saved.explanation,
            position: saved.position,
          },
        ]);
      }
      toast.success(`${generated.length} questions generated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  }

  function handleSaveSettings() {
    if (!quiz) return;
    startSaveSettings(async () => {
      await updateQuiz(quiz.id, courseId, lessonId, {
        title: quizTitle,
        pass_threshold: threshold,
        max_attempts: maxAttempts,
      });
      setQuiz((prev) =>
        prev
          ? { ...prev, title: quizTitle, pass_threshold: threshold, max_attempts: maxAttempts }
          : prev
      );
      toast.success("Quiz settings saved");
    });
  }

  if (!quiz) {
    return (
      <div className="space-y-3 py-10 text-center">
        <HelpCircle className="mx-auto h-10 w-10 text-slate-400" />
        <p className="text-sm text-slate-500">No quiz for this lesson yet.</p>
        <Button onClick={handleCreateQuiz} disabled={creating} className="bg-[#fd5523] text-white hover:bg-[#ef4a16]">
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create Quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Settings className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-medium text-slate-800">Quiz Settings</h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600">Title</label>
            <Input
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="h-8 border-slate-300 bg-white text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Pass Threshold (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="h-8 border-slate-300 bg-white text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Max Attempts</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="h-8 border-slate-300 bg-white text-sm text-slate-900"
            />
          </div>
        </div>

        <Button onClick={handleSaveSettings} disabled={savingSettings} className="h-7 bg-[#062e39] text-xs font-bold text-white hover:bg-[#0a4055]">
          {savingSettings ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Save Settings
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-slate-800">Questions</h3>
            <Badge className="bg-slate-100 text-xs text-slate-700">{questions.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerateQuestions}
              disabled={generating}
              variant="outline"
              className="h-7 border-[#fd5523]/25 bg-[#fff6ee] text-xs font-semibold text-[#fd5523] hover:bg-[#ffede4]"
            >
              {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              AI Generate
            </Button>
            <Button
              onClick={handleAddQuestion}
              disabled={addingQ}
              variant="outline"
              className="h-7 border-[#062e39]/15 bg-white text-xs font-semibold text-[#062e39] hover:bg-slate-50"
            >
              {addingQ ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Add Question
            </Button>
          </div>
        </div>

        {questions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No questions yet. Click &quot;Add Question&quot; to get started.</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <QuestionEditor
                key={q.id}
                q={q}
                courseId={courseId}
                lessonId={lessonId}
                onDelete={(id) => setQuestions((prev) => prev.filter((x) => x.id !== id))}
                onChange={(id, updated) =>
                  setQuestions((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
