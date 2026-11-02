"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { postClassSchedule, updateClassSchedule, type ScheduleConflict } from "@/actions/classroom";
import { DAY_NAMES, normalizeTime, timeToMinutes, zonedParts, tzLabel, type TimetableRow } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type Group = { id: string; name: string };

const label = "text-[11px] font-bold uppercase tracking-wider text-slate-500";
const field = "rounded-xl border-slate-200 bg-slate-50/60 h-12 focus:bg-white";

function addOneHour(start: string): string {
  const m = timeToMinutes(start);
  if (m == null) return "";
  const end = Math.min(m + 60, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

/** Existing one-off instants -> the "YYYY-MM-DDTHH:mm" wall-clock value a datetime-local input expects. */
function toLocalInput(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const p = zonedParts(new Date(iso), tz);
  return `${p.date}T${p.time}`;
}

function ScheduleForm({
  onOpenChange,
  companyId,
  companySlug,
  groups,
  timezone,
  schedule,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companySlug: string;
  groups: Group[];
  timezone: string;
  schedule?: TimetableRow | null; // present = editing
  onSaved: () => void | Promise<void>;
}) {
  const editing = !!schedule;

  const rec = !!schedule?.is_recurring;
  const [title, setTitle] = useState(schedule?.title ?? "");
  const [type, setType] = useState(schedule?.schedule_type ?? "live_session");
  const [groupId, setGroupId] = useState(schedule?.group_id ?? "all");
  const [isRecurring, setIsRecurring] = useState(schedule ? rec : true);
  const [dayOfWeek, setDayOfWeek] = useState(schedule?.day_of_week ?? 1);
  const [startTime, setStartTime] = useState(normalizeTime(schedule?.start_time_only) ?? "");
  const [endTime, setEndTime] = useState(normalizeTime(schedule?.end_time_only) ?? "");
  const [endTouched, setEndTouched] = useState(!!schedule);
  const [startsAt, setStartsAt] = useState(schedule && !rec ? toLocalInput(schedule.starts_at, timezone) : "");
  const [endsAt, setEndsAt] = useState(schedule && !rec ? toLocalInput(schedule.ends_at, timezone) : "");
  const [topics, setTopics] = useState(schedule?.topics_covered ?? "");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);

  function onStartChange(v: string) {
    setStartTime(v);
    if (!endTouched) setEndTime(addOneHour(v)); // suggest +1h until the user sets their own end
  }

  async function submit(allowConflict = false) {
    setSaving(true);
    setErrors([]);
    setConflicts([]);
    const fd = new FormData();
    fd.set("companyId", companyId);
    fd.set("companySlug", companySlug);
    fd.set("title", title);
    fd.set("type", type);
    fd.set("groupId", groupId);
    fd.set("isRecurring", String(isRecurring));
    fd.set("dayOfWeek", String(dayOfWeek));
    fd.set("startTime", startTime);
    fd.set("endTime", endTime);
    fd.set("startsAt", startsAt);
    fd.set("endsAt", endsAt);
    fd.set("topics", topics);
    if (allowConflict) fd.set("allowConflict", "true");

    try {
      const res = schedule ? await updateClassSchedule(schedule.id, fd) : await postClassSchedule(fd);
      if (res.ok) {
        toast.success(schedule ? "Class updated" : "Class added to the timetable");
        await onSaved();
        onOpenChange(false);
      } else if (res.conflicts?.length) {
        setConflicts(res.conflicts);
      } else {
        setErrors(res.errors);
      }
    } catch (e) {
      setErrors([e instanceof Error && e.message ? e.message : "Something went wrong. Please try again."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <div className="h-1.5 bg-gradient-to-r from-brand to-brand-hover" />
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-1 text-left">
          <DialogTitle className="text-xl sm:text-2xl font-black text-[#062e39]">{editing ? "Edit class" : "Add a class"}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Times are in the academy timezone ({timezone.replace(/_/g, " ")}, {tzLabel(timezone)}).
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
          className="px-4 sm:px-6 pb-4 sm:pb-6 pt-3 space-y-5 overflow-y-auto max-h-[calc(92dvh-7rem)]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="sf-title" className={label}>Class name</label>
              <Input id="sf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mathematics" required maxLength={120} className={field} />
            </div>
            <div className="space-y-2">
              <label className={label}>Type</label>
              <Select value={type} onValueChange={(v) => setType(v ?? "live_session")}>
                <SelectTrigger className={cn(field, "w-full")} aria-label="Class type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="live_session">Live class</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="assignment_due">Assignment due</SelectItem>
                  <SelectItem value="other">Other event</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className={label}>Who is it for?</label>
            <Select value={groupId} onValueChange={(v) => setGroupId(v ?? "all")}>
              <SelectTrigger className={cn(field, "w-full")} aria-label="Audience"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone in the academy</SelectItem>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Weekly vs one-off */}
          <div className="space-y-2">
            <span className={label}>How often?</span>
            <div role="radiogroup" aria-label="How often" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
              {[{ v: true, t: "Every week" }, { v: false, t: "One time only" }].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={isRecurring === o.v}
                  onClick={() => setIsRecurring(o.v)}
                  className={cn("h-10 rounded-lg text-sm font-bold transition-colors", isRecurring === o.v ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </div>

          {isRecurring ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
              <div className="space-y-2">
                <span className={label}>Day</span>
                <div role="radiogroup" aria-label="Day of the week" className="grid grid-cols-7 gap-1.5">
                  {DAY_NAMES.map((d, i) => {
                    const selected = dayOfWeek === i + 1;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={d}
                        onClick={() => setDayOfWeek(i + 1)}
                        className={cn(
                          "h-11 rounded-lg text-xs font-black border transition-colors",
                          selected ? "bg-brand text-brand-on border-brand shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {d.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label htmlFor="sf-start" className={label}>Starts</label>
                  <Input id="sf-start" type="time" value={startTime} onChange={(e) => onStartChange(e.target.value)} required className={cn(field, "bg-white")} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sf-end" className={label}>Ends</label>
                  <Input id="sf-end" type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setEndTouched(true); }} required className={cn(field, "bg-white")} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="space-y-2">
                <label htmlFor="sf-startsat" className={label}>Starts</label>
                <Input id="sf-startsat" type="datetime-local" value={startsAt} onChange={(e) => { setStartsAt(e.target.value); if (!endsAt) setEndsAt(e.target.value); }} required className={cn(field, "bg-white")} />
              </div>
              <div className="space-y-2">
                <label htmlFor="sf-endsat" className={label}>Ends</label>
                <Input id="sf-endsat" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className={cn(field, "bg-white")} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="sf-topics" className={label}>Topics (optional)</label>
            <Textarea id="sf-topics" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="What will this class cover?" maxLength={2000} className="rounded-xl border-slate-200 bg-slate-50/60 resize-none h-24 p-3" />
          </div>

          <div aria-live="polite" className="space-y-3">
            {errors.length > 0 && (
              <ul className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700 space-y-1 list-disc list-inside">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            {conflicts.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 space-y-2">
                <p className="font-bold flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> This overlaps with:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {conflicts.map((c) => <li key={c.id}><strong>{c.title}</strong> — {c.when}</li>)}
                </ul>
                <p className="text-xs text-amber-800">It shares the same teacher or the same students. Change the time, or schedule it anyway.</p>
                <Button type="button" variant="outline" disabled={saving} onClick={() => void submit(true)} className="h-10 rounded-lg border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
                  Schedule anyway
                </Button>
              </div>
            )}
          </div>

          <Button type="submit" disabled={saving} className="w-full h-12 sm:h-14 rounded-xl bg-brand text-brand-on hover:bg-brand-hover font-black text-base shadow-lg shadow-brand/20">
            {saving && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
            {editing ? "Save changes" : "Add to timetable"}
          </Button>
        </form>
    </>
  );
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  ...rest
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companySlug: string;
  groups: Group[];
  timezone: string;
  schedule?: TimetableRow | null;
  onSaved: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] w-[calc(100vw-1.5rem)] max-h-[92dvh] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0">
        {/* Mounted only while open, so every open starts from the class being edited (or a blank form). */}
        {open && <ScheduleForm key={rest.schedule?.id ?? "new"} onOpenChange={onOpenChange} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}
