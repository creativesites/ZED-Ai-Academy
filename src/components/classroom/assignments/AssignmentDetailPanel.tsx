"use client";

import {
  ArrowLeft,
  Award,
  BookOpen,
  Download,
  FileCheck2,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssignmentWithMeta } from "@/actions/classroom-assignments";
import { formatDueDateTime, GithubIcon } from "./types";

export function AssignmentDetailPanel({
  assignment,
  isAdminOrInstructor,
  onBackToList,
  onOpenGrading,
  onOpenSubmit,
  onDelete,
}: {
  assignment: AssignmentWithMeta | null;
  isAdminOrInstructor: boolean;
  onBackToList: () => void;
  onOpenGrading: () => void;
  onOpenSubmit: () => void;
  onDelete: (id: string, title: string) => void;
}) {
  if (!assignment) {
    return (
      <div className="bg-white rounded-3xl p-16 border border-slate-100 shadow-sm text-center text-slate-400">
        <FileText className="h-12 w-12 text-slate-200 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-700">No Assignment Selected</h3>
        <p className="text-xs text-slate-400 mt-1">
          Select an assignment from the list on the left to review instructions or submit your work.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Mobile Back Button */}
      <button
        type="button"
        onClick={onBackToList}
        className="lg:hidden inline-flex items-center gap-1.5 text-xs font-black text-brand-text hover:text-brand-hover min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to All Assignments</span>
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="inline-block px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-black uppercase tracking-wider">
              {assignment.cohort?.name || "General Coursework"}
            </span>
            {assignment.course && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                <BookOpen className="h-3 w-3" />
                {assignment.course.title}
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-black text-ink tracking-tight">
            {assignment.title}
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Due {formatDueDateTime(assignment.due_date)} • {assignment.max_points} max points
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdminOrInstructor ? (
            <>
              <Button
                onClick={onOpenGrading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black px-4 py-2 shadow-sm gap-1.5"
              >
                <Award className="h-4 w-4" />
                Submissions & Grading
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(assignment.id, assignment.title)}
                className="text-slate-400 hover:text-red-500 rounded-xl"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              onClick={onOpenSubmit}
              className={cn(
                "rounded-xl text-xs font-black px-4 py-2 shadow-sm gap-2",
                assignment.my_submission
                  ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  : "bg-brand hover:bg-brand-hover text-white shadow-brand/20",
              )}
            >
              <Upload className="h-4 w-4" />
              {assignment.my_submission ? "Resubmit / Update" : "Submit Assignment"}
            </Button>
          )}
        </div>
      </div>

      {/* Grade Card (If Graded) */}
      {assignment.my_submission?.status === "graded" && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50/60 border border-sky-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white shadow-sm border border-sky-100 flex items-center justify-center text-sky-600">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-ink">Grade Received</h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Graded on{" "}
                {assignment.my_submission.graded_at
                  ? formatDueDateTime(assignment.my_submission.graded_at)
                  : "Recent evaluation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-xl border border-sky-100 text-center shadow-xs">
              <span className="text-xl font-black text-sky-700">{assignment.my_submission.grade}</span>
              <span className="text-xs font-bold text-slate-400">/{assignment.max_points}</span>
            </div>

            {assignment.my_submission.feedback && (
              <div className="max-w-xs text-xs text-slate-600 bg-white/80 p-3 rounded-xl border border-sky-100 italic">
                &quot;{assignment.my_submission.feedback}&quot;
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assignment Description */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</h4>
        <div className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
          {assignment.description || "No specific instructions provided."}
        </div>
      </div>

      {/* Handouts & Attachments */}
      {assignment.attachments && assignment.attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Handouts & Reference Attachments
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assignment.attachments.map((att, idx) => (
              <a
                key={idx}
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate group-hover:text-sky-700">
                    {att.name}
                  </p>
                  <p className="text-[10px] text-slate-400">Click to view / download</p>
                </div>
                <Download className="h-4 w-4 text-slate-400 group-hover:text-sky-600 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Submission Criteria & Rubric Breakdown */}
      <div className="pt-4 border-t border-slate-100 space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Evaluation Criteria & Rubric
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Maximum Points
            </span>
            <span className="text-base font-black text-ink mt-0.5 block">
              {assignment.max_points} Points
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Submission Mode
            </span>
            <span className="text-base font-black text-ink mt-0.5 block capitalize">
              {assignment.submission_type === "file_or_link"
                ? "File or GitHub Link"
                : assignment.submission_type === "file"
                  ? "File Upload Only"
                  : "Repository Link Only"}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Deadline
            </span>
            <span className="text-sm font-black text-ink mt-1 block">
              {new Date(assignment.due_date).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {assignment.rubric && assignment.rubric.length > 0 && (
          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>Criterion</span>
              <span>Weight</span>
            </div>
            <div className="divide-y divide-slate-100">
              {assignment.rubric.map((rc, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">{rc.title}</h5>
                    {rc.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{rc.description}</p>
                    )}
                  </div>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg shrink-0">
                    {rc.points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Student Current Submission Preview */}
      {!isAdminOrInstructor && assignment.my_submission && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Your Current Submission</span>
            <span className="text-[10px] text-slate-400">
              Submitted on {formatDueDateTime(assignment.my_submission.submitted_at)}
            </span>
          </div>
          {assignment.my_submission.file_url && (
            <div className="flex items-center gap-2 text-xs text-sky-600">
              <FileCheck2 className="h-4 w-4" />
              <a
                href={assignment.my_submission.file_url}
                target="_blank"
                rel="noreferrer"
                className="underline truncate font-semibold"
              >
                {assignment.my_submission.file_name || "Download submitted file"}
              </a>
            </div>
          )}
          {assignment.my_submission.repo_url && (
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <GithubIcon className="h-4 w-4" />
              <a
                href={assignment.my_submission.repo_url}
                target="_blank"
                rel="noreferrer"
                className="underline truncate font-semibold"
              >
                {assignment.my_submission.repo_url}
              </a>
            </div>
          )}
          {assignment.my_submission.submission_text && (
            <p className="text-xs text-slate-500 italic mt-1">
              &quot;{assignment.my_submission.submission_text}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
