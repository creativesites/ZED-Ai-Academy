"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
  ListFilter,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  X,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getAcademyGradebook,
  type AcademyGradebookData,
  type StudentGradebookRecord,
  type GradebookQuizAttempt,
} from "@/actions/classroom";

export function GradebookTab({
  companyId,
  companySlug,
  initialSelectedStudentId,
}: {
  companyId: string;
  companySlug: string;
  initialSelectedStudentId?: string;
}) {
  const [data, setData] = useState<AcademyGradebookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "inactive">("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<StudentGradebookRecord | null>(null);

  async function loadGradebook() {
    setLoading(true);
    try {
      const result = await getAcademyGradebook(companyId);
      setData(result);
      if (initialSelectedStudentId) {
        const found = result.students.find((s) => s.id === initialSelectedStudentId);
        if (found) setSelectedStudent(found);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load gradebook records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGradebook();
  }, [companyId]);

  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];

    return data.students.filter((student) => {
      // Search filter
      const matchesSearch =
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || student.status === statusFilter;

      // Course filter
      const matchesCourse =
        courseFilter === "all" ||
        student.enrolledCourseTitles.some((title) =>
          title.toLowerCase().includes(courseFilter.toLowerCase())
        );

      return matchesSearch && matchesStatus && matchesCourse;
    });
  }, [data?.students, searchQuery, statusFilter, courseFilter]);

  function exportCSV() {
    if (!data?.students.length) return;

    const headers = [
      "Student Name",
      "Email",
      "Enrolled Courses",
      "Completed Lessons",
      "Total Lessons",
      "Completion Rate (%)",
      "Average Quiz Score (%)",
      "Passed Quizzes",
      "Certificates Count",
      "Status",
    ];

    const rows = filteredStudents.map((s) => [
      `"${s.full_name}"`,
      `"${s.email}"`,
      `"${s.enrolledCourseTitles.join(", ")}"`,
      s.completedLessons,
      s.totalLessons,
      s.completionPercent,
      s.avgQuizScore,
      s.passedQuizzesCount,
      s.certificates.length,
      s.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${companySlug}-gradebook-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Gradebook CSV exported!");
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  return (
    <div className="flex h-full flex-col bg-slate-50/40">
      {/* Header & Metrics */}
      <div className="p-6 sm:p-8 pb-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-black text-[#062e39] tracking-tight">
                Student Gradebook & Analytics
              </h2>
              <GraduationCap className="h-7 w-7 text-[#fd5523]" />
            </div>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Inspect student lesson completion, quiz test scores, and certification records.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadGradebook}
              disabled={loading}
              className="rounded-xl h-10 px-3.5 text-xs font-bold border-slate-200 hover:bg-slate-50"
            >
              <RotateCcw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>

            <Button
              onClick={exportCSV}
              disabled={!data?.students.length}
              className="bg-[#062e39] hover:bg-[#0a4555] text-white rounded-xl h-10 px-4 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Stat 1 */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-orange-50 text-[#fd5523] flex items-center justify-center shrink-0 border border-orange-100">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Enrolled Students
              </p>
              <p className="text-xl sm:text-2xl font-black text-[#062e39] tracking-tight">
                {data?.metrics.totalStudents ?? 0}
              </p>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Avg. Completion
              </p>
              <p className="text-xl sm:text-2xl font-black text-[#062e39] tracking-tight">
                {data?.metrics.avgCompletionRate ?? 0}%
              </p>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Award className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Avg. Quiz Score
              </p>
              <p className="text-xl sm:text-2xl font-black text-[#062e39] tracking-tight">
                {data?.metrics.avgQuizScore ?? 0}%
              </p>
            </div>
          </div>

          {/* Stat 4 */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Certificates Issued
              </p>
              <p className="text-xl sm:text-2xl font-black text-[#062e39] tracking-tight">
                {data?.metrics.certificatesIssued ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by student name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl border-slate-200 bg-white font-medium text-xs focus:ring-[#fd5523]/20"
            />
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
            {(["all", "active", "completed", "inactive"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                  statusFilter === status
                    ? "bg-[#fd5523] text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Course filter dropdown if multiple courses */}
          {data?.courses && data.courses.length > 1 && (
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#fd5523]/20"
            >
              <option value="all">All Courses</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.title}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Gradebook Table View */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-9 w-9 animate-spin mb-3 text-[#fd5523]" />
            <p className="text-xs font-bold uppercase tracking-wider">Loading Gradebook Records...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs max-w-lg mx-auto my-8">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-300">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h3 className="text-base font-black text-slate-800">No Student Records Found</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {searchQuery
                ? `No students match "${searchQuery}".`
                : "No students have enrolled or completed lessons in this academy yet."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Enrolled Course</th>
                    <th className="py-3.5 px-4 min-w-[160px]">Lesson Progress</th>
                    <th className="py-3.5 px-4 text-center">Quiz Score</th>
                    <th className="py-3.5 px-4 text-center">Certificates</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedStudent(student)}
                    >
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0 border border-slate-200/60">
                            {student.avatar_url ? (
                              <img src={student.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              student.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-[#fd5523] transition-colors truncate">
                              {student.full_name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{student.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Course */}
                      <td className="py-3.5 px-4 text-slate-600 font-semibold max-w-[200px] truncate">
                        {student.enrolledCourseTitles.join(", ") || "General Academy"}
                      </td>

                      {/* Progress */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-slate-500">
                              {student.completedLessons} / {student.totalLessons} lessons
                            </span>
                            <span
                              className={cn(
                                "font-black",
                                student.completionPercent >= 100 ? "text-emerald-600" : "text-slate-700"
                              )}
                            >
                              {student.completionPercent}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                student.completionPercent >= 100 ? "bg-emerald-500" : "bg-[#fd5523]"
                              )}
                              style={{ width: `${student.completionPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Quiz Score */}
                      <td className="py-3.5 px-4 text-center">
                        {student.quizAttempts.length > 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border",
                              getScoreColor(student.avgQuizScore)
                            )}
                          >
                            {student.avgQuizScore}%
                            <span className="text-[10px] font-medium opacity-75">
                              ({student.passedQuizzesCount}/{student.quizAttempts.length})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-bold">No Quizzes</span>
                        )}
                      </td>

                      {/* Certificates */}
                      <td className="py-3.5 px-4 text-center">
                        {student.certificates.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-200">
                            <Sparkles className="h-3 w-3" />
                            {student.certificates.length} Issued
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudent(student);
                          }}
                          className="h-8 px-2.5 text-xs font-bold text-slate-500 hover:text-[#fd5523] hover:bg-orange-50 rounded-lg"
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over / Modal for Student Detailed Gradebook Inspection */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-orange-50 text-[#fd5523] flex items-center justify-center font-bold text-base overflow-hidden border border-orange-100 shrink-0">
                  {selectedStudent.avatar_url ? (
                    <img src={selectedStudent.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    selectedStudent.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                    {selectedStudent.full_name}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <Mail className="h-3 w-3" /> {selectedStudent.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Lesson Progress
                </p>
                <p className="text-lg font-black text-slate-900 mt-0.5">
                  {selectedStudent.completionPercent}%
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {selectedStudent.completedLessons} of {selectedStudent.totalLessons} lessons
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Avg. Quiz Score
                </p>
                <p className="text-lg font-black text-slate-900 mt-0.5">
                  {selectedStudent.avgQuizScore}%
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {selectedStudent.passedQuizzesCount} passed quizzes
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Certificates
                </p>
                <p className="text-lg font-black text-slate-900 mt-0.5">
                  {selectedStudent.certificates.length}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">Verified credentials</p>
              </div>
            </div>

            {/* Section 1: Quiz Submissions Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-[#fd5523]" /> Quiz Submissions & Attempts
              </h4>

              {selectedStudent.quizAttempts.length === 0 ? (
                <div className="p-5 rounded-2xl bg-slate-50 text-center text-xs text-slate-400 font-medium">
                  This student has not attempted any quizzes in this academy yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {selectedStudent.quizAttempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{attempt.quiz_title}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(attempt.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-black border",
                            getScoreColor(attempt.score)
                          )}
                        >
                          {attempt.score}%
                        </span>
                        {attempt.passed ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Passed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500">
                            <XCircle className="h-3.5 w-3.5" /> Retake Needed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Certificates Issued */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-600" /> Issued Certificates
              </h4>

              {selectedStudent.certificates.length === 0 ? (
                <div className="p-5 rounded-2xl bg-slate-50 text-center text-xs text-slate-400 font-medium">
                  No certificate issued yet. Certificates are generated automatically upon 100% course completion.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudent.certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-3.5 rounded-2xl border border-purple-100 bg-purple-50/40 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-purple-950">{cert.course_title}</p>
                        <p className="text-[10px] text-purple-600 font-mono mt-0.5">
                          ID: {cert.public_id} • Issued on {new Date(cert.issued_at).toLocaleDateString()}
                        </p>
                      </div>

                      <a
                        href={`/verify/${cert.public_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        Verify Credential
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setSelectedStudent(null)}
                className="rounded-xl px-5 text-xs font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
