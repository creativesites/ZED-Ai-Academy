"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { CourseReviewResult } from "@/app/api/ai/review-course/route";

export function CourseAIReview({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<CourseReviewResult | null>(null);

  async function handleRunReview() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/review-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Unable to review course.");
      }
      setReview(data as CourseReviewResult);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run course review.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl sm:rounded-[2rem] border border-slate-200/80 bg-white p-5 sm:p-6 md:p-8 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-ink">
              AI Curriculum Review
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Analyze structure, pacing, and missing outcomes across your modules.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleRunReview}
          disabled={loading}
          className="h-10 w-full sm:w-auto rounded-xl bg-ink px-5 text-xs sm:text-sm font-bold text-white hover:bg-ink-hover"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4 text-brand-electric" />
              {review ? "Re-run Review" : "Analyze Curriculum"}
            </>
          )}
        </Button>
      </div>

      {review && (
        <div className="space-y-5 border-t border-slate-100 pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <p className="text-sm text-slate-700 leading-relaxed">{review.summary}</p>
            <div className="shrink-0 text-left sm:text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Design Score
              </span>
              <p className="text-2xl font-black text-brand-text">{review.overall_score}/100</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {review.strengths?.length > 0 && (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Strengths
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                  {review.strengths.map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {review.gaps?.length > 0 && (
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Gaps & Missing Outcomes
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                  {review.gaps.map((g) => (
                    <li key={g}>• {g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {review.sequencing_suggestions?.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
                <TrendingUp className="h-4 w-4 text-brand-text" />
                Sequencing & Pacing
              </div>
              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                {review.sequencing_suggestions.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {review.suggested_lessons?.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Suggested Additions
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {review.suggested_lessons.map((lesson) => (
                  <div
                    key={`${lesson.module_title}-${lesson.lesson_title}`}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text">
                      {lesson.module_title}
                    </p>
                    <p className="text-sm font-bold text-ink flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{lesson.lesson_title}</span>
                    </p>
                    <p className="text-xs text-slate-500">{lesson.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
