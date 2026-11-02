"use client";

import React, { useState } from "react";
import {
  Video,
  Calendar,
  FileText,
  Bell,
  BookOpen,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Upload,
  Users,
  GraduationCap,
  Sparkles,
  ExternalLink,
  ChevronRight,
  UserCheck,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { StudyPacksModal } from "./StudyPacksModal";

interface OverviewTabProps {
  companyId: string;
  companySlug: string;
  isAdminOrInstructor: boolean;
  selectedCohort?: { id: string; name: string; course?: { id: string; title: string; slug: string } | null } | null;
  sessionState: { is_session_active: boolean; active_room_name: string | null; active_session_id: string | null };
  onNavigateTab: (tabId: string) => void;
  courses?: any[];
  announcements?: any[];
  assignments?: any[];
  materials?: any[];
  studentMetrics?: {
    completionPercent: number;
    completedLessons: number;
    totalLessons: number;
    avgQuizScore: number;
    avgAssignmentScore: number;
  };
}

export function OverviewTab({
  companyId,
  companySlug,
  isAdminOrInstructor,
  selectedCohort,
  sessionState,
  onNavigateTab,
  courses = [],
  announcements = [],
  assignments = [],
  materials = [],
  studentMetrics,
}: OverviewTabProps) {
  const [isStudyPacksModalOpen, setIsStudyPacksModalOpen] = useState(false);
  const isLive = sessionState?.is_session_active;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Banner & Live Status */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#062e39] via-[#094150] to-[#062e39] p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-sky-200 text-xs font-black uppercase tracking-wider border border-white/10">
                <GraduationCap className="h-3.5 w-3.5 text-[#fd5523]" />
                {selectedCohort?.name || "Active Classroom"}
              </span>

              {selectedCohort?.course && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 text-slate-300 text-xs font-semibold">
                  {selectedCohort.course.title}
                </span>
              )}

              {isLive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500 text-white text-xs font-black uppercase tracking-wider animate-pulse shadow-lg shadow-red-500/50">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  Live Session Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Classroom Ready
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {isAdminOrInstructor ? "Faculty Workspace & Teaching Console" : "Welcome to your Classroom"}
            </h1>
            <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
              {isAdminOrInstructor
                ? "Manage class sessions, distribute learning materials, evaluate coursework, and guide student cohorts."
                : "Your central hub for class schedule, learning materials, coursework submissions, and discussions."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
            {isLive ? (
              <Button
                onClick={() => onNavigateTab("session")}
                className="bg-red-500 hover:bg-red-600 text-white font-black text-xs px-6 py-5 rounded-2xl shadow-xl shadow-red-500/30 gap-2 border border-red-400"
              >
                <Video className="h-4 w-4 animate-bounce" />
                Join Live Classroom Now
              </Button>
            ) : isAdminOrInstructor ? (
              <Button
                onClick={() => onNavigateTab("session")}
                className="bg-[#fd5523] hover:bg-[#e0481d] text-white font-black text-xs px-6 py-5 rounded-2xl shadow-xl shadow-[#fd5523]/30 gap-2"
              >
                <Video className="h-4 w-4" />
                Start Live Session
              </Button>
            ) : null}

            {courses.length > 0 && (
              <Link
                href={`/academy/${companySlug}/course/${courses[0]?.slug || ""}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black backdrop-blur-md transition-all border border-white/15"
              >
                <BookOpen className="h-4 w-4 text-[#fd5523]" />
                Course Player
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 2. Instructor Quick Action Register (Matching Reference Image 5s-gAppcPAL...) */}
      {isAdminOrInstructor && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Faculty Quick Actions
              </h3>
              <p className="text-sm font-black text-[#062e39] mt-0.5">
                Immediate Classroom Management Commands
              </p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
              Instructor Authority
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={() => onNavigateTab("session")}
              className="p-4 rounded-2xl border border-slate-100 hover:border-red-200 hover:bg-red-50/40 transition-all text-left group flex flex-col justify-between h-28"
            >
              <div className="h-9 w-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 group-hover:text-red-700">Live Class</p>
                <p className="text-[10px] text-slate-400">Launch session</p>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab("materials")}
              className="p-4 rounded-2xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/40 transition-all text-left group flex flex-col justify-between h-28"
            >
              <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 group-hover:text-sky-700">Upload Files</p>
                <p className="text-[10px] text-slate-400">Notes & slides</p>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab("assignments")}
              className="p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all text-left group flex flex-col justify-between h-28"
            >
              <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 group-hover:text-indigo-700">Set Tasks</p>
                <p className="text-[10px] text-slate-400">Assignments</p>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab("noticeboard")}
              className="p-4 rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/40 transition-all text-left group flex flex-col justify-between h-28"
            >
              <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 group-hover:text-amber-800">Broadcast</p>
                <p className="text-[10px] text-slate-400">Announce notice</p>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab("timetable")}
              className="p-4 rounded-2xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/40 transition-all text-left group flex flex-col justify-between h-28"
            >
              <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 group-hover:text-purple-700">Schedule</p>
                <p className="text-[10px] text-slate-400">Timetable slots</p>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab("gradebook")}
              className="p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all text-left group flex flex-col justify-between h-28"
            >
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 group-hover:text-emerald-700">Gradebook</p>
                <p className="text-[10px] text-slate-400">Record marks</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Progress, Assignments & Notices */}
        <div className="lg:col-span-8 space-y-6">
          {/* Student Progress Overview Card */}
          {!isAdminOrInstructor && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Your Academic Progress
                  </h3>
                  <p className="text-lg font-black text-[#062e39] mt-0.5">
                    {studentMetrics?.completionPercent || 0}% Completed
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-700">
                      {studentMetrics?.completedLessons || 0}/{studentMetrics?.totalLessons || 1}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Lessons Finished</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#fd5523] to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, studentMetrics?.completionPercent || 0)}%` }}
                />
              </div>

              {/* Metrics pills */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quiz Average
                  </span>
                  <span className="text-base font-black text-[#062e39] mt-0.5 block">
                    {studentMetrics?.avgQuizScore || 0}%
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Coursework Score
                  </span>
                  <span className="text-base font-black text-[#062e39] mt-0.5 block">
                    {studentMetrics?.avgAssignmentScore ? `${studentMetrics.avgAssignmentScore} pts` : "—"}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Attendance
                  </span>
                  <span className="text-base font-black text-emerald-600 mt-0.5 block">
                    Active
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Assignments / Tasks */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Coursework & Tasks
                </h3>
                <p className="text-base font-black text-[#062e39]">Assignments Due Soon</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("assignments")}
                className="text-xs font-black text-[#fd5523] hover:text-[#e0481d]"
              >
                View All Tasks <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>

            {assignments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No pending assignments</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You're completely up to date!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {assignments.slice(0, 3).map((a) => {
                  const isDone = a.my_submission?.status === "submitted" || a.my_submission?.status === "graded";
                  const isPast = new Date(a.due_date) < new Date();
                  return (
                    <div
                      key={a.id}
                      onClick={() => onNavigateTab("assignments")}
                      className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all flex items-center justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                            isDone
                              ? "bg-emerald-50 text-emerald-600"
                              : isPast
                              ? "bg-red-50 text-red-600"
                              : "bg-sky-50 text-sky-600"
                          )}
                        >
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-[#062e39] group-hover:text-[#fd5523] transition-colors truncate">
                            {a.title}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Due {new Date(a.due_date).toLocaleDateString([], { month: "short", day: "numeric" })} • {a.max_points} pts
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="h-3 w-3" /> Submitted
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2.5 py-1 rounded-lg">
                            <AlertCircle className="h-3 w-3" /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg">
                            <Clock className="h-3 w-3" /> Due Soon
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Notices / Broadcasts */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Noticeboard Broadcasts
                </h3>
                <p className="text-base font-black text-[#062e39]">Latest Class Announcements</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("noticeboard")}
                className="text-xs font-black text-[#fd5523] hover:text-[#e0481d]"
              >
                View Noticeboard <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>

            {announcements.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No announcements posted</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.slice(0, 2).map((notice) => (
                  <div
                    key={notice.id}
                    onClick={() => onNavigateTab("noticeboard")}
                    className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all space-y-1.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#fd5523]">
                        {notice.priority === "urgent" ? "🚨 Urgent Alert" : "📢 Class Announcement"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(notice.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-[#062e39]">{notice.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2 font-medium">
                      {notice.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Quick Document Library Shelf & Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Learning Materials Shelf */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Documents & Handouts
                </h3>
                <p className="text-sm font-black text-[#062e39]">Recently Added</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("materials")}
                className="text-xs font-black text-[#fd5523] hover:text-[#e0481d]"
              >
                Browse <FolderOpen className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>

            {materials.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl">
                <FolderOpen className="h-6 w-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-600">No documents yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {materials.slice(0, 4).map((m) => (
                  <a
                    key={m.id}
                    href={m.file_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50/30 transition-all group"
                  >
                    <div className="h-8 w-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-sky-700">
                        {m.title}
                      </p>
                      <p className="text-[10px] text-slate-400 capitalize">{m.material_type || "document"}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-sky-600 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* AI Study Packs Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-white border border-orange-200/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#fd5523]">
                <Sparkles className="h-5 w-5" />
                <h4 className="text-sm font-black text-[#062e39]">AI Study Packs</h4>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#fd5523] bg-orange-100/60 px-2.5 py-0.5 rounded-full">
                Interactive
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Master class topics with AI-synthesized summaries, interactive flashcards, and revision quizzes.
            </p>
            <Button
              onClick={() => setIsStudyPacksModalOpen(true)}
              className="w-full bg-[#fd5523] hover:bg-[#e0481d] text-white font-bold text-xs rounded-xl shadow-md shadow-[#fd5523]/20 gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isAdminOrInstructor ? "Manage Study Packs" : "Study & Practice Now"}
            </Button>
          </div>

          {/* Classroom Community & Discussion Shortcut */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50 to-sky-50/60 border border-indigo-100 space-y-3">
            <div className="flex items-center gap-2 text-indigo-700">
              <Sparkles className="h-5 w-5" />
              <h4 className="text-sm font-black">Classroom Lounge</h4>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Have questions about homework or upcoming classes? Ask in the topic discussion channels.
            </p>
            <Button
              onClick={() => onNavigateTab("discussions")}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20"
            >
              Open Class Discussions
            </Button>
          </div>
        </div>
      </div>

      {/* AI Study Packs Modal */}
      <StudyPacksModal
        isOpen={isStudyPacksModalOpen}
        onClose={() => setIsStudyPacksModalOpen(false)}
        companyId={companyId}
        companySlug={companySlug}
        cohortId={selectedCohort?.id}
        isAdminOrInstructor={isAdminOrInstructor}
        materials={materials}
      />
    </div>
  );
}
