"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Award,
  CheckCircle2,
  Clock,
  BookOpen,
  Calendar,
  AlertCircle,
  ExternalLink,
  Download,
  Loader2,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  CheckCheck,
  XCircle,
  HelpCircle,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getMyClassroomProgress, type MyClassroomProgress } from "@/actions/classroom";
import { toast } from "sonner";

interface StudentProgressTabProps {
  companyId: string;
  companySlug: string;
  selectedCohortId?: string | null;
  courses?: any[];
}

export function StudentProgressTab({
  companyId,
  companySlug,
  selectedCohortId,
  courses = [],
}: StudentProgressTabProps) {
  const [progress, setProgress] = useState<MyClassroomProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"assignments" | "quizzes" | "attendance" | "certificates">("assignments");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getMyClassroomProgress(companyId, selectedCohortId);
        setProgress(data);
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load academic progress");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId, selectedCohortId]);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#fd5523] mb-3" />
        <p className="text-xs font-bold uppercase tracking-widest">Compiling Academic Record...</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-xs">Unable to load progress record at this time.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Banner & High-Yield Metric Cards */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#062e39] via-[#094150] to-[#062e39] p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-sky-200 text-xs font-black uppercase tracking-wider mb-2 border border-white/10">
              <GraduationCap className="h-3.5 w-3.5 text-[#fd5523]" />
              Academic Transcript &amp; Performance
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white">Your Learning Journey</h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-xl mt-1 font-medium">
              Track course completion, quiz proficiency, homework evaluation scores, and earned credentials.
            </p>
          </div>

          {progress.nextLesson && (
            <Link
              href={`/academy/${companySlug}/course/${progress.nextLesson.course_slug}`}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-[#fd5523] hover:bg-[#e0481d] text-white text-xs font-black shadow-xl shadow-[#fd5523]/30 transition-all shrink-0"
            >
              <BookOpen className="h-4 w-4" />
              Resume: {progress.nextLesson.title}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* 4 Performance Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
              Curriculum Progress
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{progress.completionPercent}%</span>
              <span className="text-[10px] text-slate-300">
                ({progress.completedLessons}/{progress.totalLessons} lessons)
              </span>
            </div>
            <Progress value={progress.completionPercent} className="h-1.5 mt-2 bg-white/10 [&>div]:bg-[#fd5523]" />
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
              Quiz Average
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{progress.avgQuizScore}%</span>
              <span className="text-[10px] text-slate-300">({progress.quizzes.length} tests)</span>
            </div>
            <span className="text-[10px] text-emerald-300 font-bold block mt-2">
              {progress.quizzes.filter((q) => q.passed).length} Passed
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
              Coursework Mark
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{progress.avgAssignmentScore}</span>
              <span className="text-[10px] text-slate-300">/ 100 avg</span>
            </div>
            <span className="text-[10px] text-sky-300 font-bold block mt-2">
              {progress.assignments.length} Submissions
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
              Live Attendance
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{progress.attendancePercent}%</span>
              <span className="text-[10px] text-slate-300">
                ({progress.totalClassesAttended}/{progress.totalClassSessions || 1})
              </span>
            </div>
            <span className="text-[10px] text-emerald-300 font-bold block mt-2">
              {progress.attendanceRecords.filter((a) => a.status === "present").length} Present
            </span>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab("assignments")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
            activeSubTab === "assignments"
              ? "bg-[#062e39] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          <FileCheck2 className="h-3.5 w-3.5" />
          Assignments &amp; Homework ({progress.assignments.length})
        </button>

        <button
          onClick={() => setActiveSubTab("quizzes")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
            activeSubTab === "quizzes"
              ? "bg-[#062e39] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Quiz Results ({progress.quizzes.length})
        </button>

        <button
          onClick={() => setActiveSubTab("attendance")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
            activeSubTab === "attendance"
              ? "bg-[#062e39] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Attendance Records ({progress.attendanceRecords.length})
        </button>

        <button
          onClick={() => setActiveSubTab("certificates")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
            activeSubTab === "certificates"
              ? "bg-[#062e39] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          <Award className="h-3.5 w-3.5" />
          Certificates ({progress.certificates.length})
        </button>
      </div>

      {/* 3. Sub-Tab Content Areas */}
      {/* A. Assignments */}
      {activeSubTab === "assignments" && (
        <div className="space-y-3">
          {progress.assignments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-100">
              <FileCheck2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No assignment submissions recorded</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {progress.assignments.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-3 hover:border-slate-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Coursework Submission
                      </span>
                      <h4 className="text-sm font-black text-[#062e39] mt-0.5">{item.title}</h4>
                    </div>

                    <div className="text-right">
                      {item.grade !== null && item.grade !== undefined ? (
                        <span className="text-lg font-black text-emerald-600">
                          {item.grade} <span className="text-xs text-slate-400 font-bold">/ {item.max_points}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Awaiting Review
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Submitted {new Date(item.submitted_at).toLocaleDateString()}
                    </span>
                    <span className="capitalize px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 font-bold">
                      {item.status.replace("_", " ")}
                    </span>
                  </div>

                  {item.feedback && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Instructor Evaluation &amp; Feedback:
                      </span>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        {item.feedback}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* B. Quizzes */}
      {activeSubTab === "quizzes" && (
        <div className="space-y-3">
          {progress.quizzes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-100">
              <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No quiz attempts logged yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {progress.quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Lesson Assessment
                    </span>
                    <h4 className="text-sm font-black text-[#062e39]">{quiz.title}</h4>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Completed on {new Date(quiz.taken_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={cn(
                      "text-xl font-black block",
                      quiz.passed ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {quiz.score}%
                    </span>
                    <span className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                      quiz.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    )}>
                      {quiz.passed ? "Passed" : "Needs Review"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* C. Attendance */}
      {activeSubTab === "attendance" && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {progress.attendanceRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <UserCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No live attendance sessions recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {progress.attendanceRecords.map((att, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs",
                      att.status === "present"
                        ? "bg-emerald-100 text-emerald-700"
                        : att.status === "late"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    )}>
                      {att.status === "present" ? "✓" : att.status === "late" ? "⏱" : "✕"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Class Session Date: {new Date(att.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <p className="text-[10px] text-slate-400">Verified by Classroom Live Presence</p>
                    </div>
                  </div>

                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border",
                    att.status === "present"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : att.status === "late"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  )}>
                    {att.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* D. Certificates */}
      {activeSubTab === "certificates" && (
        <div className="space-y-4">
          {progress.certificates.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-100">
              <Award className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No certificates issued yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Complete all course curriculum lessons and tests to earn your verified credential.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {progress.certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white border border-amber-200 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                          Verified Credential
                        </span>
                        <h4 className="text-sm font-black text-[#062e39]">{cert.course_title}</h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-amber-100">
                    <span>Issued: {new Date(cert.issued_at).toLocaleDateString()}</span>
                    <span className="font-mono text-[10px] text-slate-400">ID: {cert.public_id}</span>
                  </div>

                  {cert.file_url && (
                    <a
                      href={cert.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#062e39] text-white text-xs font-bold hover:bg-[#fd5523] transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Official Certificate
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
