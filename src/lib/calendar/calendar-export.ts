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

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description || "Zed AI Academy Live Session",
    location: event.location || window.location.href,
    dates: `${startTimeStr}/${endTimeStr}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
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
