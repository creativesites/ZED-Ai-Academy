import React from "react";
import { AlertCircle, Award, CheckCircle2, Clock, Users } from "lucide-react";
import type { AssignmentWithMeta } from "@/actions/classroom-assignments";

export interface AssignmentsTabProps {
  companyId: string;
  companySlug: string;
  isAdminOrInstructor: boolean;
  selectedCohortId?: string;
  cohorts?: { id: string; name: string }[];
  courses?: { id: string; title: string }[];
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function formatDueDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AssignmentStatusBadge({
  assignment,
  isAdminOrInstructor,
}: {
  assignment: AssignmentWithMeta;
  isAdminOrInstructor: boolean;
}) {
  if (isAdminOrInstructor) {
    const count = assignment.submissions_count || { total: 0, graded: 0, pending: 0 };
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
        <Users className="h-3 w-3" />
        {count.total} Submissions ({count.graded} Graded)
      </span>
    );
  }

  const sub = assignment.my_submission;
  const isPast = new Date(assignment.due_date) < new Date();

  if (sub?.status === "graded") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
        <Award className="h-3 w-3 text-emerald-600" />
        GRADED · {sub.grade}/{assignment.max_points} points
      </span>
    );
  }

  if (sub?.status === "submitted" || sub?.status === "late") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800">
        <CheckCircle2 className="h-3 w-3 text-sky-600" />
        {sub.status === "late" ? "SUBMITTED LATE" : "SUBMITTED"}
      </span>
    );
  }

  if (isPast) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800">
        <AlertCircle className="h-3 w-3 text-red-600" />
        OVERDUE
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/50">
      <Clock className="h-3 w-3 text-amber-600" />
      Due Soon
    </span>
  );
}
