import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTime, zonedToUtc, zonedParts, todayInTz, addDaysISO, isoDayOf, parseLocalDateTime,
  validateSchedule, nextOccurrence, isLiveNow, findConflicts, buildIcs, googleCalendarUrl, tzLabel, resolveTimezone,
  type ScheduleLike,
} from "./schedule.ts";

const LUSAKA = "Africa/Lusaka"; // UTC+2, no DST
const NY = "America/New_York";
const iso = (d: Date | null | undefined) => d?.toISOString();

/* ---------- clock + timezone math ---------- */

test("normalizeTime accepts common shapes and rejects junk", () => {
  assert.equal(normalizeTime("9:05"), "09:05");
  assert.equal(normalizeTime("09:05:00"), "09:05");
  assert.equal(normalizeTime("23:59"), "23:59");
  assert.equal(normalizeTime("24:00"), null);
  assert.equal(normalizeTime("12:60"), null);
  assert.equal(normalizeTime("noon"), null);
  assert.equal(normalizeTime(null), null);
});

test("zonedToUtc: Lusaka is UTC+2", () => {
  assert.equal(iso(zonedToUtc("2026-11-05", "18:00", LUSAKA)), "2026-11-05T16:00:00.000Z");
  assert.equal(iso(zonedToUtc("2026-11-05", "00:30", LUSAKA)), "2026-11-04T22:30:00.000Z"); // crosses midnight UTC
});

test("zonedToUtc follows daylight saving", () => {
  assert.equal(iso(zonedToUtc("2026-07-01", "09:00", NY)), "2026-07-01T13:00:00.000Z"); // EDT, UTC-4
  assert.equal(iso(zonedToUtc("2026-01-15", "09:00", NY)), "2026-01-15T14:00:00.000Z"); // EST, UTC-5
});

test("zonedParts is the inverse of zonedToUtc and reports ISO weekday", () => {
  const p = zonedParts(new Date("2026-11-01T23:30:00Z"), LUSAKA); // Sunday night UTC = Monday 01:30 in Lusaka
  assert.deepEqual(p, { date: "2026-11-02", time: "01:30", isoDay: 1 });
  const back = zonedToUtc(p.date, p.time, LUSAKA);
  assert.equal(iso(back), "2026-11-01T23:30:00.000Z");
});

test("todayInTz uses the academy's date, not UTC's", () => {
  assert.equal(todayInTz(LUSAKA, new Date("2026-11-01T23:30:00Z")), "2026-11-02");
  assert.equal(todayInTz("UTC", new Date("2026-11-01T23:30:00Z")), "2026-11-01");
});

test("date helpers", () => {
  assert.equal(addDaysISO("2026-12-30", 3), "2027-01-02");
  assert.equal(addDaysISO("2026-03-01", -1), "2026-02-28");
  assert.equal(isoDayOf("2026-11-02"), 1); // Monday
  assert.equal(isoDayOf("2026-11-08"), 7); // Sunday
});

test("parseLocalDateTime rejects impossible dates instead of rolling them over", () => {
  assert.deepEqual(parseLocalDateTime("2026-11-05T09:30"), { date: "2026-11-05", time: "09:30" });
  assert.equal(parseLocalDateTime("2026-02-31T09:30"), null);
  assert.equal(parseLocalDateTime("garbage"), null);
  assert.equal(parseLocalDateTime(""), null);
});

test("resolveTimezone falls back for invalid zones", () => {
  assert.equal(resolveTimezone("Mars/Olympus"), LUSAKA);
  assert.equal(resolveTimezone(null), LUSAKA);
  assert.equal(resolveTimezone("Europe/London"), "Europe/London");
});

/* ---------- validation ---------- */

const NOW = new Date("2026-11-04T08:00:00Z"); // Wednesday 10:00 in Lusaka

test("validate recurring: ok", () => {
  const r = validateSchedule({ title: " Maths ", isRecurring: true, dayOfWeek: "1", startTime: "09:00", endTime: "10:00" }, LUSAKA, NOW);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.title, "Maths");
    assert.equal(r.timing.day_of_week, 1);
    assert.equal(r.timing.start_time_only, "09:00");
    assert.equal(r.timing.starts_at, "2026-11-09T07:00:00.000Z"); // next Monday 09:00 Lusaka
  }
});

test("validate recurring: collects every problem", () => {
  const r = validateSchedule({ title: "", isRecurring: true, dayOfWeek: "9", startTime: "", endTime: "" }, LUSAKA, NOW);
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.errors.length >= 4, r.errors.join(" | "));
});

test("validate recurring: end must be after start (equal counts as invalid)", () => {
  assert.ok(!validateSchedule({ title: "A", isRecurring: true, dayOfWeek: 2, startTime: "10:00", endTime: "10:00" }, LUSAKA, NOW).ok);
  assert.ok(!validateSchedule({ title: "A", isRecurring: true, dayOfWeek: 2, startTime: "22:00", endTime: "01:00" }, LUSAKA, NOW).ok);
});

test("validate one-off: datetime-local is interpreted in the academy timezone", () => {
  const r = validateSchedule({ title: "Workshop", isRecurring: false, startsAt: "2026-11-10T14:00", endsAt: "2026-11-10T16:00" }, LUSAKA, NOW);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.timing.starts_at, "2026-11-10T12:00:00.000Z"); // 14:00 CAT
    assert.equal(r.timing.ends_at, "2026-11-10T14:00:00.000Z");
    assert.equal(r.timing.day_of_week, null);
  }
});

test("validate one-off: rejects reversed and over-long ranges", () => {
  assert.ok(!validateSchedule({ title: "A", isRecurring: false, startsAt: "2026-11-10T16:00", endsAt: "2026-11-10T14:00" }, LUSAKA, NOW).ok);
  assert.ok(!validateSchedule({ title: "A", isRecurring: false, startsAt: "2026-11-10T06:00", endsAt: "2026-11-10T20:00" }, LUSAKA, NOW).ok);
});

/* ---------- occurrences ---------- */

const monday9 = { is_recurring: true, day_of_week: 1, start_time_only: "09:00:00", end_time_only: "10:00:00" };
const wednesday9to11 = { is_recurring: true, day_of_week: 3, start_time_only: "09:00", end_time_only: "11:00" };
const wednesday8to9 = { is_recurring: true, day_of_week: 3, start_time_only: "08:00", end_time_only: "09:00" };

test("nextOccurrence: next week's slot when this week's has not happened yet", () => {
  assert.equal(iso(nextOccurrence(monday9, LUSAKA, NOW)?.start), "2026-11-09T07:00:00.000Z");
});

test("nextOccurrence: a class running right now still counts", () => {
  const occ = nextOccurrence(wednesday9to11, LUSAKA, NOW); // it is Wed 10:00 in Lusaka
  assert.equal(iso(occ?.start), "2026-11-04T07:00:00.000Z");
  assert.ok(isLiveNow(wednesday9to11, LUSAKA, NOW));
});

test("nextOccurrence: a class earlier today rolls to next week", () => {
  assert.equal(iso(nextOccurrence(wednesday8to9, LUSAKA, NOW)?.start), "2026-11-11T06:00:00.000Z");
  assert.ok(!isLiveNow(wednesday8to9, LUSAKA, NOW));
});

test("nextOccurrence: uses the academy's day, not UTC's, around midnight", () => {
  const sundayNightUtc = new Date("2026-11-01T23:30:00Z"); // already Monday 01:30 in Lusaka
  const occ = nextOccurrence({ ...monday9, start_time_only: "01:00", end_time_only: "02:00" }, LUSAKA, sundayNightUtc);
  assert.equal(iso(occ?.start), "2026-11-01T23:00:00.000Z"); // Monday 01:00 CAT, running now
});

test("nextOccurrence: one-off in the past is null, future is returned", () => {
  const past = { is_recurring: false, starts_at: "2026-11-01T07:00:00Z", ends_at: "2026-11-01T08:00:00Z" };
  const future = { is_recurring: false, starts_at: "2026-11-20T07:00:00Z", ends_at: "2026-11-20T08:00:00Z" };
  assert.equal(nextOccurrence(past, LUSAKA, NOW), null);
  assert.equal(iso(nextOccurrence(future, LUSAKA, NOW)?.start), "2026-11-20T07:00:00.000Z");
});

/* ---------- conflicts ---------- */

const mk = (o: ScheduleLike): ScheduleLike => ({ is_recurring: true, day_of_week: 1, start_time_only: "09:00", end_time_only: "10:00", instructor_id: "t1", group_id: null, ...o });

test("conflict: same instructor, overlapping time", () => {
  const hits = findConflicts(mk({ start_time_only: "09:30", end_time_only: "10:30", group_id: "g1" }), [mk({ id: "a", group_id: "g2" })], LUSAKA);
  assert.deepEqual(hits.map((h) => h.id), ["a"]);
});

test("conflict: back-to-back classes do not clash", () => {
  assert.equal(findConflicts(mk({ start_time_only: "10:00", end_time_only: "11:00" }), [mk({ id: "a" })], LUSAKA).length, 0);
});

test("conflict: different day does not clash", () => {
  assert.equal(findConflicts(mk({ day_of_week: 2 }), [mk({ id: "a" })], LUSAKA).length, 0);
});

test("conflict: different instructor AND different groups can run in parallel", () => {
  const hits = findConflicts(mk({ instructor_id: "t2", group_id: "g1" }), [mk({ id: "a", group_id: "g2" })], LUSAKA);
  assert.equal(hits.length, 0);
});

test("conflict: same group clashes even with a different instructor", () => {
  const hits = findConflicts(mk({ instructor_id: "t2", group_id: "g1" }), [mk({ id: "a", group_id: "g1" })], LUSAKA);
  assert.equal(hits.length, 1);
});

test("conflict: a whole-academy class clashes with any group's class at that time", () => {
  const hits = findConflicts(mk({ instructor_id: "t2", group_id: null }), [mk({ id: "a", group_id: "g2" })], LUSAKA);
  assert.equal(hits.length, 1);
});

test("conflict: editing a class ignores itself", () => {
  assert.equal(findConflicts(mk({ id: "a" }), [mk({ id: "a" })], LUSAKA).length, 0);
});

test("conflict: one-off against a recurring slot (compares wall clock in the academy zone)", () => {
  // Monday 2026-11-09 09:30-10:30 CAT = 07:30-08:30Z
  const oneOff = { id: "x", is_recurring: false, starts_at: "2026-11-09T07:30:00Z", ends_at: "2026-11-09T08:30:00Z", instructor_id: "t1", group_id: null };
  assert.equal(findConflicts(oneOff, [mk({ id: "a" })], LUSAKA).length, 1);
  const tuesday = { ...oneOff, starts_at: "2026-11-10T07:30:00Z", ends_at: "2026-11-10T08:30:00Z" };
  assert.equal(findConflicts(tuesday, [mk({ id: "a" })], LUSAKA).length, 0);
});

/* ---------- calendar export ---------- */

test("ics: structurally valid, with the required properties, CRLF and escaping", () => {
  const ics = buildIcs(
    [
      { id: "r1", title: "Maths, Algebra; Part 1", topics_covered: "Linear equations\nGraphs", ...wednesday9to11 },
      { id: "o1", title: "Workshop", is_recurring: false, starts_at: "2026-11-20T07:00:00Z", ends_at: "2026-11-20T09:00:00Z" },
    ],
    { tz: LUSAKA, joinUrl: "https://x.test/academy/a/classroom?tab=session", now: NOW }
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  for (const prop of ["UID:schedule-r1@", "DTSTAMP:20261104T080000Z", "DTSTART;TZID=Africa/Lusaka:20261104T090000", "DTEND;TZID=Africa/Lusaka:20261104T110000", "RRULE:FREQ=WEEKLY;BYDAY=WE", "DTSTART:20261120T070000Z", "TZOFFSETTO:+0200"]) {
    assert.ok(ics.includes(prop), `missing ${prop}`);
  }
  assert.ok(ics.includes("SUMMARY:Maths\\, Algebra\\; Part 1"));
  assert.ok(ics.includes("Linear equations\\nGraphs"));
  assert.ok(!/[^\r]\n/.test(ics), "all line breaks must be CRLF");
});

test("ics: no line exceeds 75 octets, even with long or multibyte text", () => {
  const ics = buildIcs([{ id: "z", title: "Ñandú ".repeat(40), ...monday9 }], { tz: LUSAKA, joinUrl: "https://x.test/" + "a".repeat(120), now: NOW });
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, `too long: ${line.length}`);
  // unfolding must reproduce the original title
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("SUMMARY:" + "Ñandú ".repeat(40)));
});

test("ics: skips one-off classes that already happened and omits VTIMEZONE when unused", () => {
  const ics = buildIcs([{ id: "p", title: "Old", is_recurring: false, starts_at: "2026-10-01T07:00:00Z", ends_at: "2026-10-01T08:00:00Z" }], { tz: LUSAKA, joinUrl: "https://x.test", now: NOW });
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 0);
  assert.ok(!ics.includes("VTIMEZONE"));
});

test("google calendar link: UTC dates, tz and weekly recurrence", () => {
  const url = googleCalendarUrl({ id: "r1", title: "Maths", ...monday9 }, { tz: LUSAKA, joinUrl: "https://x.test", now: NOW })!;
  const q = new URL(url).searchParams;
  assert.equal(q.get("dates"), "20261109T070000Z/20261109T080000Z");
  assert.equal(q.get("ctz"), LUSAKA);
  assert.equal(q.get("recur"), "RRULE:FREQ=WEEKLY;BYDAY=MO");
  assert.equal(googleCalendarUrl({ id: "p", title: "Old", is_recurring: false, starts_at: "2026-10-01T07:00:00Z", ends_at: "2026-10-01T08:00:00Z" }, { tz: LUSAKA, joinUrl: "x", now: NOW }), null);
});

test("tzLabel", () => {
  assert.match(tzLabel(LUSAKA, NOW), /CAT|GMT\+2/);
});
