import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient<Database>;

type ServiceRow = Database["public"]["Tables"]["live_session_services"]["Row"];
type RuleRow = Database["public"]["Tables"]["instructor_availability_rules"]["Row"];
type ExceptionRow = Database["public"]["Tables"]["instructor_availability_exceptions"]["Row"];
type BookingRow = Pick<
  Database["public"]["Tables"]["live_session_bookings"]["Row"],
  "starts_at" | "ends_at" | "status"
>;

export type LiveSessionSlot = {
  starts_at: string;
  ends_at: string;
  label: string;
};

export type LiveSessionSlotDay = {
  date: string;
  label: string;
  slots: LiveSessionSlot[];
};

const ACTIVE_BOOKING_STATUSES = ["requested", "confirmed", "reschedule_requested"];

function parseClock(clock: string) {
  const [hour = "0", minute = "0", second = "0"] = clock.split(":");
  return {
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

function getDateRange(from: string, to: string) {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function getWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function getTimezoneOffsetMs(timeZone: string, utcDate: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcDate);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return asUtc - utcDate.getTime();
}

function zonedDateTimeToUtc(date: string, clock: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const { hour, minute, second } = parseClock(clock);
  const firstGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const firstOffset = getTimezoneOffsetMs(timeZone, firstGuess);
  const secondGuess = new Date(firstGuess.getTime() - firstOffset);
  const secondOffset = getTimezoneOffsetMs(timeZone, secondGuess);
  return new Date(firstGuess.getTime() - secondOffset);
}

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDay(date: string, timeZone: string) {
  const middayUtc = zonedDateTimeToUtc(date, "12:00:00", timeZone);
  return new Intl.DateTimeFormat("en", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(middayUtc);
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function isUnavailable(
  slotStart: Date,
  slotEnd: Date,
  date: string,
  timezone: string,
  exceptions: ExceptionRow[]
) {
  return exceptions
    .filter((exception) => exception.kind === "unavailable" && exception.date === date)
    .some((exception) => {
      if (!exception.start_time || !exception.end_time) return true;
      const blockedStart = zonedDateTimeToUtc(date, exception.start_time, exception.timezone || timezone);
      const blockedEnd = zonedDateTimeToUtc(date, exception.end_time, exception.timezone || timezone);
      return overlaps(slotStart, slotEnd, blockedStart, blockedEnd);
    });
}

function blocksExistingBooking(
  slotStart: Date,
  slotEnd: Date,
  service: ServiceRow,
  bookings: BookingRow[]
) {
  return bookings
    .filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status))
    .some((booking) => {
      const bookingStart = new Date(booking.starts_at);
      const bookingEnd = new Date(booking.ends_at);
      const bufferedStart = new Date(bookingStart.getTime() - service.buffer_before_minutes * 60_000);
      const bufferedEnd = new Date(bookingEnd.getTime() + service.buffer_after_minutes * 60_000);
      return overlaps(slotStart, slotEnd, bufferedStart, bufferedEnd);
    });
}

function buildWindows(date: string, timezone: string, rules: RuleRow[], exceptions: ExceptionRow[]) {
  const weekday = getWeekday(date);
  const windows = rules
    .filter((rule) => rule.is_active && rule.weekday === weekday)
    .map((rule) => ({
      startsAt: zonedDateTimeToUtc(date, rule.start_time, rule.timezone || timezone),
      endsAt: zonedDateTimeToUtc(date, rule.end_time, rule.timezone || timezone),
    }));

  const extraWindows = exceptions
    .filter((exception) => exception.kind === "extra_available" && exception.date === date && exception.start_time && exception.end_time)
    .map((exception) => ({
      startsAt: zonedDateTimeToUtc(date, exception.start_time!, exception.timezone || timezone),
      endsAt: zonedDateTimeToUtc(date, exception.end_time!, exception.timezone || timezone),
    }));

  return [...windows, ...extraWindows];
}

export async function getLiveSessionSlots(
  supabase: Db,
  serviceId: string,
  options?: {
    from?: string;
    to?: string;
    timezone?: string;
  }
) {
  const now = new Date();
  const defaultFrom = now.toISOString().slice(0, 10);
  const defaultTo = addDays(defaultFrom, 14);
  const from = options?.from ?? defaultFrom;
  const to = options?.to ?? defaultTo;

  const { data: service, error: serviceError } = await supabase
    .from("live_session_services")
    .select("*")
    .eq("id", serviceId)
    .eq("is_active", true)
    .single();

  if (serviceError || !service) {
    throw new Error(serviceError?.message || "Live session service not found");
  }

  const timezone = options?.timezone ?? "Africa/Lusaka";

  const [{ data: rules }, { data: exceptions }, { data: bookings }] = await Promise.all([
    supabase
      .from("instructor_availability_rules")
      .select("*")
      .eq("instructor_id", service.instructor_id)
      .eq("is_active", true),
    supabase
      .from("instructor_availability_exceptions")
      .select("*")
      .eq("instructor_id", service.instructor_id)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("live_session_bookings")
      .select("starts_at, ends_at, status")
      .eq("instructor_id", service.instructor_id)
      .gte("starts_at", new Date(`${from}T00:00:00.000Z`).toISOString())
      .lte("starts_at", new Date(`${to}T23:59:59.999Z`).toISOString()),
  ]);

  const minStart = new Date(now.getTime() + service.min_notice_hours * 60 * 60_000);
  const maxStart = new Date(now.getTime() + service.max_booking_days * 24 * 60 * 60_000);

  const days: LiveSessionSlotDay[] = getDateRange(from, to).map((date) => {
    const slots: LiveSessionSlot[] = [];
    const windows = buildWindows(date, timezone, rules ?? [], exceptions ?? []);

    for (const window of windows) {
      let cursor = new Date(window.startsAt);
      while (cursor.getTime() + service.duration_minutes * 60_000 <= window.endsAt.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor.getTime() + service.duration_minutes * 60_000);

        if (
          slotStart >= minStart
          && slotStart <= maxStart
          && !isUnavailable(slotStart, slotEnd, date, timezone, exceptions ?? [])
          && !blocksExistingBooking(slotStart, slotEnd, service, bookings ?? [])
        ) {
          slots.push({
            starts_at: slotStart.toISOString(),
            ends_at: slotEnd.toISOString(),
            label: formatTime(slotStart, timezone),
          });
        }

        cursor = new Date(cursor.getTime() + 15 * 60_000);
      }
    }

    return {
      date,
      label: formatDay(date, timezone),
      slots,
    };
  });

  return {
    service,
    timezone,
    days,
  };
}
