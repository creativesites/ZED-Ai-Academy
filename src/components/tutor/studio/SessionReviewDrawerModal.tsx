"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  MessageSquare,
  Mic,
  Send,
  Share2,
  Sparkles,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getStaffTutorSessionDetail,
  saveStaffSessionReview,
  type StaffTutorSessionDetail,
  type TeacherSessionReview,
} from "@/actions/tutor-authoring";
import { speakingMsToMinutes } from "@/lib/classroom/speaking-metrics";

function scoreColorClass(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

export function SessionReviewDrawerModal({
  open,
  onOpenChange,
  companyId,
  sessionId,
  onReviewed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  sessionId: string | null;
  onReviewed: (
    sessionId: string,
    updates: { status: string; teacher_review: TeacherSessionReview | null },
  ) => void;
}) {
  const [detail, setDetail] = useState<StaffTutorSessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusChoice, setStatusChoice] = useState<"completed" | "flagged">("completed");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    if (!open || !sessionId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getStaffTutorSessionDetail(companyId, sessionId)
      .then((res) => {
        if (cancelled) return;
        setDetail(res);
        setStatusChoice(res.status === "flagged" ? "flagged" : "completed");
        setFeedbackNotes(res.report?.teacher_review?.notes ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load session transcript");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sessionId, companyId]);

  const handleSaveReview = () => {
    if (!detail) return;
    startSaving(async () => {
      try {
        const res = await saveStaffSessionReview({
          companyId,
          sessionId: detail.id,
          status: statusChoice,
          feedbackNotes,
          notifyStudent,
        });

        setDetail((prev) =>
          prev
            ? {
                ...prev,
                status: res.status,
                report: prev.report
                  ? { ...prev.report, teacher_review: res.teacher_review }
                  : {
                      scores: {},
                      strengths: [],
                      mistakes: [],
                      teacher_review: res.teacher_review,
                    },
              }
            : prev,
        );
        onReviewed(detail.id, res);
        toast.success(
          res.teacher_review
            ? "Teacher review and feedback saved"
            : `Session marked as ${res.status}`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save teacher review");
      }
    });
  };

  const scoreEntries = Object.entries(detail?.report?.scores ?? {});
  const learnerMinutes = speakingMsToMinutes(detail?.learner_speaking_ms ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-4xl flex-col overflow-hidden rounded-3xl border-slate-200 p-0">
        <DialogTitle className="sr-only">Speaking Session Review &amp; Transcript</DialogTitle>
        <DialogDescription className="sr-only">
          Inspect learner speaking turns, rubric scores, and submit teacher review feedback.
        </DialogDescription>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#fd5523]" />
            <p className="text-xs font-bold uppercase tracking-wider">Loading Session Transcript...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
            <p className="text-sm font-bold text-slate-800">{error}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="mt-4 rounded-xl text-xs"
            >
              Close
            </Button>
          </div>
        ) : !detail ? null : (
          <>
            {/* Header */}
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-extrabold text-[#062e39]">
                      {detail.learner.full_name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        detail.status === "flagged"
                          ? "bg-red-100 text-red-700"
                          : detail.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {detail.status === "flagged" && <Flag className="h-3 w-3" />}
                      {detail.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                      {detail.status}
                    </span>
                    {detail.shared_with_teacher && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                        <Share2 className="h-3 w-3" />
                        Shared with Teacher
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-slate-600">
                    {detail.scenario.title}
                    {detail.scenario.goal ? ` — ${detail.scenario.goal}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(detail.started_at).toLocaleString()}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Mic className="h-3 w-3" /> ~{learnerMinutes}m spoken
                    </span>
                    <span>·</span>
                    <span className="uppercase">{detail.origin}</span>
                    <span>·</span>
                    <span className="uppercase">{detail.mode}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="grid flex-1 gap-5 overflow-y-auto p-6 lg:grid-cols-5">
              {/* Left 3 cols: Transcript */}
              <div className="space-y-3 lg:col-span-3">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400">
                  <MessageSquare className="h-3.5 w-3.5 text-[#fd5523]" />
                  Conversation Transcript ({detail.turns.length} turns)
                </h4>

                {detail.turns.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                    No recorded conversation turns in this session yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detail.turns.map((turn) => (
                      <div
                        key={turn.id}
                        className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span>Turn #{turn.idx + 1}</span>
                          <span>
                            {turn.learner_audio_ms
                              ? `${(turn.learner_audio_ms / 1000).toFixed(1)}s speech`
                              : null}
                            {turn.learner_audio_ms && turn.latency_ms ? " · " : null}
                            {turn.latency_ms ? `${turn.latency_ms}ms latency` : null}
                          </span>
                        </div>

                        {turn.learner_text && (
                          <div className="rounded-xl bg-[#062e39]/5 p-2.5 text-xs text-slate-800">
                            <span className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#062e39]">
                              <User className="h-3 w-3" /> Learner
                            </span>
                            <p className="font-medium leading-relaxed">{turn.learner_text}</p>
                          </div>
                        )}

                        {turn.teacher_says.map((say, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs text-slate-700"
                          >
                            <span className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#fd5523]">
                              <Sparkles className="h-3 w-3" /> AI Teacher
                            </span>
                            <p className="font-medium leading-relaxed text-slate-900">{say.text}</p>
                            {say.romanization && (
                              <p className="mt-0.5 text-[11px] text-slate-500">{say.romanization}</p>
                            )}
                            {say.translation && (
                              <p className="mt-0.5 text-[11px] italic text-slate-400">{say.translation}</p>
                            )}
                          </div>
                        ))}

                        {turn.mistakes_noted.length > 0 && (
                          <div className="space-y-1">
                            {turn.mistakes_noted.map((m, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-900"
                              >
                                <span className="font-bold uppercase text-[10px] text-amber-700">
                                  [{m.category}]
                                </span>{" "}
                                Said <span className="line-through opacity-75">{m.said || "—"}</span> →{" "}
                                <span className="font-semibold text-emerald-800">{m.correct}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {turn.other_events.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {turn.other_events.map((ev, idx) => (
                              <span
                                key={idx}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {ev.summary}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right 2 cols: Rubric Report & Teacher Review Form */}
              <div className="space-y-4 lg:col-span-2">
                {/* Rubric Scores */}
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
                    <Award className="h-3.5 w-3.5 text-[#fd5523]" />
                    AI Rubric Assessment
                  </h4>

                  {scoreEntries.length === 0 ? (
                    <p className="text-xs text-slate-400">No automated rubric scores recorded for this session.</p>
                  ) : (
                    <div className="space-y-2">
                      {scoreEntries.map(([metric, val]) => (
                        <div key={metric} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="capitalize text-slate-700">{metric}</span>
                            <span className="text-[#062e39]">{val}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${scoreColorClass(val)}`}
                              style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {detail.report && detail.report.strengths.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        Strengths
                      </p>
                      <ul className="space-y-1 text-[11px] text-slate-600">
                        {detail.report.strengths.map((str, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.report && detail.report.mistakes.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                        Key Corrections ({detail.report.mistakes.length})
                      </p>
                      <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                        {detail.report.mistakes.map((m, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-amber-100 bg-white px-2.5 py-1.5 text-[11px] text-slate-700"
                          >
                            <span className="font-bold text-amber-700">[{m.category}]</span>{" "}
                            <span className="line-through text-slate-400">{m.said || "—"}</span> →{" "}
                            <span className="font-semibold text-emerald-700">{m.correct}</span>
                            {m.note && <p className="mt-0.5 text-[10px] text-slate-500">{m.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Teacher Feedback & Queue Resolution */}
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#062e39]">
                      Teacher Review &amp; Feedback
                    </h4>
                    {detail.report?.teacher_review && (
                      <span className="text-[10px] font-semibold text-emerald-600">
                        Reviewed
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-600">Queue Disposition</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setStatusChoice("completed")}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                          statusChoice === "completed"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusChoice("flagged")}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                          statusChoice === "flagged"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        Keep Flagged
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="teacher-feedback-notes" className="text-[11px] font-bold text-slate-600">
                      Written Feedback for Learner
                    </Label>
                    <textarea
                      id="teacher-feedback-notes"
                      rows={4}
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                      placeholder="Write pronunciation tips, encouragement, or next practice instructions..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#062e39] focus:bg-white focus:outline-none"
                    />
                    {detail.report?.teacher_review?.reviewed_at && (
                      <p className="text-[10px] text-slate-400">
                        Last saved by {detail.report.teacher_review.reviewed_by_name || "Instructor"} on{" "}
                        {new Date(detail.report.teacher_review.reviewed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={notifyStudent}
                      onChange={(e) => setNotifyStudent(e.target.checked)}
                      className="accent-[#fd5523]"
                    />
                    Send in-app feedback notification to learner
                  </label>

                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveReview}
                    className="w-full rounded-xl bg-[#062e39] font-bold text-white hover:bg-[#0a4352]"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Save Teacher Review
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
