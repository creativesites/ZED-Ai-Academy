"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { FileText, Loader2, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteClassroomAssignment,
  getClassroomAssignments,
  type AssignmentWithMeta,
} from "@/actions/classroom-assignments";
import {
  AssignmentStatusBadge,
  type AssignmentsTabProps,
} from "./assignments/types";
import { AssignmentCard } from "./assignments/AssignmentCard";
import { AssignmentDetailPanel } from "./assignments/AssignmentDetailPanel";
import { CreateAssignmentModal } from "./assignments/CreateAssignmentModal";
import { SubmitAssignmentModal } from "./assignments/SubmitAssignmentModal";
import { GradeSubmissionsModal } from "./assignments/GradeSubmissionsModal";

export function AssignmentsTab({
  companyId,
  companySlug,
  isAdminOrInstructor,
  selectedCohortId = "all",
  cohorts = [],
  courses = [],
}: AssignmentsTabProps) {
  const [assignments, setAssignments] = useState<AssignmentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeListTab, setActiveListTab] = useState<"todo" | "past">("todo");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [, startTransition] = useTransition();

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const data = await getClassroomAssignments(companyId, selectedCohortId);
      setAssignments(data);
      if (data.length > 0 && !selectedAssignmentId) {
        setSelectedAssignmentId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [companyId, selectedCohortId]);

  const selectedAssignment = useMemo(() => {
    return assignments.find((a) => a.id === selectedAssignmentId) || assignments[0] || null;
  }, [assignments, selectedAssignmentId]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.cohort && a.cohort.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.course && a.course.title.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCourse =
        selectedCourseFilter === "all" || a.course_id === selectedCourseFilter;

      const isGradedOrSubmitted =
        a.my_submission?.status === "graded" || a.my_submission?.status === "submitted";
      const isPastDue = new Date(a.due_date) < new Date();

      if (activeListTab === "todo") {
        if (!isAdminOrInstructor && a.my_submission?.status === "graded") return false;
        return matchesSearch && matchesCourse;
      }
      if (!isAdminOrInstructor) {
        return matchesSearch && matchesCourse && (isGradedOrSubmitted || isPastDue);
      }
      return matchesSearch && matchesCourse && isPastDue;
    });
  }, [assignments, searchQuery, selectedCourseFilter, activeListTab, isAdminOrInstructor]);

  const grouped = useMemo(() => {
    const now = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(now.getDate() + 7);

    const overdue: AssignmentWithMeta[] = [];
    const thisWeek: AssignmentWithMeta[] = [];
    const upcoming: AssignmentWithMeta[] = [];

    for (const a of filteredAssignments) {
      const due = new Date(a.due_date);
      const isDone = a.my_submission?.status === "graded" || a.my_submission?.status === "submitted";

      if (due < now && !isDone) {
        overdue.push(a);
      } else if (due <= oneWeekFromNow) {
        thisWeek.push(a);
      } else {
        upcoming.push(a);
      }
    }

    return { overdue, thisWeek, upcoming };
  }, [filteredAssignments]);

  const handleDeleteAssignment = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete assignment "${title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteClassroomAssignment(id, companyId, companySlug);
        toast.success("Assignment deleted");
        if (selectedAssignmentId === id) {
          setSelectedAssignmentId(null);
        }
        await fetchAssignments();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete assignment");
      }
    });
  };

  const renderGroupSection = (label: string, items: AssignmentWithMeta[], labelColorClass: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <span className={cn("text-[11px] font-black uppercase tracking-wider", labelColorClass)}>
            {label} ({items.length})
          </span>
        </div>
        <div className="space-y-2">
          {items.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              isSelected={selectedAssignmentId === a.id}
              onSelect={() => {
                setSelectedAssignmentId(a.id);
                setMobileView("detail");
              }}
              statusBadge={
                <AssignmentStatusBadge assignment={a} isAdminOrInstructor={isAdminOrInstructor} />
              }
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
            <span>Classroom</span>
            <span>•</span>
            <span className="text-brand-text uppercase tracking-wider">
              {selectedAssignment?.cohort?.name || "All Cohorts"}
            </span>
            {selectedAssignment?.course && (
              <>
                <span>•</span>
                <span className="text-slate-600 truncate max-w-[200px]">
                  {selectedAssignment.course.title}
                </span>
              </>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-ink tracking-tight">
            Assignments &amp; Tasks
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Homework, lab assignments, project deliverables, and rubric evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-between md:justify-end">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
            <Users className="h-3.5 w-3.5" />
            {isAdminOrInstructor ? "Instructor Mode" : "Viewing as Student"}
          </div>

          {isAdminOrInstructor && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold px-4 h-9 shadow-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Assignment
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        <div className={cn("lg:col-span-5 space-y-4", mobileView === "detail" ? "hidden lg:block" : "block")}>
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 border border-slate-100 shadow-sm space-y-4">
            <div className="flex p-1 bg-slate-100/80 rounded-2xl">
              <button
                onClick={() => setActiveListTab("todo")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[40px]",
                  activeListTab === "todo"
                    ? "bg-white text-ink shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                Todo ({grouped.overdue.length + grouped.thisWeek.length})
              </button>
              <button
                onClick={() => setActiveListTab("past")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[40px]",
                  activeListTab === "past"
                    ? "bg-white text-ink shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                All Past Works
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium focus:bg-white"
                />
              </div>
              {courses.length > 0 && (
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-ink outline-none focus:border-brand sm:max-w-[160px]"
                >
                  <option value="all">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-4 sm:space-y-5 pt-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-text mb-2" />
                  <p className="text-xs font-bold">Loading assignments...</p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No assignments found</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {activeListTab === "todo"
                      ? "You're all caught up on tasks!"
                      : "No past assignments recorded."}
                  </p>
                </div>
              ) : (
                <>
                  {renderGroupSection("Overdue", grouped.overdue, "text-red-600")}
                  {renderGroupSection("Due This Week", grouped.thisWeek, "text-slate-700")}
                  {renderGroupSection("Upcoming", grouped.upcoming, "text-slate-400")}
                </>
              )}
            </div>
          </div>
        </div>

        <div className={cn("lg:col-span-7", mobileView === "list" ? "hidden lg:block" : "block")}>
          <AssignmentDetailPanel
            assignment={selectedAssignment}
            isAdminOrInstructor={isAdminOrInstructor}
            onBackToList={() => setMobileView("list")}
            onOpenGrading={() => setIsGradingOpen(true)}
            onOpenSubmit={() => setIsSubmitOpen(true)}
            onDelete={handleDeleteAssignment}
          />
        </div>
      </div>

      <CreateAssignmentModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        companyId={companyId}
        companySlug={companySlug}
        cohorts={cohorts}
        courses={courses}
        onCreated={fetchAssignments}
      />

      <SubmitAssignmentModal
        open={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        assignment={selectedAssignment}
        companyId={companyId}
        companySlug={companySlug}
        onSubmitted={fetchAssignments}
      />

      <GradeSubmissionsModal
        open={isGradingOpen}
        onClose={() => setIsGradingOpen(false)}
        assignment={selectedAssignment}
        companyId={companyId}
        companySlug={companySlug}
        onGraded={fetchAssignments}
      />
    </div>
  );
}
