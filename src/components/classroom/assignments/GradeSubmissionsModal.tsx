"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Award, Download, ExternalLink, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getAssignmentSubmissionsForInstructor,
  gradeClassroomSubmission,
  type AssignmentWithMeta,
} from "@/actions/classroom-assignments";
import { formatDueDateTime } from "./types";

export function GradeSubmissionsModal({
  open,
  onClose,
  assignment,
  companyId,
  companySlug,
  onGraded,
}: {
  open: boolean;
  onClose: () => void;
  assignment: AssignmentWithMeta | null;
  companyId: string;
  companySlug: string;
  onGraded: () => Promise<void> | void;
}) {
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmissionToGrade, setSelectedSubmissionToGrade] = useState<any | null>(null);
  const [inputGrade, setInputGrade] = useState("");
  const [inputFeedback, setInputFeedback] = useState("");
  const [pending, startTransition] = useTransition();

  const selectSubmissionForGrading = (sub: any) => {
    setSelectedSubmissionToGrade(sub);
    setInputGrade(sub.grade !== null && sub.grade !== undefined ? String(sub.grade) : "");
    setInputFeedback(sub.feedback || "");
  };

  useEffect(() => {
    if (!open || !assignment) {
      setSubmissionsList([]);
      setSelectedSubmissionToGrade(null);
      return;
    }

    let cancelled = false;
    setLoadingSubmissions(true);
    getAssignmentSubmissionsForInstructor(assignment.id, companyId)
      .then((subs) => {
        if (cancelled) return;
        setSubmissionsList(subs);
        if (subs.length > 0) selectSubmissionForGrading(subs[0]);
      })
      .catch((err: any) => {
        if (!cancelled) toast.error(err.message || "Failed to load student submissions");
      })
      .finally(() => {
        if (!cancelled) setLoadingSubmissions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, assignment, companyId]);

  if (!open || !assignment) return null;

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmissionToGrade) return;

    const numericGrade = parseFloat(inputGrade);
    if (isNaN(numericGrade) || numericGrade < 0) {
      toast.error("Please enter a valid non-negative grade score.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("submissionId", selectedSubmissionToGrade.id);
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("grade", String(numericGrade));
        formData.append("feedback", inputFeedback);

        await gradeClassroomSubmission(formData);
        toast.success("Grade saved and student notified!");

        const subs = await getAssignmentSubmissionsForInstructor(assignment.id, companyId);
        setSubmissionsList(subs);
        const updated = subs.find((s: any) => s.id === selectedSubmissionToGrade.id);
        if (updated) setSelectedSubmissionToGrade(updated);

        await onGraded();
      } catch (err: any) {
        toast.error(err.message || "Failed to record grade");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-100 max-h-[85dvh] overflow-y-auto animate-in zoom-in-95 duration-200 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-ink">Review Submissions &amp; Grade</h3>
            <p className="text-xs text-slate-500 font-medium">
              {assignment.title} (Max {assignment.max_points} pts)
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-8 w-8 text-slate-400">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loadingSubmissions ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-xs font-bold">Loading submissions...</p>
          </div>
        ) : submissionsList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No student submissions yet</h4>
            <p className="text-xs text-slate-400 mt-1">
              Enrolled students have not yet submitted their solutions for this assignment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-5 space-y-2 max-h-[500px] overflow-y-auto pr-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                Student Submissions ({submissionsList.length})
              </span>
              {submissionsList.map((sub) => {
                const isSelected = selectedSubmissionToGrade?.id === sub.id;
                const isGraded = sub.status === "graded";
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => selectSubmissionForGrading(sub)}
                    className={cn(
                      "w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3",
                      isSelected
                        ? "bg-indigo-50/70 border-indigo-200 shadow-sm"
                        : "bg-white border-slate-100 hover:border-slate-200",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {sub.student?.full_name || sub.student?.email || "Student"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDueDateTime(sub.submitted_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {isGraded ? (
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                          {sub.grade} pts
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                          Pending
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="md:col-span-7 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
              {selectedSubmissionToGrade ? (
                <form onSubmit={handleSaveGrade} className="space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-ink">
                      {selectedSubmissionToGrade.student?.full_name || "Student Submission"}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {selectedSubmissionToGrade.student?.email} • Submitted on{" "}
                      {formatDueDateTime(selectedSubmissionToGrade.submitted_at)}
                    </p>
                  </div>

                  <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-100">
                    {selectedSubmissionToGrade.file_url && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Submitted File:</span>
                        <a
                          href={selectedSubmissionToGrade.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {selectedSubmissionToGrade.file_name || "Download File"}
                        </a>
                      </div>
                    )}
                    {selectedSubmissionToGrade.repo_url && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">GitHub Repo:</span>
                        <a
                          href={selectedSubmissionToGrade.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View Codebase
                        </a>
                      </div>
                    )}
                    {selectedSubmissionToGrade.submission_text && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                          Student&apos;s Notes:
                        </span>
                        <p className="text-xs text-slate-600 italic">
                          &quot;{selectedSubmissionToGrade.submission_text}&quot;
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                      Score (Out of {assignment.max_points}) *
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        placeholder="e.g. 85"
                        value={inputGrade}
                        onChange={(e) => setInputGrade(e.target.value)}
                        max={assignment.max_points}
                        min="0"
                        className="h-10 rounded-xl bg-white font-black text-sm w-32"
                        required
                      />
                      <span className="text-xs font-bold text-slate-400">/ {assignment.max_points} Points</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                      Instructor Evaluation &amp; Rubric Feedback
                    </label>
                    <Textarea
                      placeholder="Provide constructive feedback, praise strengths, and note improvements..."
                      value={inputFeedback}
                      onChange={(e) => setInputFeedback(e.target.value)}
                      className="rounded-xl min-h-[90px] bg-white text-xs font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={pending}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 gap-1.5"
                    >
                      {pending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Award className="h-3.5 w-3.5" />
                          Save Grade &amp; Sync Gradebook
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs font-bold">Select a student submission to evaluate</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
