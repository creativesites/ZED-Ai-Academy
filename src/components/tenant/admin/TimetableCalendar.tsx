"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Clock,
  BookOpen,
  Calendar,
  ExternalLink,
  Video,
  Sparkles,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM

const TYPE_STYLES: Record<string, { badge: string; cardBg: string; border: string; text: string }> = {
  live_session: {
    badge: "bg-brand/10 text-brand-text",
    cardBg: "bg-brand-soft",
    border: "border-brand/25 hover:border-brand",
    text: "text-ink",
  },
  workshop: {
    badge: "bg-indigo-50 text-indigo-700",
    cardBg: "bg-indigo-50/70",
    border: "border-indigo-200 hover:border-indigo-400",
    text: "text-indigo-950",
  },
  assignment_due: {
    badge: "bg-amber-50 text-amber-700",
    cardBg: "bg-amber-50/70",
    border: "border-amber-200 hover:border-amber-400",
    text: "text-amber-950",
  },
  other: {
    badge: "bg-emerald-50 text-emerald-700",
    cardBg: "bg-emerald-50/70",
    border: "border-emerald-200 hover:border-emerald-400",
    text: "text-emerald-950",
  },
};

function isSessionLiveNow(lesson: any, todayIdx: number): boolean {
  if (!lesson?.start_time_only || !lesson?.end_time_only) return false;
  if (Number(lesson.day_of_week) !== todayIdx + 1) return false;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = lesson.start_time_only.split(":").map(Number);
  const [eh, em] = lesson.end_time_only.split(":").map(Number);
  return nowMins >= sh * 60 + sm && nowMins <= eh * 60 + em;
}

export function TimetableCalendar({
  schedules,
  companySlug,
}: {
  schedules: any[];
  companySlug?: string;
}) {
  const todayIdx = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, []);

  const [activeDayIdx, setActiveDayIdx] = useState(todayIdx);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  const dayCounts = useMemo(() => {
    return DAYS.map((_, idx) =>
      (schedules || []).filter((s) => Number(s.day_of_week) === idx + 1).length
    );
  }, [schedules]);

  const activeDaySessions = useMemo(() => {
    return (schedules || [])
      .filter((s) => Number(s.day_of_week) === activeDayIdx + 1)
      .sort((a, b) => (a.start_time_only || "").localeCompare(b.start_time_only || ""));
  }, [schedules, activeDayIdx]);

  const classroomHref = companySlug ? `/academy/${companySlug}/admin/classroom?tab=timetable` : "#";
  const liveHref = companySlug ? `/academy/${companySlug}/admin/classroom?tab=session` : "#";

  return (
    <>
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
        {/* --- MOBILE VIEW: Interactive Day Pills + Agenda Cards (Zero blank grid!) --- */}
        <div className="lg:hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-text">
                  {activeDayIdx === todayIdx ? "Today's Schedule" : FULL_DAYS[activeDayIdx]}
                </p>
                <p className="text-xs font-bold text-ink mt-0.5">
                  {activeDaySessions.length === 0
                    ? "No classes scheduled"
                    : `${activeDaySessions.length} session${activeDaySessions.length > 1 ? "s" : ""}`}
                </p>
              </div>
              {activeDayIdx !== todayIdx && (
                <button
                  type="button"
                  onClick={() => setActiveDayIdx(todayIdx)}
                  className="px-3 py-1 rounded-lg bg-brand-soft text-brand-text text-[11px] font-bold hover:bg-brand hover:text-white transition-colors"
                >
                  Jump to Today
                </button>
              )}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((day, idx) => {
                const isSelected = activeDayIdx === idx;
                const isToday = todayIdx === idx;
                const count = dayCounts[idx];
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setActiveDayIdx(idx)}
                    className={cn(
                      "flex flex-col items-center justify-center py-2 rounded-xl transition-all duration-200",
                      isSelected
                        ? "bg-ink text-white shadow-sm scale-[1.03]"
                        : isToday
                        ? "bg-brand-soft text-brand-text border border-brand/25"
                        : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-[10px] font-bold">{day}</span>
                    <span
                      className={cn(
                        "mt-1 h-1.5 w-1.5 rounded-full transition-colors",
                        count > 0
                          ? isSelected
                            ? "bg-brand"
                            : "bg-emerald-500"
                          : "bg-transparent"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 space-y-2.5 min-h-[220px] max-h-[420px] overflow-y-auto">
            {activeDaySessions.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-200" />
                <p className="text-xs font-semibold">No classes on {FULL_DAYS[activeDayIdx]}</p>
              </div>
            ) : (
              activeDaySessions.map((lesson) => {
                const style = TYPE_STYLES[lesson.schedule_type] || TYPE_STYLES.live_session;
                const liveNow = isSessionLiveNow(lesson, todayIdx);
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelectedSession(lesson)}
                    className={cn(
                      "w-full text-left rounded-2xl p-3.5 border transition-all duration-200 hover:shadow-md active:scale-[0.99] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-1",
                      style.cardBg,
                      style.border
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-text">
                          <Clock className="h-3 w-3" />
                          {lesson.start_time_only?.slice(0, 5)} – {lesson.end_time_only?.slice(0, 5)}
                        </span>
                        {liveNow && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black uppercase tracking-wider animate-pulse">
                            Live Now
                          </span>
                        )}
                      </div>
                      <p className={cn("font-bold text-sm truncate", style.text)}>
                        {lesson.title}
                      </p>
                      {lesson.topics_covered && (
                        <p className="text-xs text-slate-500 line-clamp-1">{lesson.topics_covered}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* --- DESKTOP VIEW: Interactive 7-Day Grid --- */}
        <div className="hidden lg:flex flex-col h-[640px]">
          <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/70">
            <div className="p-3.5 border-r border-slate-100 flex items-center justify-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Time
              </span>
            </div>
            {DAYS.map((day, idx) => {
              const isToday = todayIdx === idx;
              return (
                <div
                  key={day}
                  className={cn(
                    "p-3.5 text-center border-r border-slate-100 last:border-r-0 transition-colors",
                    isToday && "bg-brand-soft/60"
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5",
                      isToday ? "text-brand-text" : "text-slate-500"
                    )}
                  >
                    {day}
                    {isToday && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto relative">
            <div className="grid grid-cols-8 min-h-full">
              {/* Time Axis */}
              <div className="border-r border-slate-100 bg-slate-50/20">
                {HOURS.map((hour) => (
                  <div key={hour} className="h-20 border-b border-slate-100/70 p-2.5 text-right">
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              {Array.from({ length: 7 }).map((_, dayIdx) => {
                const isToday = todayIdx === dayIdx;
                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "relative border-r border-slate-100 last:border-r-0 transition-colors",
                      isToday ? "bg-brand-soft/20" : "hover:bg-slate-50/40"
                    )}
                  >
                    {HOURS.map((hour) => (
                      <div key={hour} className="h-20 border-b border-slate-100/50" />
                    ))}

                    {(schedules || [])
                      .filter((s) => Number(s.day_of_week) === dayIdx + 1)
                      .map((lesson) => {
                        if (!lesson.start_time_only || !lesson.end_time_only) return null;
                        const [startH, startM] = lesson.start_time_only.split(":").map(Number);
                        const [endH, endM] = lesson.end_time_only.split(":").map(Number);

                        const top = Math.max(0, (startH - 8) * 80 + (startM / 60) * 80);
                        const height = Math.max(46, ((endH - startH) * 60 + (endM - startM)) * (80 / 60));
                        const style = TYPE_STYLES[lesson.schedule_type] || TYPE_STYLES.live_session;
                        const liveNow = isSessionLiveNow(lesson, todayIdx);

                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => setSelectedSession(lesson)}
                            className={cn(
                              "absolute left-1.5 right-1.5 rounded-xl p-2.5 overflow-hidden border shadow-xs transition-all duration-200 hover:z-20 hover:-translate-y-0.5 hover:shadow-lg text-left group/lesson cursor-pointer",
                              style.cardBg,
                              style.border
                            )}
                            style={{ top: `${top}px`, height: `${height}px` }}
                          >
                            <div className="flex flex-col h-full justify-between">
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="font-bold text-[10px] text-brand-text tabular-nums">
                                    {lesson.start_time_only.slice(0, 5)} – {lesson.end_time_only.slice(0, 5)}
                                  </span>
                                  {liveNow && (
                                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" />
                                  )}
                                </div>
                                <p className={cn("font-bold text-xs truncate leading-snug", style.text)}>
                                  {lesson.title}
                                </p>
                              </div>

                              {height >= 72 && (
                                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 pt-1 opacity-75 group-hover/lesson:opacity-100">
                                  <span className="truncate">
                                    {lesson.topics_covered || "Click for details"}
                                  </span>
                                  <ChevronRight className="h-3 w-3 shrink-0 group-hover/lesson:translate-x-0.5 transition-transform" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Session Detail Modal */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md rounded-2xl sm:rounded-3xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
          {selectedSession && (
            <div>
              <DialogHeader className="p-5 sm:p-6 bg-ink text-white">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-electric mb-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    {FULL_DAYS[(Number(selectedSession.day_of_week) || 1) - 1] || "Scheduled Session"}
                  </span>
                  {isSessionLiveNow(selectedSession, todayIdx) && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] animate-pulse">
                      Live Now
                    </span>
                  )}
                </div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-white text-left">
                  {selectedSession.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-white/75 flex items-center gap-1.5 pt-1">
                  <Clock className="h-3.5 w-3.5 text-brand-electric" />
                  {selectedSession.start_time_only?.slice(0, 5)} – {selectedSession.end_time_only?.slice(0, 5)}
                </DialogDescription>
              </DialogHeader>

              <div className="p-5 sm:p-6 space-y-4 bg-white">
                {selectedSession.topics_covered ? (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-brand-text" />
                      Topics Covered
                    </p>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {selectedSession.topics_covered}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Open the Classroom to launch or manage this scheduled session.
                  </p>
                )}

                {companySlug && (
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <Link
                      href={liveHref}
                      className="flex-1 h-10 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <Video className="h-4 w-4" />
                      <span>Go to Live Room</span>
                    </Link>
                    <Link
                      href={classroomHref}
                      className="flex-1 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-ink text-xs font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <Layers className="h-4 w-4" />
                      <span>Manage Schedule</span>
                    </Link>
                  </div>
                )}

                {!companySlug && (
                  <Button
                    type="button"
                    onClick={() => setSelectedSession(null)}
                    className="w-full h-10 rounded-xl bg-ink text-white text-xs font-bold"
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
