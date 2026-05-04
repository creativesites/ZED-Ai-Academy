"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveQuizAttempt } from "@/actions/quizzes";
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  Loader2,
  Trophy,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

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

type AttemptResult = {
  score: number;
  passed: boolean;
  correctAnswers: Record<string, number[]>;
};

export function QuizPlayer({
  quiz,
  questions,
}: {
  quiz: Quiz;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, startSubmit] = useTransition();

  function toggleAnswer(questionId: string, optionIdx: number) {
    if (submitted) return;
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const has = current.includes(optionIdx);
      return {
        ...prev,
        [questionId]: has
          ? current.filter((i) => i !== optionIdx)
          : [...current, optionIdx],
      };
    });
  }

  function handleSubmit() {
    const unanswered = questions.filter((q) => !answers[q.id]?.length);
    if (unanswered.length > 0) {
      toast.error(`Please answer all ${unanswered.length} remaining question(s)`);
      return;
    }

    startSubmit(async () => {
      try {
        const res = await saveQuizAttempt(quiz.id, answers);
        setResult(res);
        setSubmitted(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to submit quiz");
      }
    });
  }

  function handleRetry() {
    setAnswers({});
    setResult(null);
    setSubmitted(false);
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-slate-500">
        <HelpCircle className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <p>This quiz has no questions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{quiz.title ?? "Quiz"}</h3>
          <p className="text-sm text-slate-600">
            {questions.length} question{questions.length !== 1 ? "s" : ""} • Pass at {quiz.pass_threshold}%
          </p>
        </div>
        {submitted && result && (
          <Badge
            className={
              result.passed
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }
          >
            {result.passed ? <Trophy className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
            {result.score}% — {result.passed ? "Passed" : "Failed"}
          </Badge>
        )}
      </div>

      <div className="space-y-5">
        {questions.map((q, qIdx) => {
          const selected = answers[q.id] ?? [];
          const isCorrect =
            submitted &&
            result &&
            JSON.stringify([...selected].sort()) ===
              JSON.stringify([...(result.correctAnswers[q.id] ?? [])].sort());

          return (
            <div
              key={q.id}
              className={`space-y-3 rounded-2xl border p-5 transition-colors ${
                submitted
                  ? isCorrect
                    ? "border-green-200 bg-green-50/60"
                    : "border-red-200 bg-red-50/60"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-1 shrink-0 text-xs text-slate-500">Q{qIdx + 1}.</span>
                <p className="text-sm font-medium text-slate-900">{q.question}</p>
                {submitted && (
                  <span className="ml-auto shrink-0">
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </span>
                )}
              </div>

              <div className="ml-5 space-y-2">
                {q.options.map((opt, idx) => {
                  const isSelected = selected.includes(idx);
                  const isCorrectOpt =
                    submitted && result && (result.correctAnswers[q.id] ?? []).includes(idx);
                  const isWrongOpt = submitted && isSelected && !isCorrectOpt;

                  return (
                    <button
                      key={idx}
                      onClick={() => toggleAnswer(q.id, idx)}
                      disabled={submitted}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all disabled:cursor-default ${
                        isCorrectOpt && submitted
                          ? "border-green-300 bg-green-100/70 text-green-800"
                          : isWrongOpt
                            ? "border-red-300 bg-red-100/70 text-red-800"
                            : isSelected
                              ? "border-blue-300 bg-blue-50 text-blue-800"
                              : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/40"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs ${
                            isCorrectOpt && submitted
                              ? "border-green-500 bg-green-600 text-white"
                              : isWrongOpt
                                ? "border-red-500 bg-red-600 text-white"
                                : isSelected
                                  ? "border-blue-500 bg-blue-600 text-white"
                                  : "border-slate-300"
                          }`}
                        >
                          {(isSelected || (isCorrectOpt && submitted)) && "✓"}
                        </span>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {submitted && q.explanation && (
                <div className="ml-5 mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-xs text-slate-700">
                    <span className="font-medium text-blue-700">Explanation: </span>
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {submitted && result && (
        <div
          className={`rounded-2xl border p-5 text-center ${
            result.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }`}
        >
          {result.passed ? (
            <>
              <Trophy className="mx-auto mb-2 h-10 w-10 text-amber-500" />
              <h4 className="text-lg font-semibold text-slate-900">Quiz Passed!</h4>
              <p className="mt-1 text-sm text-slate-600">You scored {result.score}% — great work.</p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto mb-2 h-10 w-10 text-red-500" />
              <h4 className="text-lg font-semibold text-slate-900">Not quite — {result.score}%</h4>
              <p className="mt-1 text-sm text-slate-600">
                You need {quiz.pass_threshold}% to pass. Review the answers and try again.
              </p>
              <Button onClick={handleRetry} className="mt-4 bg-blue-600 text-white hover:bg-blue-500">
                <RotateCcw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </>
          )}
        </div>
      )}

      {!submitted && (
        <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-blue-600 text-white hover:bg-blue-500">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
          Submit Answers
        </Button>
      )}
    </div>
  );
}
