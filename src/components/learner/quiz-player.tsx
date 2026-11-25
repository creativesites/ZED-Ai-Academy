"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { saveQuizAttempt } from "@/actions/quizzes";
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  Loader2,
  Trophy,
  RotateCcw,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { REQUIRED_TUTOR_HINT } from "@/lib/tutor/tutor-session-block";

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
  /** Missed objectives that are now weak (server-side, enrolled learners only; never for guests). */
  revision?: { objectiveIds: string[]; objectiveTexts: string[]; teacherName: string; href: string } | null;
};

function RevisionOffer({ revision }: { revision: NonNullable<AttemptResult["revision"]> }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/20 bg-white/10 p-4 text-left backdrop-blur-md">
      <p className="text-sm font-semibold">Want a hand with what you missed?</p>
      {revision.objectiveTexts.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-90">
          {revision.objectiveTexts.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <Link
        href={revision.href}
        className="mt-3 inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition-colors hover:bg-slate-100"
      >
        <GraduationCap className="mr-2 h-4 w-4" />
        Go through these with {revision.teacherName}
      </Link>
    </div>
  );
}

export function QuizPlayer({
  quiz,
  questions,
  initialAttempt,
  lessonId,
  courseSlug,
  onPassed,
  attemptsUsed = 0,
  disabled = false,
  guestMode = false,
}: {
  attemptsUsed?: number;
  /** e.g. paid-course preview visitors: show the questions but don't allow submitting. */
  disabled?: boolean;
  /** Open free showcase guest mode: grade interactively client-side without requiring login. */
  guestMode?: boolean;
  quiz: Quiz;
  questions: Question[];
  initialAttempt?: {
    score: number;
    passed: boolean;
    answers?: Record<string, number[]>;
  } | null;
  lessonId?: string;
  courseSlug?: string;
  onPassed?: (score: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number[]>>(
    initialAttempt?.answers ?? {}
  );
  const [result, setResult] = useState<AttemptResult | null>(
    initialAttempt
      ? {
          score: initialAttempt.score,
          passed: initialAttempt.passed,
          correctAnswers: questions.reduce((acc, q) => {
            acc[q.id] = q.correct_indices;
            return acc;
          }, {} as Record<string, number[]>),
        }
      : null
  );
  const [submitted, setSubmitted] = useState(Boolean(initialAttempt?.passed));
  const [submitting, startSubmit] = useTransition();
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    quiz.max_attempts > 0 ? Math.max(0, quiz.max_attempts - attemptsUsed) : null
  );
  const outOfAttempts = attemptsRemaining === 0 && !result?.passed;
  // The answer key is only sent once the learner passes or runs out of attempts.
  const revealed = Boolean(result && Object.keys(result.correctAnswers ?? {}).length > 0);

  function toggleAnswer(questionId: string, optionIdx: number) {
    if (submitted || disabled || outOfAttempts) return;
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

    if (guestMode) {
      let correctCount = 0;
      const correctAnswers: Record<string, number[]> = {};
      for (const q of questions) {
        const expected = [...(q.correct_indices ?? [])].sort();
        const chosen = [...(answers[q.id] ?? [])].sort();
        correctAnswers[q.id] = expected;
        if (expected.length > 0 && JSON.stringify(expected) === JSON.stringify(chosen)) {
          correctCount += 1;
        }
      }
      const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 100;
      const passed = score >= quiz.pass_threshold;
      setResult({ score, passed, correctAnswers });
      setSubmitted(true);
      if (passed) {
        toast.success(`🎉 Great job! You scored ${score}% and passed the quiz!`);
        onPassed?.(score);
      } else {
        toast.error(`Score: ${score}%. You need ${quiz.pass_threshold}% to pass — give it another try!`);
      }
      return;
    }

    startSubmit(async () => {
      try {
        const res = await saveQuizAttempt(quiz.id, answers, lessonId, courseSlug);
        setResult(res);
        if (res.attemptsRemaining !== undefined && res.attemptsRemaining !== null) {
          setAttemptsRemaining(res.attemptsRemaining);
        }
        setSubmitted(true);
        if (res.passed && res.lessonBlocked) {
          // Passed, but the lesson still needs its required speaking practice. The lesson stays open.
          toast.success(`🎉 Great job! You scored ${res.score}% and passed the quiz!`);
          toast.info(REQUIRED_TUTOR_HINT);
        } else if (res.passed) {
          toast.success(`🎉 Great job! You scored ${res.score}% and passed the quiz!`);
          onPassed?.(res.score);
        } else {
          toast.error(`Score: ${res.score}%. You need ${quiz.pass_threshold}% to pass.`);
        }
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header / Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[2rem] bg-slate-50/50 border border-slate-100 p-6 md:p-8">
        <div>
          <h3 className="text-xl font-bold text-ink tracking-tight">{quiz.title ?? "Knowledge Check"}</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {questions.length} question{questions.length !== 1 ? "s" : ""} • {quiz.pass_threshold}% to pass
            {attemptsRemaining !== null && !result?.passed && (
              <> • {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} left</>
            )}
          </p>
        </div>
        {submitted && result && (
          <div className={cn(
            "inline-flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm shadow-lg",
            result.passed ? "bg-green-500 text-white shadow-green-500/20" : "bg-red-500 text-white shadow-red-500/20"
          )}>
            {result.passed ? <Trophy className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result.score}% — {result.passed ? "Passed" : "Failed"}
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {questions.map((q, qIdx) => {
          const selected = answers[q.id] ?? [];
          const isCorrect =
            submitted &&
            revealed &&
            result &&
            JSON.stringify([...selected].sort()) ===
              JSON.stringify([...(result.correctAnswers[q.id] ?? [])].sort());

          return (
            <div
              key={q.id}
              className="group space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: `${qIdx * 100}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-black text-slate-400 group-hover:bg-ink group-hover:text-white transition-colors">
                  0{qIdx + 1}
                </div>
                <p className="text-lg font-bold text-ink leading-snug pt-0.5">{q.question}</p>
              </div>

              <div className="grid gap-3">
                {q.options.map((opt, idx) => {
                  const isSelected = selected.includes(idx);
                  const isCorrectOpt =
                    submitted && revealed && result && (result.correctAnswers[q.id] ?? []).includes(idx);
                  const isWrongOpt = submitted && revealed && isSelected && !isCorrectOpt;

                  return (
                    <button
                      key={idx}
                      onClick={() => toggleAnswer(q.id, idx)}
                      disabled={submitted}
                      className={cn(
                        "relative w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 disabled:cursor-default",
                        submitted
                          ? isCorrectOpt
                            ? "border-green-500 bg-green-50 text-green-900 shadow-sm"
                            : isWrongOpt
                              ? "border-red-500 bg-red-50 text-red-900"
                              : "border-slate-100 bg-slate-50/50 opacity-60"
                          : isSelected
                            ? "border-ink bg-ink text-white shadow-xl shadow-ink/10 translate-x-1"
                            : "border-slate-100 bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:shadow-md"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors",
                          submitted
                            ? isCorrectOpt
                              ? "border-green-600 bg-green-600 text-white"
                              : isWrongOpt
                                ? "border-red-600 bg-red-600 text-white"
                                : "border-slate-200"
                            : isSelected
                              ? "border-white/20 bg-white/20 text-white"
                              : "border-slate-200 bg-white"
                        )}>
                          {(isSelected || (isCorrectOpt && submitted)) && <CheckCircle className="h-3.5 w-3.5" />}
                        </div>
                        <span className="text-sm font-semibold">{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {submitted && q.explanation && (
                <div className="ml-12 rounded-2xl bg-indigo-50/50 border border-indigo-100 p-5 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex gap-3">
                    <HelpCircle className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-1">Deep Dive</p>
                      <p className="text-sm leading-relaxed text-indigo-900/80">{q.explanation}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Results / CTA */}
      <div className="pt-4">
        {submitted && result ? (
          <div className={cn(
            "rounded-[2.5rem] p-10 text-center shadow-2xl animate-in zoom-in duration-500",
            result.passed ? "bg-green-600 text-white" : "bg-ink text-white"
          )}>
            {result.passed ? (
              <>
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-white backdrop-blur-md">
                  <Trophy className="h-10 w-10" />
                </div>
                <h4 className="text-3xl font-bold tracking-tight mb-2">Mastery Confirmed!</h4>
                <p className="text-green-50 font-medium mb-6">You scored {result.score}% — you&apos;ve cleared the pass threshold ({quiz.pass_threshold}%).</p>
                {result.revision && <RevisionOffer revision={result.revision} />}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    onClick={handleRetry}
                    className="rounded-xl border border-white/30 bg-white/15 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/25 transition-all shadow-sm"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retake for Practice
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-500/20 text-red-400 backdrop-blur-md">
                  <RotateCcw className="h-10 w-10" />
                </div>
                <h4 className="text-3xl font-bold tracking-tight mb-2">Almost There — {result.score}%</h4>
                <p className="text-slate-400 font-medium mb-8">
                  {outOfAttempts
                    ? "You've used all your attempts. Your instructor can allow more attempts."
                    : `You need ${quiz.pass_threshold}% to pass. Review the lesson and give it another shot.`}
                </p>
                {!outOfAttempts && <Button 
                  onClick={handleRetry} 
                  className="rounded-2xl bg-brand px-10 py-7 text-lg font-bold text-white hover:bg-brand-hover shadow-xl shadow-brand/20"
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Try Again
                </Button>}
                {result.revision && <RevisionOffer revision={result.revision} />}
              </>
            )}
          </div>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || disabled || outOfAttempts} 
            className="w-full rounded-[2rem] bg-ink py-8 text-xl font-bold text-white hover:bg-ink-hover transition-all hover:scale-[1.01] active:scale-95 shadow-xl"
          >
            {submitting ? (
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
            ) : (
              <CheckCircle className="mr-3 h-6 w-6" />
            )}
            {disabled ? "Enrol to take this quiz" : outOfAttempts ? "No attempts left" : "Submit answers"}
          </Button>
        )}
      </div>
    </div>
  );
}
