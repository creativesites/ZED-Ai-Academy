/**
 * Calendar export helper utilities for Zed AI Academy live sessions.
 */

export type CalendarEventDetails = {
  title: string;
  description?: string;
  startsAt: string; // ISO string
  endsAt: string;   // ISO string
  location?: string;
};

/**
 * Generates a Google Calendar "Add Event" URL.
 */
export function getGoogleCalendarUrl(event: CalendarEventDetails): string {
  const startTimeStr = formatDateForCalendar(event.startsAt);
  const endTimeStr = formatDateForCalendar(event.endsAt);
  const locationUrl = typeof window !== "undefined" ? window.location.href : "";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description || "Zed AI Academy Live Session",
    location: event.location || locationUrl,
    dates: `${startTimeStr}/${endTimeStr}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Resolves the next upcoming date & time range for a class schedule.
 */
export function getScheduleEventDetails(schedule: any, companySlug: string): CalendarEventDetails {
  const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://academy.zedai.org");
  const classroomUrl = `${origin}/academy/${companySlug}/classroom?tab=session`;
  const title = schedule.title || "Live Class Session";
  const description = `${schedule.topics_covered ? `Topics Covered: ${schedule.topics_covered}\n\n` : ""}${schedule.description ? `${schedule.description}\n\n` : ""}Join live classroom: ${classroomUrl}`;

  let startsAt = new Date().toISOString();
  let endsAt = new Date(Date.now() + 3600000).toISOString();

  if (schedule.is_recurring && schedule.start_time_only) {
    const today = new Date();
    const targetDay = Number(schedule.day_of_week) || 1; // 1 = Monday
    const currentDay = today.getDay() === 0 ? 7 : today.getDay();
    let diff = targetDay - currentDay;
    const [sh, sm] = (schedule.start_time_only || "10:00").split(":");
    const [eh, em] = (schedule.end_time_only || "11:00").split(":");

    // If today is target day, check if time has already passed
    if (diff === 0) {
      const todayScheduledTime = new Date(today);
      todayScheduledTime.setHours(Number(sh), Number(sm), 0, 0);
      if (todayScheduledTime.getTime() < today.getTime()) {
        diff = 7; // Next week
      }
    } else if (diff < 0) {
      diff += 7;
    }

    const targetDate = new Date(today.getTime() + diff * 86400000);
    targetDate.setHours(Number(sh), Number(sm), 0, 0);

    const targetEndDate = new Date(targetDate);
    targetEndDate.setHours(Number(eh), Number(em), 0, 0);

    startsAt = targetDate.toISOString();
    endsAt = targetEndDate.toISOString();
  } else if (schedule.starts_at) {
    startsAt = new Date(schedule.starts_at).toISOString();
    endsAt = new Date(schedule.ends_at || schedule.starts_at).toISOString();
  }

  return {
    title,
    description,
    startsAt,
    endsAt,
    location: `Zed AI Academy Classroom (${classroomUrl})`,
  };
}

/**
 * Generates and triggers a browser download for a standard .ics (iCalendar) file.
 */
export function downloadIcsFile(event: CalendarEventDetails): void {
  const startTimeStr = formatDateForCalendar(event.startsAt);
  const endTimeStr = formatDateForCalendar(event.endsAt);
  const nowStr = formatDateForCalendar(new Date().toISOString());

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zed AI Academy//Live Sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:zed-session-${Date.now()}@zedaiacademy.com`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startTimeStr}`,
    `DTEND:${endTimeStr}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description || "Zed AI Academy Live Session")}`,
    `LOCATION:${escapeIcsText(event.location || window.location.href)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${slugify(event.title)}-session.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateForCalendar(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}
