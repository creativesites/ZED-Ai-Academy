"use client";

import React, { useState, useMemo } from "react";
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
  Award,
  Download,
  CalendarPlus,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { StudyPacksModal } from "./StudyPacksModal";
import {
  getGoogleCalendarUrl,
  downloadIcsFile,
  getScheduleEventDetails,
} from "@/lib/calendar/calendar-export";
import type { MyClassroomProgress } from "@/actions/classroom";

interface OverviewTabProps {
  companyId: string;
  companySlug: string;
  isAdminOrInstructor: boolean;
  selectedCohort?: {
    id: string;
    name: string;
    academic_period?: string | null;
    primary_teacher?: {
      id: string;
      full_name?: string | null;
      email?: string | null;
      avatar_url?: string | null;
    } | null;
    course?: { id: string; title: string; slug: string } | null;
  } | null;
  sessionState: { is_session_active: boolean; active_room_name: string | null; active_session_id: string | null };
  onNavigateTab: (tabId: string) => void;
  courses?: any[];
  announcements?: any[];
  assignments?: any[];
  materials?: any[];
  schedules?: any[];
  studentProgress?: MyClassroomProgress | null;
  instructorStats?: {
    pendingGradingCount: number;
    materialsCount: number;
    activeStudentsCount: number;
  } | null;
  instructors?: Array<{
    id: string;
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  }>;
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
  schedules = [],
  studentProgress,
  instructorStats,
  instructors = [],
}: OverviewTabProps) {
  const [isStudyPacksModalOpen, setIsStudyPacksModalOpen] = useState(false);
  const isLive = sessionState?.is_session_active;

  // Resolve assigned instructor (cohort lead teacher or academy faculty fallback)
  const assignedInstructor =
    selectedCohort?.primary_teacher || (instructors.length > 0 ? instructors[0] : null);

  // Find next upcoming scheduled class
  const nextScheduleInfo = useMemo(() => {
    if (!schedules || schedules.length === 0) return null;
    const now = new Date();

    // Prioritize schedules for this cohort if filtered
    const cohortSchedules = schedules.filter(
      (s) => !selectedCohort?.id || s.group_id === selectedCohort.id || !s.group_id
    );
    const targetPool = cohortSchedules.length > 0 ? cohortSchedules : schedules;

    const occurrences = targetPool.map((s) => {
      const details = getScheduleEventDetails(s, companySlug);
      return {
        schedule: s,
        details,
        date: new Date(details.startsAt),
        endDate: new Date(details.endsAt),
      };
    });

    // Filter to future or currently running
    const upcoming = occurrences.filter((o) => o.endDate.getTime() >= now.getTime());
    upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (upcoming.length === 0) return null;
    const next = upcoming[0];

    const isToday = next.date.toDateString() === now.toDateString();
    const isTomorrow =
      new Date(now.getTime() + 86400000).toDateString() === next.date.toDateString();

    const timeStr = next.date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const dayStr = isToday
      ? "Today"
      : isTomorrow
      ? "Tomorrow"
      : next.date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

    const diffHours = Math.round((next.date.getTime() - now.getTime()) / (1000 * 60 * 60));
    const countdownStr =
      diffHours <= 0
        ? "Starting soon / in progress"
        : diffHours === 1
        ? "In 1 hour"
        : diffHours < 24
        ? `In ${diffHours} hours`
        : `In ${Math.ceil(diffHours / 24)} days`;

    return {
      ...next,
      timeStr,
      dayStr,
      countdownStr,
      isToday,
    };
  }, [schedules, selectedCohort?.id, companySlug]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Banner & Live Classroom Status */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#062e39] via-[#094150] to-[#062e39] p-4 sm:p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/10 backdrop-blur-md text-sky-200 text-[11px] sm:text-xs font-black uppercase tracking-wider border border-white/10">
                <GraduationCap className="h-3.5 w-3.5 text-[#fd5523]" />
                {selectedCohort?.name || "All Cohorts (Institution)"}
              </span>

              {selectedCohort?.academic_period && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 text-[11px] sm:text-xs font-semibold">
                  {selectedCohort.academic_period}
                </span>
              )}

              {selectedCohort?.course && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 text-slate-300 text-[11px] sm:text-xs font-semibold">
                  {selectedCohort.course.title}
                </span>
              )}

              {isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[11px] sm:text-xs font-black uppercase tracking-wider animate-pulse shadow-lg shadow-red-500/50">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  Live Session Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Classroom Ready
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
              {isAdminOrInstructor ? "Faculty Workspace & Teaching Console" : "Welcome to your Classroom"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              {isAdminOrInstructor
                ? "Manage class sessions, distribute learning materials, evaluate coursework, and guide student cohorts."
                : "Your central hub for class schedule, learning materials, coursework submissions, and discussions."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full md:w-auto">
            {isLive ? (
              <Button
                onClick={() => onNavigateTab("session")}
                className="bg-red-500 hover:bg-red-600 text-white font-black text-xs px-5 py-4 sm:px-6 sm:py-5 rounded-xl sm:rounded-2xl shadow-xl shadow-red-500/30 gap-2 border border-red-400 min-h-[44px] justify-center cursor-pointer"
              >
                <Video className="h-4 w-4 animate-bounce" />
                Join Live Classroom Now
              </Button>
            ) : isAdminOrInstructor ? (
              <Button
                onClick={() => onNavigateTab("session")}
                className="bg-[#fd5523] hover:bg-[#e0481d] text-white font-black text-xs px-5 py-4 sm:px-6 sm:py-5 rounded-xl sm:rounded-2xl shadow-xl shadow-[#fd5523]/30 gap-2 min-h-[44px] justify-center cursor-pointer"
              >
                <Video className="h-4 w-4" />
                Start Live Session
              </Button>
            ) : null}

            {courses.length > 0 && (
              <Link
                href={`/academy/${companySlug}/course/${courses[0]?.slug || ""}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black backdrop-blur-md transition-all border border-white/15 min-h-[44px]"
              >
                <BookOpen className="h-4 w-4 text-[#fd5523]" />
                Course Player
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 2. Instructor Teaching Priority Alerts & Quick Action Register */}
      {isAdminOrInstructor && (
        <div className="space-y-3 sm:space-y-4">
          {/* Actionable Teaching Priority Alert Banner */}
          {instructorStats && instructorStats.pendingGradingCount > 0 && (
            <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                  <AlertCircle className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-800">
                    Teaching Action Required
                  </h4>
                  <p className="text-xs sm:text-sm font-black text-slate-800">
                    {instructorStats.pendingGradingCount} coursework submission
                    {instructorStats.pendingGradingCount > 1 ? "s" : ""} awaiting your evaluation and grading
                  </p>
                </div>
              </div>
              <Button
                onClick={() => onNavigateTab("assignments")}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md gap-1.5 w-full sm:w-auto min-h-[42px] justify-center cursor-pointer"
              >
                Review &amp; Grade Now
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Quick Stats Overview */}
          {instructorStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div
                onClick={() => onNavigateTab("students")}
                className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between hover:border-slate-200 cursor-pointer transition-all min-h-[64px]"
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Cohort Roster
                  </span>
                  <p className="text-lg sm:text-xl font-black text-[#062e39] mt-0.5">
                    {instructorStats.activeStudentsCount} Enrolled Learners
                  </p>
                </div>
                <Users className="h-5 w-5 text-sky-600" />
              </div>

              <div
                onClick={() => onNavigateTab("materials")}
                className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between hover:border-slate-200 cursor-pointer transition-all min-h-[64px]"
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Class Library
                  </span>
                  <p className="text-lg sm:text-xl font-black text-[#062e39] mt-0.5">
                    {instructorStats.materialsCount} Documents &amp; Handouts
                  </p>
                </div>
                <FolderOpen className="h-5 w-5 text-indigo-600" />
              </div>

              <div
                onClick={() => onNavigateTab("session")}
                className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between hover:border-slate-200 cursor-pointer transition-all min-h-[64px]"
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Virtual Classroom
                  </span>
                  <p className="text-lg sm:text-xl font-black text-[#062e39] mt-0.5">
                    {sessionState.is_session_active ? "Session Running" : "Classroom Ready"}
                  </p>
                </div>
                <Video className={cn("h-5 w-5", sessionState.is_session_active ? "text-red-500 animate-pulse" : "text-emerald-600")} />
              </div>
            </div>
          )}

          {/* Instructor Quick Actions */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                  Faculty Quick Actions
                </h3>
                <p className="text-xs sm:text-sm font-black text-[#062e39] mt-0.5">
                  Classroom Management Commands
                </p>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-slate-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-slate-100">
                Instructor
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <button
                onClick={() => onNavigateTab("session")}
                className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-red-200 hover:bg-red-50/40 transition-all text-left group flex flex-col justify-between min-h-[88px] sm:h-28 cursor-pointer"
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Video className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 group-hover:text-red-700">Live Class</p>
                  <p className="text-[10px] text-slate-400">Launch room</p>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("materials")}
                className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/40 transition-all text-left group flex flex-col justify-between min-h-[88px] sm:h-28 cursor-pointer"
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 group-hover:text-sky-700">Upload Files</p>
                  <p className="text-[10px] text-slate-400">Notes &amp; slides</p>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("assignments")}
                className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all text-left group flex flex-col justify-between min-h-[88px] sm:h-28 cursor-pointer"
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 group-hover:text-indigo-700">Set Tasks</p>
                  <p className="text-[10px] text-slate-400">Assignments</p>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("noticeboard")}
                className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/40 transition-all text-left group flex flex-col justify-between min-h-[88px] sm:h-28 cursor-pointer"
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 group-hover:text-amber-800">Broadcast</p>
                  <p className="text-[10px] text-slate-400">Post notice</p>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("timetable")}
                className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/40 transition-all text-left group flex flex-col justify-between min-h-[88px] sm:h-28 cursor-pointer"
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 group-hover:text-purple-700">Schedule</p>
                  <p className="text-[10px] text-slate-400">Timetable slots</p>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("gradebook")}
                className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all text-left group flex flex-col justify-between min-h-[88px] sm:h-28 cursor-pointer"
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 group-hover:text-emerald-700">Gradebook</p>
                  <p className="text-[10px] text-slate-400">Record marks</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Student Resume Learning Banner (Direct Course Player Link) */}
      {!isAdminOrInstructor && studentProgress?.nextLesson && (
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-white border border-orange-200/70 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-[#fd5523] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#fd5523]/30">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#fd5523] block leading-tight">
                Up Next In Your Curriculum
              </span>
              <h3 className="text-sm sm:text-base font-black text-[#062e39] mt-0.5 truncate">
                {studentProgress.nextLesson.title}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Course: {studentProgress.nextLesson.course_title}
              </p>
            </div>
          </div>

          <Link
            href={`/academy/${companySlug}/course/${studentProgress.nextLesson.course_slug}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[#fd5523] hover:bg-[#e0481d] text-white text-xs font-black shadow-lg shadow-[#fd5523]/30 transition-all w-full sm:w-auto shrink-0 min-h-[44px]"
          >
            Resume Lesson
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* 4. Next Scheduled Live Class Card (Calendar Sync + Direct Join) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#fd5523]" />
              <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                Next Scheduled Class
              </h3>
            </div>
            <p className="text-sm sm:text-base font-black text-[#062e39] mt-0.5">
              Live Lesson &amp; Workshop Timetable
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab("timetable")}
            className="text-xs font-black text-[#fd5523] hover:text-[#e0481d] w-fit p-0 h-auto cursor-pointer"
          >
            Full Timetable Calendar <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        {nextScheduleInfo ? (
          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-5">
            <div className="space-y-1.5 max-w-xl min-w-0 w-full">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#062e39] text-white text-[10px] sm:text-[11px] font-black">
                  <Clock className="h-3 w-3 text-sky-400" />
                  {nextScheduleInfo.dayStr} at {nextScheduleInfo.timeStr}
                </span>

                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {nextScheduleInfo.countdownStr}
                </span>

                {nextScheduleInfo.schedule.is_recurring && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-semibold">
                    Weekly
                  </span>
                )}
              </div>

              <h4 className="text-sm sm:text-base font-black text-[#062e39] truncate">
                {nextScheduleInfo.schedule.title}
              </h4>

              {nextScheduleInfo.schedule.topics_covered ? (
                <p className="text-xs text-slate-600 font-medium line-clamp-2">
                  <span className="font-bold text-slate-700">Topics:</span>{" "}
                  {nextScheduleInfo.schedule.topics_covered}
                </p>
              ) : nextScheduleInfo.schedule.description ? (
                <p className="text-xs text-slate-600 font-medium line-clamp-2">
                  {nextScheduleInfo.schedule.description}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 w-full md:w-auto shrink-0">
              <Button
                onClick={() => onNavigateTab("session")}
                className="bg-[#fd5523] hover:bg-[#e0481d] text-white font-bold text-xs rounded-xl shadow-md shadow-[#fd5523]/20 gap-1.5 col-span-3 sm:col-span-1 min-h-[42px] justify-center cursor-pointer"
              >
                <Video className="h-4 w-4" />
                Join Live Room
              </Button>

              <Button
                variant="outline"
                onClick={() => window.open(getGoogleCalendarUrl(nextScheduleInfo.details), "_blank")}
                className="border-slate-200 text-slate-700 hover:bg-white text-[11px] sm:text-xs font-bold rounded-xl gap-1 col-span-2 sm:col-span-1 min-h-[42px] justify-center cursor-pointer"
                title="Add this class to Google Calendar"
              >
                <CalendarPlus className="h-3.5 w-3.5 text-sky-600" />
                Google Cal
              </Button>

              <Button
                variant="outline"
                onClick={() => downloadIcsFile(nextScheduleInfo.details)}
                className="border-slate-200 text-slate-700 hover:bg-white text-[11px] sm:text-xs font-bold rounded-xl gap-1 col-span-1 min-h-[42px] justify-center cursor-pointer"
                title="Download .ics event file"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                .ICS
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 text-center text-slate-400 bg-slate-50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200">
            <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">No scheduled live classes this week</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Check back soon or consult the master timetable calendar for future dates.
            </p>
          </div>
        )}
      </div>

      {/* 5. Main Dashboard Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left Column (8 cols): Academic Progress & Coursework Tasks & Broadcasts */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">
          {/* Student Progress Overview Card */}
          {!isAdminOrInstructor && (
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-3.5 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div>
                  <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                    Your Academic Progress
                  </h3>
                  <p className="text-base sm:text-lg font-black text-[#062e39] mt-0.5">
                    {studentProgress ? `${studentProgress.completionPercent}% Coursework Completed` : "Curriculum Tracking"}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab("progress")}
                  className="border-slate-200 hover:bg-slate-50 text-xs font-black text-[#062e39] rounded-xl gap-1.5 w-full sm:w-auto min-h-[40px] justify-center cursor-pointer"
                >
                  <Award className="h-3.5 w-3.5 text-[#fd5523]" />
                  View Academic Transcript &amp; Grades
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Lessons Mastered</span>
                  <span>
                    {studentProgress?.completedLessons || 0} of {studentProgress?.totalLessons || 1}
                  </span>
                </div>
                <Progress
                  value={studentProgress?.completionPercent || 0}
                  className="h-2.5 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-[#fd5523] [&>div]:to-amber-500"
                />
              </div>

              {/* 3 Academic Metrics Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-1">
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 flex sm:block items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quiz Average
                  </span>
                  <div className="flex items-baseline gap-1 mt-0 sm:mt-0.5">
                    <span className="text-sm sm:text-base font-black text-[#062e39]">
                      {studentProgress?.avgQuizScore || 0}%
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({studentProgress?.quizzes.length || 0} tests)
                    </span>
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 flex sm:block items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Coursework Score
                  </span>
                  <div className="flex items-baseline gap-1 mt-0 sm:mt-0.5">
                    <span className="text-sm sm:text-base font-black text-[#062e39]">
                      {studentProgress?.avgAssignmentScore ? `${studentProgress.avgAssignmentScore} pts` : "—"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({studentProgress?.assignments.length || 0} tasks)
                    </span>
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 flex sm:block items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Live Attendance
                  </span>
                  <div className="flex items-baseline gap-1 mt-0 sm:mt-0.5">
                    <span className="text-sm sm:text-base font-black text-emerald-600">
                      {studentProgress ? `${studentProgress.attendancePercent}%` : "100%"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({studentProgress?.totalClassesAttended || 0} classes)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Assignments / Tasks */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                  Coursework &amp; Tasks
                </h3>
                <p className="text-sm sm:text-base font-black text-[#062e39]">Assignments Due Soon</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("assignments")}
                className="text-xs font-black text-[#fd5523] hover:text-[#e0481d] cursor-pointer"
              >
                View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>

            {assignments.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-slate-400 bg-slate-50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200">
                <FileText className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No pending assignments</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You're completely up to date!</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-2.5">
                {assignments.slice(0, 3).map((a) => {
                  const isDone = a.my_submission?.status === "submitted" || a.my_submission?.status === "graded";
                  const isPast = new Date(a.due_date) < new Date();
                  return (
                    <div
                      key={a.id}
                      onClick={() => onNavigateTab("assignments")}
                      className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0",
                            isDone
                              ? "bg-emerald-50 text-emerald-600"
                              : isPast
                              ? "bg-red-50 text-red-600"
                              : "bg-sky-50 text-sky-600"
                          )}
                        >
                          <FileText className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-[#062e39] group-hover:text-[#fd5523] transition-colors truncate">
                            {a.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            Due {new Date(a.due_date).toLocaleDateString([], { month: "short", day: "numeric" })} • {a.max_points} pts
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">
                            <CheckCircle2 className="h-3 w-3" /> Submitted
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">
                            <AlertCircle className="h-3 w-3" /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">
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
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                  Noticeboard Broadcasts
                </h3>
                <p className="text-sm sm:text-base font-black text-[#062e39]">Class Announcements</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("noticeboard")}
                className="text-xs font-black text-[#fd5523] hover:text-[#e0481d] cursor-pointer"
              >
                View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>

            {announcements.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-slate-400 bg-slate-50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200">
                <Bell className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No announcements posted</p>
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3">
                {announcements.slice(0, 2).map((notice) => (
                  <div
                    key={notice.id}
                    onClick={() => onNavigateTab("noticeboard")}
                    className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all space-y-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#fd5523]">
                        {notice.priority === "urgent" ? "🚨 Urgent Alert" : "📢 Notice"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(notice.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-[#062e39] truncate">{notice.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2 font-medium">
                      {notice.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Assigned Instructor & Documents & AI Study Packs */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
          {/* Assigned Instructor Card */}
          {assignedInstructor && (
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                    Cohort Faculty Lead
                  </h3>
                  <p className="text-xs sm:text-sm font-black text-[#062e39]">Assigned Instructor</p>
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>

              <div className="flex items-center gap-3 pt-0.5">
                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-slate-100">
                  <AvatarImage src={assignedInstructor.avatar_url || ""} />
                  <AvatarFallback className="bg-[#062e39] text-white font-black text-xs sm:text-sm">
                    {assignedInstructor.full_name?.charAt(0) || "T"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-black text-[#062e39] truncate">
                    {assignedInstructor.full_name || "Lead Instructor"}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                    {assignedInstructor.email || "Faculty Mentor"}
                  </p>
                  <span className="text-[10px] text-[#fd5523] font-bold block mt-0.5">
                    Course Instructor &amp; Evaluator
                  </span>
                </div>
              </div>

              <Button
                onClick={() => onNavigateTab("discussions")}
                variant="outline"
                className="w-full border-slate-200 text-[#062e39] hover:bg-slate-50 text-xs font-bold rounded-xl gap-2 mt-2 min-h-[42px] justify-center cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5 text-[#fd5523]" />
                Ask Question in Lounge
              </Button>
            </div>
          )}

          {/* Quick Learning Materials Shelf */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                  Documents &amp; Handouts
                </h3>
                <p className="text-xs sm:text-sm font-black text-[#062e39]">Recently Added</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("materials")}
                className="text-xs font-black text-[#fd5523] hover:text-[#e0481d] cursor-pointer"
              >
                Browse <FolderOpen className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>

            {materials.length === 0 ? (
              <div className="p-5 sm:p-6 text-center text-slate-400 bg-slate-50 rounded-xl sm:rounded-2xl">
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
                    className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50/30 transition-all group min-h-[44px]"
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
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-white border border-orange-200/60 shadow-sm space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#fd5523]">
                <Sparkles className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                <h4 className="text-xs sm:text-sm font-black text-[#062e39]">AI Study Packs</h4>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#fd5523] bg-orange-100/60 px-2 py-0.5 rounded-full">
                Interactive
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Master class topics with AI summaries, flashcards, and revision quizzes.
            </p>
            <Button
              onClick={() => setIsStudyPacksModalOpen(true)}
              className="w-full bg-[#fd5523] hover:bg-[#e0481d] text-white font-bold text-xs rounded-xl shadow-md shadow-[#fd5523]/20 gap-1.5 min-h-[42px] justify-center cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isAdminOrInstructor ? "Manage Study Packs" : "Study & Practice Now"}
            </Button>
          </div>

          {/* Classroom Community & Discussion Shortcut */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-50 to-sky-50/60 border border-indigo-100 space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-2 text-indigo-700">
              <Sparkles className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              <h4 className="text-xs sm:text-sm font-black">Classroom Lounge</h4>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Have questions about homework or upcoming classes? Ask in the topic discussion channels.
            </p>
            <Button
              onClick={() => onNavigateTab("discussions")}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 min-h-[42px] justify-center cursor-pointer"
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
