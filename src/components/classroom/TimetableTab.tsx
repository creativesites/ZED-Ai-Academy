"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, Plus, Clock, Loader2, Calendar, User, Users, Video, Download, Bell, Pencil, Copy, Trash2,
  LayoutList, LayoutGrid, Radio, ChevronDown, AlertCircle, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  getTimetable, getClassroomGroups, deleteClassSchedule, duplicateClassSchedule, sendScheduleReminder,
} from "@/actions/classroom";
import {
  DAY_NAMES, dayName, nextOccurrence, isLiveNow, zonedParts, todayInTz, addDaysISO, isoDayOf,
  buildIcs, googleCalendarUrl, tzLabel, formatRange, normalizeTime, type Occurrence, type TimetableRow,
} from "@/lib/schedule";
import { ScheduleFormDialog } from "./ScheduleFormDialog";
import { cn } from "@/lib/utils";

type Schedule = TimetableRow;
type Enriched = Schedule & { occ: Occurrence | null; live: boolean };

const TYPE_LABEL: Record<string, string> = { live_session: "Live class", workshop: "Workshop", assignment_due: "Assignment", other: "Event" };

function fmtDate(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(d);
}
function fmtClock(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/** "Live now", "in 25 min", "in 3h 10m", "Tomorrow", "Mon 9 Nov". */
function relativeStart(occ: Occurrence, now: Date, tz: string): string {
  const ms = occ.start.getTime() - now.getTime();
  if (ms <= 0) return "Live now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  if (mins < 24 * 60) return `in ${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ""}`.trim();
  const today = todayInTz(tz, now);
  const day = zonedParts(occ.start, tz).date;
  if (day === addDaysISO(today, 1)) return "Tomorrow";
  return fmtDate(occ.start, tz);
}

type BadgeTone = "slate" | "brand" | "green" | "red";
function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border",
        tone === "slate" && "bg-slate-50 text-slate-600 border-slate-200",
        tone === "brand" && "bg-brand-soft text-brand-ink border-brand/20",
        tone === "green" && "bg-emerald-50 text-emerald-700 border-emerald-200",
        tone === "red" && "bg-red-50 text-red-700 border-red-200"
      )}
    >
      {children}
    </span>
  );
}

export function TimetableTab({ companyId, isAdminOrInstructor, companySlug }: { companyId: string; isAdminOrInstructor: boolean; companySlug: string }) {
  const [timezone, setTimezone] = useState("Africa/Lusaka");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "week">("list");
  const [now, setNow] = useState(() => new Date());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const viewerTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return timezone;
    }
  }, [timezone]);

  // Bump to refetch after a mutation (or the "Try again" button).
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tt, g] = await Promise.all([getTimetable(companyId), getClassroomGroups(companyId)]);
        if (cancelled) return;
        setTimezone(tt.timezone);
        setSchedules(tt.schedules);
        setGroups(((g ?? []) as { id: string; name: string }[]));
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error && e.message ? e.message : "Couldn't load the timetable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, version]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000); // keeps "Live now" / countdowns fresh
    return () => clearInterval(t);
  }, []);

  const groupName = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g.name])), [groups]);

  const enriched: Enriched[] = useMemo(
    () => schedules.map((s) => ({ ...s, occ: nextOccurrence(s, timezone, now), live: isLiveNow(s, timezone, now) })),
    [schedules, timezone, now]
  );

  const today = useMemo(() => {
    const date = todayInTz(timezone, now);
    return { date, isoDay: isoDayOf(date) };
  }, [timezone, now]);

  const byDay = useMemo(() => {
    const map: Record<number, Enriched[]> = {};
    for (const s of enriched) {
      if (!s.is_recurring || !s.day_of_week) continue;
      (map[s.day_of_week] ||= []).push(s);
    }
    for (const k of Object.keys(map)) map[+k].sort((a, b) => (a.start_time_only ?? "").localeCompare(b.start_time_only ?? ""));
    return map;
  }, [enriched]);

  const oneOffUpcoming = useMemo(
    () => enriched.filter((s) => !s.is_recurring && s.occ).sort((a, b) => a.occ!.start.getTime() - b.occ!.start.getTime()),
    [enriched]
  );
  const oneOffPast = useMemo(
    () =>
      enriched
        .filter((s) => !s.is_recurring && !s.occ)
        .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))
        .slice(0, 10),
    [enriched]
  );
  const nextUp = useMemo(
    () => enriched.filter((s) => s.occ).sort((a, b) => a.occ!.start.getTime() - b.occ!.start.getTime())[0] ?? null,
    [enriched]
  );

  // One-off classes that fall in the current Mon-Sun week (academy time) also appear in the week grid.
  const oneOffThisWeekByDay = useMemo(() => {
    const weekStart = addDaysISO(today.date, -(today.isoDay - 1));
    const weekEnd = addDaysISO(weekStart, 6);
    const map: Record<number, Enriched[]> = {};
    for (const s of oneOffUpcoming) {
      const p = zonedParts(s.occ!.start, timezone);
      if (p.date >= weekStart && p.date <= weekEnd) (map[p.isoDay] ||= []).push(s);
    }
    return map;
  }, [oneOffUpcoming, timezone, today]);

  const joinHref = (id?: string) => `/academy/${companySlug}/classroom?tab=session${id ? `&scheduleId=${id}` : ""}`;
  const joinUrlAbs = () => `${window.location.origin}/academy/${companySlug}/classroom?tab=session`;

  function downloadIcs(events: Schedule[], filename: string) {
    const ics = buildIcs(events, { tz: timezone, joinUrl: joinUrlAbs(), calendarName: `${companySlug} timetable` });
    if (!ics.includes("BEGIN:VEVENT")) {
      toast.info("There are no upcoming classes to export.");
      return;
    }
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Calendar file downloaded");
  }

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      const res = (await fn()) as { message?: unknown } | undefined;
      toast.success(typeof res?.message === "string" ? res.message : ok);
      return true;
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "That didn't work. Please try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Schedule) => {
    setSelected(null);
    setConfirmDelete(false);
    setEditing(s);
    setFormOpen(true);
  };
  const closeDetails = () => {
    setSelected(null);
    setConfirmDelete(false);
  };

  function timeBlock(s: Enriched) {
    if (s.is_recurring) return { top: normalizeTime(s.start_time_only) ?? "", bottom: normalizeTime(s.end_time_only) ?? "" };
    return { top: fmtClock(new Date(s.starts_at), timezone), bottom: fmtClock(new Date(s.ends_at), timezone) };
  }

  function lessonCard(s: Enriched) {
    const t = timeBlock(s);
    const isToday = s.is_recurring && s.day_of_week === today.isoDay;
    return (
      <article
        key={s.id}
        className={cn(
          "bg-white rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-shadow hover:shadow-md",
          s.live ? "border-red-200 ring-1 ring-red-100" : "border-slate-200"
        )}
      >
        <div
          className={cn(
            "shrink-0 sm:w-24 rounded-xl flex sm:flex-col items-center justify-between sm:justify-center gap-1 px-4 py-2.5 sm:py-3 font-black tabular-nums",
            s.live ? "bg-red-50 text-red-700" : "bg-brand-soft text-brand-ink"
          )}
        >
          <span className="text-lg leading-none">{t.top}</span>
          <span className="text-xs font-bold opacity-70 leading-none">to {t.bottom}</span>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-black text-[#062e39] break-words">{s.title}</h4>
            {s.live && (
              <Badge tone="red">
                <Radio className="h-3 w-3" /> Live now
              </Badge>
            )}
            {isToday && !s.live && <Badge tone="brand">Today</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{TYPE_LABEL[s.schedule_type ?? ""] ?? "Class"}</Badge>
            <Badge tone="green">
              <Users className="h-3 w-3" /> {s.group_id ? groupName[s.group_id] ?? "Group" : "Everyone"}
            </Badge>
            {!s.is_recurring && <Badge>{fmtDate(new Date(s.starts_at), timezone)}</Badge>}
            {s.instructor_name && (
              <Badge>
                <User className="h-3 w-3" /> {s.instructor_name}
              </Badge>
            )}
          </div>
          {s.topics_covered && <p className="text-sm text-slate-600 line-clamp-2 break-words">{s.topics_covered}</p>}
        </div>

        <div className="flex gap-2 sm:flex-col sm:w-32">
          <Link
            href={joinHref(s.id)}
            className="flex-1 h-11 px-4 rounded-xl bg-brand text-brand-on text-xs font-black uppercase tracking-wider hover:bg-brand-hover transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Video className="h-4 w-4" /> Join
          </Link>
          <Button variant="outline" onClick={() => setSelected(s)} className="flex-1 h-11 rounded-xl text-xs font-black uppercase tracking-wider text-[#062e39]">
            Details
          </Button>
        </div>
      </article>
    );
  }

  function weekChip(s: Enriched) {
    const t = timeBlock(s);
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => setSelected(s)}
        className={cn(
          "w-full text-left rounded-lg border p-2 transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand",
          s.live ? "bg-red-50 border-red-200" : "bg-brand-soft/60 border-brand/20"
        )}
      >
        <div className="text-[11px] font-black text-brand-ink tabular-nums">
          {t.top}–{t.bottom}
        </div>
        <div className="text-xs font-bold text-[#062e39] leading-snug line-clamp-2 break-words">{s.title}</div>
        {!s.is_recurring && <div className="mt-0.5 text-[10px] font-bold text-slate-500">One-off</div>}
      </button>
    );
  }

  const hasAny = schedules.length > 0;
  const tzDiffers = viewerTz !== timezone;

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#062e39] flex items-center gap-2">
            Timetable <CalendarDays className="h-5 w-5 text-brand-ink" />
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Times shown in{" "}
            <strong className="text-slate-700">
              {timezone.replace(/_/g, " ")} ({tzLabel(timezone, now)})
            </strong>
            {tzDiffers && <> — your device is set to {viewerTz.replace(/_/g, " ")}</>}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Timetable view" className="hidden lg:inline-flex p-1 rounded-xl bg-slate-100">
            {(
              [
                ["list", "List", LayoutList],
                ["week", "Week", LayoutGrid],
              ] as const
            ).map(([v, name, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors",
                  view === v ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Icon className="h-4 w-4" /> {name}
              </button>
            ))}
          </div>
          {hasAny && (
            <Button variant="outline" onClick={() => downloadIcs(schedules, `${companySlug}-timetable.ics`)} className="h-11 rounded-xl font-bold text-xs gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Add all to calendar</span>
              <span className="sm:hidden">Calendar</span>
            </Button>
          )}
          {isAdminOrInstructor && (
            <Button onClick={openAdd} className="h-11 rounded-xl bg-brand text-brand-on hover:bg-brand-hover font-black gap-2 shadow-lg shadow-brand/20">
              <Plus className="h-4 w-4" /> Add class
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div role="status" className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-9 w-9 animate-spin mb-3 text-brand-ink" />
          <p className="text-sm font-bold">Loading timetable…</p>
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="font-bold text-red-800">{loadError}</p>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              reload();
            }}
            className="mt-4 rounded-xl"
          >
            Try again
          </Button>
        </div>
      ) : !hasAny ? (
        <div className="text-center py-14 sm:py-20 px-4 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <CalendarDays className="mx-auto h-14 w-14 text-slate-300 mb-4" />
          <h3 className="text-xl sm:text-2xl font-black text-[#062e39]">No classes yet</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto text-sm sm:text-base">
            {isAdminOrInstructor
              ? "Add your first class and your students will see it here and get a notification."
              : "Your timetable will appear here once your instructor adds classes."}
          </p>
          {isAdminOrInstructor && (
            <Button onClick={openAdd} className="mt-6 h-12 px-6 rounded-xl bg-brand text-brand-on hover:bg-brand-hover font-black gap-2">
              <Plus className="h-4 w-4" /> Add a class
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {nextUp?.occ && (
            <section
              aria-label="Next class"
              className={cn("rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 text-white", nextUp.live ? "bg-red-600" : "bg-[#062e39]")}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">{nextUp.live ? "Happening now" : "Next up"}</p>
                <p className="text-lg sm:text-xl font-black break-words">{nextUp.title}</p>
                <p className="text-sm opacity-90">
                  {fmtDate(nextUp.occ.start, timezone)}, {fmtClock(nextUp.occ.start, timezone)} {tzLabel(timezone, nextUp.occ.start)} ·{" "}
                  <strong>{relativeStart(nextUp.occ, now, timezone)}</strong>
                  {tzDiffers && <span className="opacity-80"> · {fmtClock(nextUp.occ.start, viewerTz)} your time</span>}
                </p>
              </div>
              <Link
                href={joinHref(nextUp.id)}
                className="h-12 px-6 rounded-xl bg-white text-[#062e39] font-black text-sm inline-flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
              >
                <Video className="h-4 w-4" /> {nextUp.live ? "Join now" : "Open classroom"}
              </Link>
            </section>
          )}

          {/* WEEK GRID (large screens only) */}
          {view === "week" && (
            <div className="hidden lg:grid grid-cols-7 gap-3">
              {DAY_NAMES.map((d, i) => {
                const iso = i + 1;
                const items = [...(byDay[iso] ?? []), ...(oneOffThisWeekByDay[iso] ?? [])].sort((a, b) => timeBlock(a).top.localeCompare(timeBlock(b).top));
                const isToday = iso === today.isoDay;
                return (
                  <div key={d} className={cn("rounded-2xl border p-2.5 min-h-40", isToday ? "border-brand bg-brand-soft/30" : "border-slate-200 bg-white")}>
                    <div className={cn("text-xs font-black uppercase tracking-wider mb-2 px-1 flex items-center justify-between", isToday ? "text-brand-ink" : "text-slate-500")}>
                      {d.slice(0, 3)} {isToday && <span className="text-[10px]">Today</span>}
                    </div>
                    <div className="space-y-2">{items.length ? items.map(weekChip) : <p className="text-xs text-slate-400 px-1">—</p>}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* LIST (always on small screens; on large when List is selected) */}
          <div className={cn("space-y-8", view === "week" && "lg:hidden")}>
            {DAY_NAMES.map((d, i) => {
              const items = byDay[i + 1];
              if (!items?.length) return null;
              const isToday = i + 1 === today.isoDay;
              return (
                <section key={d} aria-label={d} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3
                      className={cn(
                        "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em]",
                        isToday ? "bg-brand text-brand-on" : "bg-[#062e39] text-white"
                      )}
                    >
                      {d}
                      {isToday && " · Today"}
                    </h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                  </div>
                  <div className="space-y-3">{items.map(lessonCard)}</div>
                </section>
              );
            })}

            {oneOffUpcoming.length > 0 && (
              <section aria-label="One-off classes" className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] bg-indigo-600 text-white">One-off classes</h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                </div>
                <div className="space-y-3">{oneOffUpcoming.map(lessonCard)}</div>
              </section>
            )}

            {oneOffPast.length > 0 && (
              <section className="space-y-3">
                <button type="button" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700">
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showPast && "rotate-180")} /> Past one-off classes ({oneOffPast.length})
                </button>
                {showPast && <div className="space-y-3 opacity-70">{oneOffPast.map(lessonCard)}</div>}
              </section>
            )}
          </div>
        </div>
      )}

      {/* Add / edit */}
      <ScheduleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        companySlug={companySlug}
        groups={groups}
        timezone={timezone}
        schedule={editing}
        onSaved={reload}
      />

      {/* Details */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) closeDetails();
        }}
      >
        <DialogContent className="sm:max-w-[560px] w-[calc(100vw-1.5rem)] max-h-[92dvh] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0">
          {selected &&
            (() => {
              const s = enriched.find((e) => e.id === selected.id) ?? (selected as Enriched);
              const occ = s.occ;
              const gcal = googleCalendarUrl(s, { tz: timezone, joinUrl: typeof window !== "undefined" ? joinUrlAbs() : "" });
              return (
                <>
                  <DialogHeader className="bg-[#062e39] text-white p-5 sm:p-7 text-left space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-brand text-brand-on text-[10px] font-black uppercase tracking-widest">{TYPE_LABEL[s.schedule_type ?? ""] ?? "Class"}</span>
                      {s.is_recurring && (
                        <span className="px-2.5 py-1 rounded-full bg-white/15 text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1">
                          <Repeat className="h-3 w-3" /> Weekly
                        </span>
                      )}
                    </div>
                    <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight break-words">{s.title}</DialogTitle>
                    <DialogDescription className="text-white/75 flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 shrink-0" />
                      {s.is_recurring
                        ? `Every ${dayName(s.day_of_week)}, ${formatRange(s.start_time_only, s.end_time_only)} ${tzLabel(timezone, now)}`
                        : `${fmtDate(new Date(s.starts_at), timezone)}, ${fmtClock(new Date(s.starts_at), timezone)}–${fmtClock(new Date(s.ends_at), timezone)} ${tzLabel(timezone, now)}`}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="p-5 sm:p-7 space-y-5 overflow-y-auto max-h-[calc(92dvh-9rem)]">
                    {s.topics_covered && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-ink mb-1.5">Topics</h4>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{s.topics_covered}</p>
                      </div>
                    )}

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-slate-200 p-3">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Instructor</dt>
                        <dd className="font-bold text-[#062e39] mt-0.5">{s.instructor_name ?? "Not assigned"}</dd>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">For</dt>
                        <dd className="font-bold text-[#062e39] mt-0.5">{s.group_id ? groupName[s.group_id] ?? "A class group" : "Everyone in the academy"}</dd>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Next session</dt>
                        <dd className="font-bold text-[#062e39] mt-0.5">
                          {occ ? (
                            <>
                              {fmtDate(occ.start, timezone)}, {fmtClock(occ.start, timezone)} {tzLabel(timezone, occ.start)} · {relativeStart(occ, now, timezone)}
                            </>
                          ) : (
                            "This class has already taken place"
                          )}
                          {occ && tzDiffers && (
                            <span className="block text-xs font-medium text-slate-500">
                              {fmtClock(occ.start, viewerTz)} in your timezone ({viewerTz.replace(/_/g, " ")})
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="space-y-2">
                      <Link
                        href={joinHref(s.id)}
                        onClick={closeDetails}
                        className="w-full h-12 rounded-xl bg-brand text-brand-on font-black text-sm uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-brand-hover transition-colors"
                      >
                        <Video className="h-5 w-5" /> Enter classroom
                      </Link>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {gcal && (
                          <a
                            href={gcal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#062e39] font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors"
                          >
                            <Calendar className="h-4 w-4 text-brand-ink" /> Google Calendar
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={!occ}
                          onClick={() => downloadIcs([s], `${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`)}
                          className="h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-[#062e39] font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors"
                        >
                          <Download className="h-4 w-4 text-slate-500" /> Apple / Outlook (.ics)
                        </button>
                      </div>
                    </div>

                    {isAdminOrInstructor && (
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <Button variant="outline" onClick={() => openEdit(s)} className="h-11 rounded-xl font-bold text-xs gap-1.5">
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy === "remind"}
                            onClick={() => void run("remind", () => sendScheduleReminder(companyId, s.id, companySlug), "Reminder sent")}
                            className="h-11 rounded-xl font-bold text-xs gap-1.5"
                          >
                            {busy === "remind" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Remind
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy === "dup"}
                            onClick={async () => {
                              if (await run("dup", () => duplicateClassSchedule(s.id, companySlug), "Class duplicated")) {
                                closeDetails();
                                reload();
                              }
                            }}
                            className="h-11 rounded-xl font-bold text-xs gap-1.5"
                          >
                            {busy === "dup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Copy
                          </Button>
                        </div>
                        {!confirmDelete ? (
                          <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="w-full h-11 rounded-xl font-bold text-xs gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="h-4 w-4" /> Delete class
                          </Button>
                        ) : (
                          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                            <p className="text-sm font-bold text-red-800">
                              Delete “{s.title}”{s.is_recurring ? " and every future week" : ""}? This can’t be undone.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" onClick={() => setConfirmDelete(false)} className="h-10 rounded-lg bg-white">
                                Keep it
                              </Button>
                              <Button
                                disabled={busy === "del"}
                                onClick={async () => {
                                  if (await run("del", () => deleteClassSchedule(s.id, companySlug), "Class deleted")) {
                                    closeDetails();
                                    reload();
                                  }
                                }}
                                className="h-10 rounded-lg bg-red-600 text-white hover:bg-red-700"
                              >
                                {busy === "del" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, delete"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
