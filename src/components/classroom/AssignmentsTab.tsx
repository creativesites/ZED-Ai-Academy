"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  FileText,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Upload,
  Award,
  ChevronRight,
  ExternalLink,
  Download,
  Trash2,
  Filter,
  Loader2,
  BookOpen,
  Users,
  Check,
  ChevronLeft,
  ArrowLeft,
  X,
  Maximize2,
  Minimize2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClassroomAssignments,
  createClassroomAssignment,
  deleteClassroomAssignment,
  submitClassroomAssignment,
  gradeClassroomSubmission,
  getAssignmentSubmissionsForInstructor,
  type AssignmentWithMeta,
  type RubricCriterion,
} from "@/actions/classroom-assignments";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AssignmentsTabProps {
  companyId: string;
  companySlug: string;
  isAdminOrInstructor: boolean;
  selectedCohortId?: string;
  cohorts?: { id: string; name: string }[];
  courses?: { id: string; title: string }[];
}

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
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // Instructor creation modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newMaxPoints, setNewMaxPoints] = useState("100");
  const [newSubmissionType, setNewSubmissionType] = useState<"file" | "link" | "file_or_link">("file_or_link");
  const [newCohortId, setNewCohortId] = useState("all");
  const [newCourseId, setNewCourseId] = useState("all");
  const [newRubricCriteria, setNewRubricCriteria] = useState<RubricCriterion[]>([
    { id: "1", title: "Technical Completeness", description: "All core requirements implemented", points: 40 },
    { id: "2", title: "Code Quality & Structure", description: "Readable, clean code following conventions", points: 30 },
    { id: "3", title: "Documentation & Testing", description: "Clear instructions and test coverage", points: 30 },
  ]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Student submission modal/drawer state
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");

  // Instructor grading state
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmissionToGrade, setSelectedSubmissionToGrade] = useState<any | null>(null);
  const [inputGrade, setInputGrade] = useState("");
  const [inputFeedback, setInputFeedback] = useState("");

  const [pending, startTransition] = useTransition();

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

  // Group assignments into Overdue, Due This Week, and Upcoming
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.cohort && a.cohort.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const isGradedOrSubmitted =
        a.my_submission?.status === "graded" || a.my_submission?.status === "submitted";
      const isPastDue = new Date(a.due_date) < new Date();

      if (activeListTab === "todo") {
        if (!isAdminOrInstructor && a.my_submission?.status === "graded") return false;
        return matchesSearch;
      } else {
        // "past"
        if (!isAdminOrInstructor) {
          return matchesSearch && (isGradedOrSubmitted || isPastDue);
        }
        return matchesSearch && isPastDue;
      }
    });
  }, [assignments, searchQuery, activeListTab, isAdminOrInstructor]);

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

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter an assignment title.");
      return;
    }
    if (!newDueDate) {
      toast.error("Please select a due date.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("title", newTitle);
        formData.append("description", newDescription);
        formData.append("dueDate", newDueDate);
        formData.append("maxPoints", newMaxPoints);
        formData.append("submissionType", newSubmissionType);
        formData.append("cohortId", newCohortId);
        formData.append("courseId", newCourseId);
        formData.append("rubric", JSON.stringify(newRubricCriteria));
        if (attachmentFile) {
          formData.append("file", attachmentFile);
        }

        await createClassroomAssignment(formData);
        toast.success("Assignment created successfully!");
        setIsCreateOpen(false);
        setNewTitle("");
        setNewDescription("");
        setAttachmentFile(null);
        await fetchAssignments();
      } catch (err: any) {
        toast.error(err.message || "Failed to create assignment");
      }
    });
  };

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

  const handleSubmitAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    if (!submissionFile && !repoUrl.trim() && !submissionNotes.trim()) {
      toast.error("Please attach a file, GitHub repository URL, or notes.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("assignmentId", selectedAssignment.id);
        if (submissionFile) formData.append("file", submissionFile);
        if (repoUrl.trim()) formData.append("repoUrl", repoUrl.trim());
        if (submissionNotes.trim()) formData.append("submissionText", submissionNotes.trim());

        await submitClassroomAssignment(formData);
        toast.success("Assignment submitted successfully!");
        setIsSubmitOpen(false);
        setSubmissionFile(null);
        setRepoUrl("");
        setSubmissionNotes("");
        await fetchAssignments();
      } catch (err: any) {
        toast.error(err.message || "Failed to submit assignment");
      }
    });
  };

  const openGradingModal = async () => {
    if (!selectedAssignment) return;
    setIsGradingOpen(true);
    setLoadingSubmissions(true);
    try {
      const subs = await getAssignmentSubmissionsForInstructor(selectedAssignment.id, companyId);
      setSubmissionsList(subs);
      if (subs.length > 0) {
        selectSubmissionForGrading(subs[0]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load student submissions");
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const selectSubmissionForGrading = (sub: any) => {
    setSelectedSubmissionToGrade(sub);
    setInputGrade(sub.grade !== null && sub.grade !== undefined ? String(sub.grade) : "");
    setInputFeedback(sub.feedback || "");
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
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

        // Refresh submissions in modal
        const subs = await getAssignmentSubmissionsForInstructor(selectedAssignment!.id, companyId);
        setSubmissionsList(subs);
        const updated = subs.find((s: any) => s.id === selectedSubmissionToGrade.id);
        if (updated) setSelectedSubmissionToGrade(updated);

        await fetchAssignments();
      } catch (err: any) {
        toast.error(err.message || "Failed to record grade");
      }
    });
  };

  function formatDueDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusBadge(assignment: AssignmentWithMeta) {
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

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner: Academic Context & Action Bar */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
            <span>Classroom</span>
            <span>•</span>
            <span className="text-[#fd5523] uppercase tracking-wider">
              {selectedAssignment?.cohort?.name || "All Cohorts"}
            </span>
            {selectedAssignment?.course && (
              <>
                <span>•</span>
                <span className="text-slate-600">{selectedAssignment.course.title}</span>
              </>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#062e39] tracking-tight">Assignments & Tasks</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Homework, lab assignments, project deliverables, and rubric evaluations.
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
            <Users className="h-3.5 w-3.5" />
            {isAdminOrInstructor ? "Instructor Mode" : "Viewing as Student"}
          </div>

          {isAdminOrInstructor && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#fd5523] hover:bg-[#e0481d] text-white rounded-xl text-xs font-black px-4 py-2 min-h-[44px] shadow-lg shadow-[#fd5523]/20 gap-2"
            >
              <Plus className="h-4 w-4" />
              New Assignment
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout: Master List (Left) + Detail Drawer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left Column: Master List */}
        <div className={cn("lg:col-span-5 space-y-4", mobileView === "detail" ? "hidden lg:block" : "block")}>
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 border border-slate-100 shadow-sm space-y-4">
            {/* Filter Tabs: Todo vs All Past Works */}
            <div className="flex p-1 bg-slate-100/80 rounded-2xl">
              <button
                onClick={() => setActiveListTab("todo")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[40px]",
                  activeListTab === "todo"
                    ? "bg-white text-[#062e39] shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                Todo ({grouped.overdue.length + grouped.thisWeek.length})
              </button>
              <button
                onClick={() => setActiveListTab("past")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[40px]",
                  activeListTab === "past"
                    ? "bg-white text-[#062e39] shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                All Past Works
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium focus:bg-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 border border-slate-200 rounded px-1.5 py-0.5">
                /
              </span>
            </div>

            {/* Assignment Groups */}
            <div className="space-y-4 sm:space-y-5 pt-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#fd5523] mb-2" />
                  <p className="text-xs font-bold">Loading assignments...</p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No assignments found</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {activeListTab === "todo" ? "You're all caught up on tasks!" : "No past assignments recorded."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Overdue Section */}
                  {grouped.overdue.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-red-600">
                          Overdue ({grouped.overdue.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {grouped.overdue.map((a) => (
                          <AssignmentCard
                            key={a.id}
                            assignment={a}
                            isSelected={selectedAssignmentId === a.id}
                            onSelect={() => {
                              setSelectedAssignmentId(a.id);
                              setMobileView("detail");
                            }}
                            statusBadge={getStatusBadge(a)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Due This Week Section */}
                  {grouped.thisWeek.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                          Due This Week ({grouped.thisWeek.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {grouped.thisWeek.map((a) => (
                          <AssignmentCard
                            key={a.id}
                            assignment={a}
                            isSelected={selectedAssignmentId === a.id}
                            onSelect={() => {
                              setSelectedAssignmentId(a.id);
                              setMobileView("detail");
                            }}
                            statusBadge={getStatusBadge(a)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Section */}
                  {grouped.upcoming.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                          Upcoming ({grouped.upcoming.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {grouped.upcoming.map((a) => (
                          <AssignmentCard
                            key={a.id}
                            assignment={a}
                            isSelected={selectedAssignmentId === a.id}
                            onSelect={() => {
                              setSelectedAssignmentId(a.id);
                              setMobileView("detail");
                            }}
                            statusBadge={getStatusBadge(a)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Assignment Detail Pane */}
        <div className={cn("lg:col-span-7", mobileView === "list" ? "hidden lg:block" : "block")}>
          {selectedAssignment ? (
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm space-y-4 sm:space-y-6 animate-in fade-in duration-300">
              {/* Mobile Back Button */}
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="lg:hidden inline-flex items-center gap-1.5 text-xs font-black text-[#fd5523] hover:text-[#e0481d] min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to All Assignments</span>
              </button>
              {/* Header with Sub-chapter badge & Action Button */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-black uppercase tracking-wider mb-2">
                    {selectedAssignment.cohort?.name || "General Coursework"}
                  </span>
                  <h1 className="text-xl md:text-2xl font-black text-[#062e39] tracking-tight">
                    {selectedAssignment.title}
                  </h1>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Due {formatDueDateTime(selectedAssignment.due_date)} • {selectedAssignment.max_points} max points
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isAdminOrInstructor ? (
                    <>
                      <Button
                        onClick={openGradingModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black px-4 py-2 shadow-sm gap-1.5"
                      >
                        <Award className="h-4 w-4" />
                        Submissions & Grading
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAssignment(selectedAssignment.id, selectedAssignment.title)}
                        className="text-slate-400 hover:text-red-500 rounded-xl"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setIsSubmitOpen(true)}
                      className={cn(
                        "rounded-xl text-xs font-black px-4 py-2 shadow-sm gap-2",
                        selectedAssignment.my_submission
                          ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
                          : "bg-[#fd5523] hover:bg-[#e0481d] text-white shadow-[#fd5523]/20"
                      )}
                    >
                      <Upload className="h-4 w-4" />
                      {selectedAssignment.my_submission ? "Resubmit / Update" : "Submit Assignment"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Grade Card (If Graded) matching Reference Image 4 */}
              {selectedAssignment.my_submission?.status === "graded" && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50/60 border border-sky-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white shadow-sm border border-sky-100 flex items-center justify-center text-sky-600">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#062e39]">Grade Received</h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Graded on{" "}
                        {selectedAssignment.my_submission.graded_at
                          ? formatDueDateTime(selectedAssignment.my_submission.graded_at)
                          : "Recent evaluation"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="bg-white px-4 py-2 rounded-xl border border-sky-100 text-center shadow-xs">
                      <span className="text-xl font-black text-sky-700">
                        {selectedAssignment.my_submission.grade}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        /{selectedAssignment.max_points}
                      </span>
                    </div>

                    {selectedAssignment.my_submission.feedback && (
                      <div className="max-w-xs text-xs text-slate-600 bg-white/80 p-3 rounded-xl border border-sky-100 italic">
                        "{selectedAssignment.my_submission.feedback}"
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Assignment Description */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Description
                </h4>
                <div className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                  {selectedAssignment.description || "No specific instructions provided."}
                </div>
              </div>

              {/* Handouts & Attachments */}
              {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Handouts & Reference Attachments
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedAssignment.attachments.map((att, idx) => (
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
                    <span className="text-base font-black text-[#062e39] mt-0.5 block">
                      {selectedAssignment.max_points} Points
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Submission Mode
                    </span>
                    <span className="text-base font-black text-[#062e39] mt-0.5 block capitalize">
                      {selectedAssignment.submission_type === "file_or_link"
                        ? "File or GitHub Link"
                        : selectedAssignment.submission_type === "file"
                        ? "File Upload Only"
                        : "Repository Link Only"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Deadline
                    </span>
                    <span className="text-sm font-black text-[#062e39] mt-1 block">
                      {new Date(selectedAssignment.due_date).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Rubric Criteria Table */}
                {selectedAssignment.rubric && selectedAssignment.rubric.length > 0 && (
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>Criterion</span>
                      <span>Weight</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedAssignment.rubric.map((rc, idx) => (
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

              {/* Student's Current Submission Status Preview */}
              {!isAdminOrInstructor && selectedAssignment.my_submission && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Your Current Submission</span>
                    <span className="text-[10px] text-slate-400">
                      Submitted on {formatDueDateTime(selectedAssignment.my_submission.submitted_at)}
                    </span>
                  </div>
                  {selectedAssignment.my_submission.file_url && (
                    <div className="flex items-center gap-2 text-xs text-sky-600">
                      <FileCheck2 className="h-4 w-4" />
                      <a
                        href={selectedAssignment.my_submission.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline truncate font-semibold"
                      >
                        {selectedAssignment.my_submission.file_name || "Download submitted file"}
                      </a>
                    </div>
                  )}
                  {selectedAssignment.my_submission.repo_url && (
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <GithubIcon className="h-4 w-4" />
                      <a
                        href={selectedAssignment.my_submission.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline truncate font-semibold"
                      >
                        {selectedAssignment.my_submission.repo_url}
                      </a>
                    </div>
                  )}
                  {selectedAssignment.my_submission.submission_text && (
                    <p className="text-xs text-slate-500 italic mt-1">
                      "{selectedAssignment.my_submission.submission_text}"
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-16 border border-slate-100 shadow-sm text-center text-slate-400">
              <FileText className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Assignment Selected</h3>
              <p className="text-xs text-slate-400 mt-1">
                Select an assignment from the list on the left to review instructions or submit your work.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Create Assignment (Instructor) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-100 max-h-[85dvh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-[#062e39]">Create New Assignment</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl h-8 w-8 text-slate-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 pt-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                  Title *
                </label>
                <Input
                  placeholder="e.g. Week 3: Neural Networks Architecture Implementation"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="rounded-xl font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Cohort / Class
                  </label>
                  <Select value={newCohortId} onValueChange={(v) => setNewCohortId(v ?? "all")}>
                    <SelectTrigger className="rounded-xl text-xs font-bold">
                      <SelectValue placeholder="All Cohorts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cohorts (Institution)</SelectItem>
                      {cohorts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Associated Course
                  </label>
                  <Select value={newCourseId} onValueChange={(v) => setNewCourseId(v ?? "all")}>
                    <SelectTrigger className="rounded-xl text-xs font-bold">
                      <SelectValue placeholder="General / All Courses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">General / Not Specific</SelectItem>
                      {courses.map((crs) => (
                        <SelectItem key={crs.id} value={crs.id}>
                          {crs.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Due Date & Time *
                  </label>
                  <Input
                    type="datetime-local"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="rounded-xl font-medium text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Max Points
                  </label>
                  <Input
                    type="number"
                    value={newMaxPoints}
                    onChange={(e) => setNewMaxPoints(e.target.value)}
                    className="rounded-xl font-medium text-xs"
                    min="1"
                    max="1000"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                  Submission Format
                </label>
                <Select
                  value={newSubmissionType}
                  onValueChange={(v) => setNewSubmissionType((v ?? "file_or_link") as any)}
                >
                  <SelectTrigger className="rounded-xl text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file_or_link">File Upload or GitHub Link (Recommended)</SelectItem>
                    <SelectItem value="file">File Upload Only (PDF / Zip / Docx)</SelectItem>
                    <SelectItem value="link">GitHub Repository Link Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                  Description & Instructions
                </label>
                <Textarea
                  placeholder="Outline assignment instructions, prerequisites, delivery format, and submission deadlines..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="rounded-xl min-h-[100px] text-xs font-medium"
                />
              </div>

              {/* Handout Attachment */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                  Handout Attachment (Optional, PDF / Zip up to 50MB)
                </label>
                <Input
                  type="file"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  className="rounded-xl text-xs font-medium"
                />
              </div>

              {/* Rubric Builder */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Grading Rubric Criteria
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setNewRubricCriteria((prev) => [
                        ...prev,
                        { id: String(Date.now()), title: "New Criterion", points: 10 },
                      ])
                    }
                    className="text-xs text-[#fd5523] hover:text-[#e0481d] h-7"
                  >
                    + Add Criterion
                  </Button>
                </div>

                <div className="space-y-2">
                  {newRubricCriteria.map((crit, idx) => (
                    <div key={crit.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                      <Input
                        placeholder="Criterion title"
                        value={crit.title}
                        onChange={(e) => {
                          const updated = [...newRubricCriteria];
                          updated[idx].title = e.target.value;
                          setNewRubricCriteria(updated);
                        }}
                        className="h-8 rounded-lg text-xs flex-1 bg-white"
                      />
                      <Input
                        type="number"
                        placeholder="Points"
                        value={crit.points}
                        onChange={(e) => {
                          const updated = [...newRubricCriteria];
                          updated[idx].points = parseInt(e.target.value, 10) || 0;
                          setNewRubricCriteria(updated);
                        }}
                        className="h-8 w-20 rounded-lg text-xs bg-white text-right"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setNewRubricCriteria(newRubricCriteria.filter((_, i) => i !== idx))}
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  className="bg-[#fd5523] hover:bg-[#e0481d] text-white rounded-xl text-xs font-black shadow-md shadow-[#fd5523]/20"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Creating...
                    </>
                  ) : (
                    "Publish Assignment"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Submit Assignment (Student) */}
      {isSubmitOpen && selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-[#062e39]">Turn In Assignment</h3>
                <p className="text-xs text-slate-500 font-medium truncate max-w-xs">
                  {selectedAssignment.title}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSubmitOpen(false)}
                className="rounded-xl h-8 w-8 text-slate-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmitAssignment} className="space-y-4 pt-4">
              {/* File Upload Option */}
              {selectedAssignment.submission_type !== "link" && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Upload Solution File (PDF, Zip, Doc, Code)
                  </label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50/50 transition-all cursor-pointer">
                    <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <Input
                      type="file"
                      onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                      className="cursor-pointer text-xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Maximum upload size: 50MB</p>
                  </div>
                </div>
              )}

              {/* GitHub Repo URL Option */}
              {selectedAssignment.submission_type !== "file" && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    GitHub Repository URL
                  </label>
                  <div className="relative">
                    <GithubIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="https://github.com/username/project-repo"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="pl-10 rounded-xl font-medium text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                  Submission Notes or Comments for Instructor
                </label>
                <Textarea
                  placeholder="Optional notes, instructions to run your code, or key highlights..."
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  className="rounded-xl min-h-[80px] text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSubmitOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  className="bg-[#fd5523] hover:bg-[#e0481d] text-white rounded-xl text-xs font-black shadow-md shadow-[#fd5523]/20"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Assignment"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Instructor Grading & Review Drawer */}
      {isGradingOpen && selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-100 max-h-[85dvh] overflow-y-auto animate-in zoom-in-95 duration-200 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-[#062e39]">
                  Review Submissions & Grade
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedAssignment.title} (Max {selectedAssignment.max_points} pts)
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsGradingOpen(false)}
                className="rounded-xl h-8 w-8 text-slate-400"
              >
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
                {/* Students submission list */}
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
                            : "bg-white border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {sub.student?.full_name || sub.student?.email || "Student"}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {formatDueDateTime(sub.submitted_at)}
                          </p>
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

                {/* Grading Panel for selected submission */}
                <div className="md:col-span-7 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                  {selectedSubmissionToGrade ? (
                    <form onSubmit={handleSaveGrade} className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-[#062e39]">
                          {selectedSubmissionToGrade.student?.full_name || "Student Submission"}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {selectedSubmissionToGrade.student?.email} • Submitted on{" "}
                          {formatDueDateTime(selectedSubmissionToGrade.submitted_at)}
                        </p>
                      </div>

                      {/* Downloadable / Clickable Links */}
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
                              Student's Notes:
                            </span>
                            <p className="text-xs text-slate-600 italic">
                              "{selectedSubmissionToGrade.submission_text}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Grade Input */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                          Score (Out of {selectedAssignment.max_points}) *
                        </label>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            placeholder="e.g. 85"
                            value={inputGrade}
                            onChange={(e) => setInputGrade(e.target.value)}
                            max={selectedAssignment.max_points}
                            min="0"
                            className="h-10 rounded-xl bg-white font-black text-sm w-32"
                            required
                          />
                          <span className="text-xs font-bold text-slate-400">
                            / {selectedAssignment.max_points} Points
                          </span>
                        </div>
                      </div>

                      {/* Instructor Feedback */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                          Instructor Evaluation & Rubric Feedback
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
                              Save Grade & Sync Gradebook
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
      )}
    </div>
  );
}

function AssignmentCard({
  assignment,
  isSelected,
  onSelect,
  statusBadge,
}: {
  assignment: AssignmentWithMeta;
  isSelected: boolean;
  onSelect: () => void;
  statusBadge: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "p-4 rounded-2xl border transition-all cursor-pointer space-y-2 group",
        isSelected
          ? "bg-sky-50/70 border-sky-300 shadow-sm shadow-sky-500/5 ring-1 ring-sky-300"
          : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-black text-[#062e39] group-hover:text-sky-700 transition-colors line-clamp-1">
          {assignment.title}
        </h4>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            isSelected ? "text-sky-600 translate-x-0.5" : "text-slate-300"
          )}
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div>{statusBadge}</div>
        <span className="text-[10px] text-slate-400 font-medium">
          Due{" "}
          {new Date(assignment.due_date).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
