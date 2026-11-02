/**
 * Timetable logic shared by the classroom UI and the server actions.
 *
 * Conventions (match the existing `class_schedules` table):
 *  - Recurring classes store `day_of_week` as ISO weekday, 1 = Monday ... 7 = Sunday,
 *    plus `start_time_only` / `end_time_only` as WALL-CLOCK times in the academy's timezone.
 *  - One-off classes store `starts_at` / `ends_at` as real instants (timestamptz).
 *  - The academy timezone lives on `companies.timezone` (default Africa/Lusaka).
 *
 * Everything here is pure (no I/O, no Date.now() unless injected) so it can be unit tested.
 */

export const DEFAULT_TIMEZONE = "Africa/Lusaka";
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const ICS_DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const MAX_ONE_OFF_HOURS = 12;

export function dayName(isoDay: number | null | undefined): string {
  return DAY_NAMES[(isoDay ?? 0) - 1] ?? "";
}

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(tz: string | null | undefined): string {
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/* ------------------------------------------------------------------ */
/* Clock helpers                                                       */
/* ------------------------------------------------------------------ */

/** "9:05", "09:05", "09:05:00" -> "09:05". Anything else -> null. */
export function normalizeTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(String(t).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function timeToMinutes(t: string | null | undefined): number | null {
  const n = normalizeTime(t);
  if (!n) return null;
  const [h, m] = n.split(":").map(Number);
  return h * 60 + m;
}

/* ------------------------------------------------------------------ */
/* Timezone math (no dependencies)                                     */
/* ------------------------------------------------------------------ */

/** Offset of `tz` from UTC at the instant `utc`, in ms. local wall clock = utc + offset. */
export function tzOffsetMs(tz: string, utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utc.getTime() / 1000) * 1000;
}

/** Convert a wall-clock date + time in `tz` to the real instant. date = YYYY-MM-DD, time = HH:mm. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes so the offset is evaluated at the right side of a DST change.
  const first = naive - tzOffsetMs(tz, new Date(naive));
  return new Date(naive - tzOffsetMs(tz, new Date(first)));
}

export type ZonedParts = { date: string; time: string; isoDay: number };

/** Wall-clock date/time and ISO weekday of an instant, as seen in `tz`. */
export function zonedParts(utc: Date, tz: string): ZonedParts {
  const local = new Date(utc.getTime() + tzOffsetMs(tz, utc));
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  return { date, time, isoDay: local.getUTCDay() === 0 ? 7 : local.getUTCDay() };
}

export function todayInTz(tz: string, now: Date = new Date()): string {
  return zonedParts(now, tz).date;
}

export function addDaysISO(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

export function isoDayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** "2026-11-05T09:30" (what <input type=datetime-local> produces) -> { date, time }. */
export function parseLocalDateTime(v: string | null | undefined): { date: string; time: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(String(v ?? "").trim());
  if (!m) return null;
  const [y, mo, d] = m[1].split("-").map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  // reject 2026-02-31 style dates that JS would silently roll over
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  if (!normalizeTime(m[2])) return null;
  return { date: m[1], time: m[2] };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type ScheduleInput = {
  title?: string | null;
  isRecurring: boolean;
  dayOfWeek?: number | string | null;
  startTime?: string | null;
  endTime?: string | null;
  startsAt?: string | null; // datetime-local, wall clock in the academy timezone
  endsAt?: string | null;
};

export type ScheduleTiming = {
  is_recurring: boolean;
  day_of_week: number | null;
  start_time_only: string | null;
  end_time_only: string | null;
  starts_at: string; // ISO instant
  ends_at: string; // ISO instant
};

export type ValidationResult =
  | { ok: true; title: string; timing: ScheduleTiming }
  | { ok: false; errors: string[] };

export function validateSchedule(input: ScheduleInput, tz: string, now: Date = new Date()): ValidationResult {
  const errors: string[] = [];
  const title = String(input.title ?? "").trim();
  if (!title) errors.push("Give the class a name.");
  if (title.length > 120) errors.push("The class name is too long (120 characters max).");

  if (input.isRecurring) {
    const dow = Number(input.dayOfWeek);
    const start = normalizeTime(input.startTime);
    const end = normalizeTime(input.endTime);
    if (!Number.isInteger(dow) || dow < 1 || dow > 7) errors.push("Pick a day of the week.");
    if (!start) errors.push("Enter a valid start time.");
    if (!end) errors.push("Enter a valid end time.");
    if (start && end && timeToMinutes(end)! <= timeToMinutes(start)!) {
      errors.push("The class must end after it starts (overnight classes aren't supported — split them in two).");
    }
    if (errors.length) return { ok: false, errors };

    // Anchor starts_at/ends_at at the next occurrence so sorting and "upcoming" queries work.
    const next = nextOccurrence(
      { is_recurring: true, day_of_week: dow, start_time_only: start, end_time_only: end, starts_at: null, ends_at: null },
      tz,
      now
    )!;
    return {
      ok: true,
      title,
      timing: {
        is_recurring: true,
        day_of_week: dow,
        start_time_only: start,
        end_time_only: end,
        starts_at: next.start.toISOString(),
        ends_at: next.end.toISOString(),
      },
    };
  }

  const s = parseLocalDateTime(input.startsAt);
  const e = parseLocalDateTime(input.endsAt);
  if (!s) errors.push("Enter a valid start date and time.");
  if (!e) errors.push("Enter a valid end date and time.");
  if (errors.length) return { ok: false, errors };

  const startsAt = zonedToUtc(s!.date, s!.time, tz);
  const endsAt = zonedToUtc(e!.date, e!.time, tz);
  if (endsAt.getTime() <= startsAt.getTime()) errors.push("The class must end after it starts.");
  else if ((endsAt.getTime() - startsAt.getTime()) / 3_600_000 > MAX_ONE_OFF_HOURS) {
    errors.push(`A single class can't be longer than ${MAX_ONE_OFF_HOURS} hours.`);
  }
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    title,
    timing: {
      is_recurring: false,
      day_of_week: null,
      start_time_only: null,
      end_time_only: null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Occurrences                                                         */
/* ------------------------------------------------------------------ */

export type ScheduleLike = {
  id?: string;
  is_recurring?: boolean | null;
  day_of_week?: number | null;
  start_time_only?: string | null;
  end_time_only?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  instructor_id?: string | null;
  group_id?: string | null;
};

export type Occurrence = { start: Date; end: Date };

/** A `class_schedules` row as the timetable UI receives it (plus the instructor's display name). */
export type TimetableRow = Omit<ScheduleLike, "id"> & {
  id: string;
  company_id: string;
  title: string;
  schedule_type: string | null;
  topics_covered: string | null;
  instructor_name: string | null;
  starts_at: string;
  ends_at: string;
};

/**
 * The next time this class happens, counting a class that is running right now.
 * Returns null for a one-off class that has already finished.
 */
export function nextOccurrence(s: ScheduleLike, tz: string, now: Date = new Date()): Occurrence | null {
  if (!s.is_recurring) {
    if (!s.starts_at || !s.ends_at) return null;
    const start = new Date(s.starts_at);
    const end = new Date(s.ends_at);
    return end.getTime() > now.getTime() ? { start, end } : null;
  }
  const start = normalizeTime(s.start_time_only);
  const end = normalizeTime(s.end_time_only);
  const dow = s.day_of_week;
  if (!start || !end || !dow) return null;

  const today = todayInTz(tz, now);
  for (let k = 0; k <= 7; k++) {
    const date = addDaysISO(today, k);
    if (isoDayOf(date) !== dow) continue;
    const occ = { start: zonedToUtc(date, start, tz), end: zonedToUtc(date, end, tz) };
    if (occ.end.getTime() > now.getTime()) return occ;
  }
  return null;
}

export function isLiveNow(s: ScheduleLike, tz: string, now: Date = new Date()): boolean {
  const occ = nextOccurrence(s, tz, now);
  return !!occ && occ.start.getTime() <= now.getTime() && occ.end.getTime() > now.getTime();
}

/* ------------------------------------------------------------------ */
/* Conflicts                                                           */
/* ------------------------------------------------------------------ */

function asRange(s: ScheduleLike): { recurring?: { isoDay: number; from: number; to: number }; oneOff?: Occurrence } | null {
  if (s.is_recurring) {
    const from = timeToMinutes(s.start_time_only);
    const to = timeToMinutes(s.end_time_only);
    if (from == null || to == null || !s.day_of_week) return null;
    return { recurring: { isoDay: s.day_of_week, from, to } };
  }
  if (!s.starts_at || !s.ends_at) return null;
  return { oneOff: { start: new Date(s.starts_at), end: new Date(s.ends_at) } };
}

function timesOverlap(a: ScheduleLike, b: ScheduleLike, tz: string): boolean {
  const ra = asRange(a);
  const rb = asRange(b);
  if (!ra || !rb) return false;

  if (ra.recurring && rb.recurring) {
    return ra.recurring.isoDay === rb.recurring.isoDay && ra.recurring.from < rb.recurring.to && rb.recurring.from < ra.recurring.to;
  }
  if (ra.oneOff && rb.oneOff) {
    return ra.oneOff.start < rb.oneOff.end && rb.oneOff.start < ra.oneOff.end;
  }
  // recurring vs one-off: compare the one-off's wall-clock day/time in the academy timezone
  const rec = (ra.recurring ?? rb.recurring)!;
  const one = (ra.oneOff ?? rb.oneOff)!;
  const sp = zonedParts(one.start, tz);
  const ep = zonedParts(one.end, tz);
  if (sp.isoDay !== rec.isoDay) return false;
  const from = timeToMinutes(sp.time)!;
  const to = sp.date === ep.date ? timeToMinutes(ep.time)! : 24 * 60;
  return from < rec.to && rec.from < to;
}

/**
 * Existing classes that would clash with `candidate`: they overlap in time AND either share the
 * instructor or reach the same students (same group, or either one is for the whole academy).
 * Back-to-back classes (one ends exactly when the other starts) do not clash.
 */
export function findConflicts<T extends ScheduleLike>(candidate: ScheduleLike, existing: T[], tz: string): T[] {
  return existing.filter((other) => {
    if (candidate.id && other.id === candidate.id) return false; // editing: ignore itself
    if (!timesOverlap(candidate, other, tz)) return false;
    const sameInstructor = !!candidate.instructor_id && candidate.instructor_id === other.instructor_id;
    const g1 = candidate.group_id ?? null;
    const g2 = other.group_id ?? null;
    const sharedAudience = g1 === null || g2 === null || g1 === g2;
    return sameInstructor || sharedAudience;
  });
}

/* ------------------------------------------------------------------ */
/* Calendar export                                                     */
/* ------------------------------------------------------------------ */

export type CalendarEvent = ScheduleLike & {
  id: string;
  title: string;
  topics_covered?: string | null;
};

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const localStamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: max 75 octets per line, continuation lines start with a space. */
function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
      limit = 74; // continuation lines lose one octet to the leading space
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function formatOffset(ms: number): string {
  const sign = ms < 0 ? "-" : "+";
  const mins = Math.abs(Math.round(ms / 60000));
  return `${sign}${String(Math.floor(mins / 60)).padStart(2, "0")}${String(mins % 60).padStart(2, "0")}`;
}

/**
 * Build a valid iCalendar file. Recurring classes become a weekly RRULE anchored to the next
 * occurrence in the academy timezone; one-off classes use absolute UTC times.
 *
 * Limitation: the embedded VTIMEZONE uses a single fixed offset, which is exact for zones
 * without daylight saving (e.g. Africa/Lusaka). For DST zones a weekly series can be off by
 * an hour on the other side of a clock change.
 */
export function buildIcs(
  events: CalendarEvent[],
  opts: { tz: string; joinUrl: string; calendarName?: string; now?: Date }
): string {
  const now = opts.now ?? new Date();
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Zed AI Academy//Timetable//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (opts.calendarName) lines.push(`X-WR-CALNAME:${icsEscape(opts.calendarName)}`);
  lines.push(`X-WR-TIMEZONE:${opts.tz}`);

  const vevents: string[] = [];
  let usesTz = false;
  let tzOffset = 0;

  for (const ev of events) {
    const occ = nextOccurrence(ev, opts.tz, now);
    // Past one-off classes have nothing to put on a calendar.
    if (!occ) continue;

    const desc = [ev.topics_covered ? `Topics: ${ev.topics_covered}` : "", `Join: ${opts.joinUrl}`].filter(Boolean).join("\n");
    const e: string[] = [
      "BEGIN:VEVENT",
      `UID:schedule-${ev.id}@zed-ai-academy`,
      `DTSTAMP:${utcStamp(now)}`,
    ];
    if (ev.is_recurring) {
      usesTz = true;
      tzOffset = tzOffsetMs(opts.tz, occ.start);
      const sp = zonedParts(occ.start, opts.tz);
      const ep = zonedParts(occ.end, opts.tz);
      e.push(`DTSTART;TZID=${opts.tz}:${localStamp(sp.date, sp.time)}`);
      e.push(`DTEND;TZID=${opts.tz}:${localStamp(ep.date, ep.time)}`);
      e.push(`RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAY_CODES[(ev.day_of_week ?? 1) - 1]}`);
    } else {
      e.push(`DTSTART:${utcStamp(occ.start)}`);
      e.push(`DTEND:${utcStamp(occ.end)}`);
    }
    e.push(`SUMMARY:${icsEscape(ev.title)}`, `DESCRIPTION:${icsEscape(desc)}`, `URL:${opts.joinUrl}`, "STATUS:CONFIRMED", "END:VEVENT");
    vevents.push(...e);
  }

  if (usesTz) {
    const off = formatOffset(tzOffset);
    lines.push(
      "BEGIN:VTIMEZONE",
      `TZID:${opts.tz}`,
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      `TZOFFSETFROM:${off}`,
      `TZOFFSETTO:${off}`,
      `TZNAME:${opts.tz}`,
      "END:STANDARD",
      "END:VTIMEZONE"
    );
  }
  lines.push(...vevents, "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Google Calendar "add event" link for the next occurrence (weekly recurrence when applicable). */
export function googleCalendarUrl(ev: CalendarEvent, opts: { tz: string; joinUrl: string; now?: Date }): string | null {
  const occ = nextOccurrence(ev, opts.tz, opts.now ?? new Date());
  if (!occ) return null;
  const details = [ev.topics_covered ? `Topics: ${ev.topics_covered}` : "", `Join: ${opts.joinUrl}`].filter(Boolean).join("\n\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${utcStamp(occ.start)}/${utcStamp(occ.end)}`,
    details,
    ctz: opts.tz,
  });
  if (ev.is_recurring) params.set("recur", `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAY_CODES[(ev.day_of_week ?? 1) - 1]}`);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

/** Short zone label such as "CAT" or "GMT+2" for display next to times. */
export function tzLabel(tz: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

export function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  const s = normalizeTime(start);
  const e = normalizeTime(end);
  return s && e ? `${s} – ${e}` : s ?? "";
}

