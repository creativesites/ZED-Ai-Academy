"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Video,
  Download,
  Building2,
  User,
  Sparkles,
  CalendarDays,
  ExternalLink,
  ChevronRight,
  Filter,
  Bell,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPersonalReminder } from "@/actions/notifications";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ScheduleItem = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  instructor_id: string | null;
  schedule_type: string;
  day_of_week: number | null;
  start_time_only: string | null;
  end_time_only: string | null;
  topics_covered: string | null;
  is_recurring: boolean;
  companies?: {
    id: string;
    name: string;
    slug: string;
    is_session_active?: boolean;
    active_room_name?: string | null;
  } | null;
};

type CompanyInfo = {
  id: string;
  name: string;
  slug: string;
};

function getGoogleCalendarUrl(lesson: ScheduleItem, companySlug: string) {
  const title = encodeURIComponent(lesson.title || "Live Class");
  const details = encodeURIComponent(
    `${lesson.topics_covered ? `Topics: ${lesson.topics_covered}\n\n` : ""}Join live classroom: ${
      typeof window !== "undefined" ? window.location.origin : ""
    }/academy/${companySlug}/classroom?tab=session`
  );
  const location = encodeURIComponent("Zed AI Academy - Classroom");

  let startIso = "";
  let endIso = "";
  if (lesson.is_recurring && lesson.start_time_only) {
    const today = new Date();
    const targetDay = lesson.day_of_week || 1;
    const currentDay = today.getDay() === 0 ? 7 : today.getDay();
    let diff = targetDay - currentDay;
    if (diff < 0) diff += 7;
    const targetDate = new Date(today.getTime() + diff * 86400000);
    const [sh, sm] = (lesson.start_time_only || "10:00").split(":");
    const [eh, em] = (lesson.end_time_only || "11:00").split(":");
    targetDate.setHours(Number(sh), Number(sm), 0, 0);
    startIso = targetDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endDate = new Date(targetDate);
    endDate.setHours(Number(eh), Number(em), 0, 0);
    endIso = endDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
  } else if (lesson.starts_at) {
    startIso = new Date(lesson.starts_at).toISOString().replace(/-|:|\.\d\d\d/g, "");
    endIso = new Date(lesson.ends_at || lesson.starts_at).toISOString().replace(/-|:|\.\d\d\d/g, "");
  }

  const recurrence = lesson.is_recurring ? "&recur=RRULE:FREQ=WEEKLY" : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}${recurrence}`;
}

function downloadIcsFile(lesson: ScheduleItem, companySlug: string) {
  const title = lesson.title || "Live Class";
  const desc = (lesson.topics_covered || "Live Class Session").replace(/\n/g, "\\n");
  const classroomUrl = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/academy/${companySlug}/classroom?tab=session`;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zed AI Academy//Timetable//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}\\n\\nJoin URL: ${classroomUrl}`,
    `URL:${classroomUrl}`,
    "STATUS:CONFIRMED",
    ...(lesson.is_recurring ? ["RRULE:FREQ=WEEKLY"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success("Calendar event (.ics) downloaded!");
}

export function LearnerScheduleClient({
  schedules,
  companies,
}: {
  schedules: ScheduleItem[];
  companies: CompanyInfo[];
}) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindedIds, setRemindedIds] = useState<Record<string, boolean>>({});

  async function handleRemindLesson(lesson: ScheduleItem, companySlug: string) {
    setRemindingId(lesson.id);
    try {
      const timeStr = lesson.start_time_only ? `at ${lesson.start_time_only.slice(0, 5)}` : "";
      await createPersonalReminder({
        title: lesson.title,
        body: `Class starts soon ${timeStr}. Join your live classroom in time!`,
        url: `/academy/${companySlug}/classroom?tab=session&scheduleId=${lesson.id}`,
      });
      setRemindedIds((prev) => ({ ...prev, [lesson.id]: true }));
      toast.success("Reminder saved! We'll notify you in your student bell.");
    } catch (err: any) {
      toast.error(err.message || "Failed to set reminder");
    } finally {
      setRemindingId(null);
    }
  }

  const filteredSchedules = useMemo(() => {
    if (selectedCompanyId === "all") return schedules;
    return schedules.filter((s) => s.company_id === selectedCompanyId);
  }, [schedules, selectedCompanyId]);

  // Find any active session or upcoming next session
  const activeNowSession = useMemo(
    () => schedules.find((s) => s.companies?.is_session_active),
    [schedules]
  );

  const groupedByDay = useMemo(() => {
    return DAYS.reduce((acc, day, index) => {
      const dayLessons = filteredSchedules.filter((s) => s.day_of_week === index + 1);
      if (dayLessons.length > 0) acc[day] = dayLessons;
      return acc;
    }, {} as Record<string, ScheduleItem[]>);
  }, [filteredSchedules]);

  return (
    <div className="space-y-8">
      {/* ── Active Live Class Banner ─────────────────────────────────── */}
      {activeNowSession && activeNowSession.companies && (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-[#062e39] via-[#083d4c] to-[#0a485a] p-6 sm:p-10 text-white shadow-2xl border border-emerald-500/30 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(253,85,35,0.15),transparent_50%)]" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 border border-emerald-400/30">
                  Class In Session Now
                </span>
                <span className="text-xs font-bold text-white/60">
                  {activeNowSession.companies.name}
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                {activeNowSession.title}
              </h2>
              {activeNowSession.topics_covered && (
                <p className="text-sm text-white/70 max-w-xl line-clamp-2">
                  {activeNowSession.topics_covered}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/academy/${activeNowSession.companies.slug}/classroom?tab=session&scheduleId=${activeNowSession.id}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#fd5523] px-8 py-5 text-sm sm:text-base font-black text-white hover:bg-[#ef4a16] shadow-xl shadow-[#fd5523]/30 transition-all hover:scale-105 active:scale-95"
              >
                <Video className="h-5 w-5" />
                Join Live Classroom
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#fd5523]" />
          <span className="text-xs font-black uppercase tracking-wider text-[#062e39]">
            Filter by Academy:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCompanyId("all")}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold transition-all",
              selectedCompanyId === "all"
                ? "bg-[#062e39] text-white shadow-sm"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            All Academies ({schedules.length})
          </button>
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCompanyId(c.id)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-bold transition-all",
                selectedCompanyId === c.id
                  ? "bg-[#fd5523] text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Weekly Timetable ───────────────────────────────────────── */}
      <div className="space-y-8">
        {DAYS.map((day) => {
          const lessons = groupedByDay[day];
          if (!lessons) return null;

          return (
            <div key={day} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#062e39] px-4 py-1 text-xs font-black uppercase tracking-[0.2em] text-white shadow-sm">
                  {day}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {lessons.length} {lessons.length === 1 ? "class" : "classes"} scheduled
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
              </div>

              <div className="grid gap-4 sm:grid-cols-1">
                {lessons.map((lesson) => {
                  const companySlug = lesson.companies?.slug || "academy";
                  const companyName = lesson.companies?.name || "Zed AI Academy";
                  const isLive = Boolean(lesson.companies?.is_session_active);

                  return (
                    <div
                      key={lesson.id}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl sm:rounded-3xl border bg-white p-5 sm:p-7 shadow-sm transition-all hover:shadow-xl",
                        isLive ? "border-emerald-400 bg-emerald-500/[0.02]" : "border-slate-100"
                      )}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-start gap-4 sm:gap-6 flex-1 min-w-0">
                          {/* Time badge */}
                          <div
                            className={cn(
                              "flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2 transition-all shadow-inner",
                              isLive
                                ? "border-emerald-400 bg-emerald-500 text-white"
                                : "border-[#fd5523]/10 bg-[#fd5523]/5 text-[#fd5523] group-hover:bg-[#fd5523] group-hover:text-white"
                            )}
                          >
                            <Clock className="h-5 w-5 mb-0.5" />
                            <span className="text-xs sm:text-sm font-black tracking-tight">
                              {lesson.start_time_only?.slice(0, 5) || "10:00"}
                            </span>
                          </div>

                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700">
                                {companyName}
                              </span>
                              <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 border border-indigo-100">
                                {lesson.schedule_type?.replace("_", " ")}
                              </span>
                              {isLive && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  Live Now
                                </span>
                              )}
                            </div>

                            <h3 className="text-xl sm:text-2xl font-black text-[#062e39] tracking-tight group-hover:text-[#fd5523] transition-colors">
                              {lesson.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-[#fd5523]" />
                                {lesson.start_time_only?.slice(0, 5)} —{" "}
                                {lesson.end_time_only?.slice(0, 5) || "11:00"}
                              </span>
                              {lesson.is_recurring && (
                                <span className="flex items-center gap-1.5">
                                  <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
                                  Repeats Weekly
                                </span>
                              )}
                            </div>

                            {lesson.topics_covered && (
                              <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                                "{lesson.topics_covered}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <Link
                            href={`/academy/${companySlug}/classroom?tab=session&scheduleId=${lesson.id}`}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider transition-all shadow-md",
                              isLive
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20"
                                : "bg-[#062e39] text-white hover:bg-[#fd5523]"
                            )}
                          >
                            <Video className="h-4 w-4" />
                            {isLive ? "Join Live Room" : "Enter Classroom"}
                          </Link>

                          <a
                            href={getGoogleCalendarUrl(lesson, companySlug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
                            title="Add to Google Calendar"
                          >
                            <Calendar className="h-4 w-4 text-[#fd5523]" />
                            <span className="hidden sm:inline">Google Cal</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => downloadIcsFile(lesson, companySlug)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
                            title="Download iCal (.ics)"
                          >
                            <Download className="h-4 w-4 text-slate-400" />
                            <span className="hidden sm:inline">.ics</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemindLesson(lesson, companySlug)}
                            disabled={remindingId === lesson.id || remindedIds[lesson.id]}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-3 text-xs font-bold transition-all border shadow-xs",
                              remindedIds[lesson.id]
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            )}
                            title="Remind me"
                          >
                            {remindingId === lesson.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#fd5523]" />
                            ) : remindedIds[lesson.id] ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Bell className="h-4 w-4 text-amber-500" />
                            )}
                            <span className="hidden sm:inline">
                              {remindedIds[lesson.id] ? "Saved" : "Remind"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredSchedules.length === 0 && (
          <div className="rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-[#062e39]">No Classes Scheduled Yet</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              Your instructors will publish recurring weekly live classes and workshops here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
