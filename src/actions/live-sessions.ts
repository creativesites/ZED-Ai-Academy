"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getLiveSessionSlots } from "@/lib/live-sessions/slots";
import { createZoomMeeting, hasZoomRestConfig } from "@/lib/zoom/api";
import type { Json } from "@/types/database";

function readString(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(formData: FormData, key: string, fallback: number) {
  const str = readString(formData, key);
  if (!str) return fallback;
  const value = Number(str);
  return Number.isFinite(value) ? value : fallback;
}

async function requireInstructor() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["instructor", "super_admin"].includes(profile.role)) {
    throw new Error("Unauthorized");
  }

  return { userId, supabase };
}

async function requireLearner() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return { userId, supabase: createClient() };
}

export async function getInstructorLiveSessionServices() {
  const { userId, supabase } = await requireInstructor();
  const { data, error } = await supabase
    .from("live_session_services")
    .select("id, title, is_active")
    .eq("instructor_id", userId)
    .order("created_at", { ascending: false });
  
  if (error) throw new Error(error.message);
  return data;
}

export async function createLiveSessionService(formData: FormData) {
  const { userId, supabase } = await requireInstructor();
  const courseId = readString(formData, "course_id");
  const lessonId = readString(formData, "lesson_id");
  const title = readString(formData, "title");

  if (!title) throw new Error("Service title is required");

  const { error } = await supabase.from("live_session_services").insert({
    instructor_id: userId,
    course_id: courseId || null,
    lesson_id: lessonId || null,
    title,
    description: readString(formData, "description") || null,
    duration_minutes: readNumber(formData, "duration_minutes", 30),
    buffer_before_minutes: readNumber(formData, "buffer_before_minutes", 0),
    buffer_after_minutes: readNumber(formData, "buffer_after_minutes", 0),
    min_notice_hours: readNumber(formData, "min_notice_hours", 12),
    max_booking_days: readNumber(formData, "max_booking_days", 30),
    requires_instructor_confirmation: formData.get("requires_instructor_confirmation") !== "false",
    is_active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/creator/live-sessions");
}

export async function updateLiveSessionServiceStatus(serviceId: string, isActive: boolean) {
  const { userId, supabase } = await requireInstructor();

  const { error } = await supabase
    .from("live_session_services")
    .update({ is_active: isActive })
    .eq("id", serviceId)
    .eq("instructor_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/creator/live-sessions");
}

export async function createAvailabilityRule(formData: FormData) {
  const { userId, supabase } = await requireInstructor();
  const weekday = readNumber(formData, "weekday", -1);
  const startTime = readString(formData, "start_time");
  const endTime = readString(formData, "end_time");

  if (weekday < 0 || weekday > 6) throw new Error("Choose a weekday");
  if (!startTime || !endTime) throw new Error("Start and end time are required");

  const { error } = await supabase.from("instructor_availability_rules").insert({
    instructor_id: userId,
    weekday,
    start_time: startTime,
    end_time: endTime,
    timezone: readString(formData, "timezone", "Africa/Lusaka"),
    is_active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/creator/live-sessions");
}

export async function deleteAvailabilityRule(ruleId: string) {
  const { userId, supabase } = await requireInstructor();

  const { error } = await supabase
    .from("instructor_availability_rules")
    .delete()
    .eq("id", ruleId)
    .eq("instructor_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/creator/live-sessions");
}

export async function requestLiveSessionBooking(formData: FormData) {
  const { userId, supabase } = await requireLearner();
  const serviceId = readString(formData, "service_id");
  const startsAt = readString(formData, "starts_at");
  const endsAt = readString(formData, "ends_at");
  const timezone = readString(formData, "timezone", "Africa/Lusaka");

  if (!serviceId || !startsAt || !endsAt) throw new Error("Choose a valid slot");

  const { service, days } = await getLiveSessionSlots(supabase, serviceId, {
    from: startsAt.slice(0, 10),
    to: startsAt.slice(0, 10),
    timezone,
  });

  const stillAvailable = days
    .flatMap((day) => day.slots)
    .some((slot) => slot.starts_at === startsAt && slot.ends_at === endsAt);

  if (!stillAvailable) throw new Error("That slot is no longer available");

  const status = service.requires_instructor_confirmation ? "requested" : "confirmed";
  const now = new Date().toISOString();

  const { data: booking, error } = await supabase
    .from("live_session_bookings")
    .insert({
      service_id: serviceId,
      course_id: service.course_id,
      lesson_id: service.lesson_id,
      instructor_id: service.instructor_id,
      learner_id: userId,
      status,
      starts_at: startsAt,
      ends_at: endsAt,
      timezone,
      learner_notes: readString(formData, "learner_notes") || null,
      confirmed_at: status === "confirmed" ? now : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("live_session_events").insert({
    booking_id: booking.id,
    actor_id: userId,
    event_type: "booking_requested",
    metadata: { status },
  });

  revalidatePath("/dashboard");
  revalidatePath("/creator/live-sessions");
  revalidatePath(`/live-sessions/${serviceId}/book`);
}

export async function confirmLiveSessionBooking(bookingId: string) {
  const { userId, supabase } = await requireInstructor();
  const now = new Date().toISOString();

  const { data: booking } = await supabase
    .from("live_session_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("instructor_id", userId)
    .single();

  if (!booking) throw new Error("Booking not found");

  const { data: service } = await supabase
    .from("live_session_services")
    .select("title, duration_minutes")
    .eq("id", booking.service_id)
    .single();

  const { error } = await supabase
    .from("live_session_bookings")
    .update({ status: "confirmed", confirmed_at: now, declined_at: null })
    .eq("id", bookingId)
    .eq("instructor_id", userId);

  if (error) throw new Error(error.message);

  if (hasZoomRestConfig()) {
    const { data: existingMeeting } = await supabase
      .from("zoom_meetings")
      .select("id")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (!existingMeeting) {
      const zoomMeeting = await createZoomMeeting({
        topic: service?.title || "Zed AI Academy Live Session",
        startsAt: booking.starts_at,
        durationMinutes: service?.duration_minutes || Math.max(15, Math.round((new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60_000)),
        timezone: booking.timezone,
        agenda: booking.learner_notes || undefined,
      });

      await supabase.from("zoom_meetings").insert({
        booking_id: bookingId,
        zoom_meeting_id: String(zoomMeeting.id),
        zoom_uuid: zoomMeeting.uuid ?? null,
        host_id: zoomMeeting.host_id ?? null,
        host_email: zoomMeeting.host_email ?? null,
        topic: zoomMeeting.topic,
        start_url_encrypted: zoomMeeting.start_url ?? null,
        join_url: zoomMeeting.join_url ?? null,
        password_encrypted: zoomMeeting.password ?? null,
        settings: (zoomMeeting.settings ?? {}) as Json,
      });

      await supabase.from("live_session_events").insert({
        booking_id: bookingId,
        actor_id: userId,
        event_type: "zoom_meeting_created",
        metadata: { zoom_meeting_id: String(zoomMeeting.id) },
      });
    }
  } else {
    await supabase.from("live_session_events").insert({
      booking_id: bookingId,
      actor_id: userId,
      event_type: "zoom_meeting_not_configured",
      metadata: { missing: "Zoom REST API environment variables" },
    });
  }

  await supabase.from("live_session_events").insert({
    booking_id: bookingId,
    actor_id: userId,
    event_type: "booking_confirmed",
  });

  revalidatePath("/creator/live-sessions");
  revalidatePath("/dashboard");
}

export async function declineLiveSessionBooking(bookingId: string) {
  const { userId, supabase } = await requireInstructor();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("live_session_bookings")
    .update({ status: "declined", declined_at: now })
    .eq("id", bookingId)
    .eq("instructor_id", userId);

  if (error) throw new Error(error.message);

  await supabase.from("live_session_events").insert({
    booking_id: bookingId,
    actor_id: userId,
    event_type: "booking_declined",
  });

  revalidatePath("/creator/live-sessions");
  revalidatePath("/dashboard");
}

export async function startLiveSessionAttendance(bookingId: string) {
  const { userId, supabase } = await requireLearner();

  const { data: booking } = await supabase
    .from("live_session_bookings")
    .select("id, learner_id, instructor_id, status, starts_at, ends_at")
    .eq("id", bookingId)
    .single();

  if (!booking || (booking.learner_id !== userId && booking.instructor_id !== userId)) {
    throw new Error("Unauthorized");
  }

  const now = Date.now();
  const allowedStart = new Date(booking.starts_at).getTime() - 15 * 60_000;
  const allowedEnd = new Date(booking.ends_at).getTime() + 30 * 60_000;
  if (booking.status !== "confirmed" || now < allowedStart || now > allowedEnd) {
    throw new Error("Session is outside the attendance window");
  }

  const role = booking.instructor_id === userId ? "instructor" : "learner";
  const { data, error } = await supabase
    .from("live_session_attendance")
    .insert({
      booking_id: bookingId,
      user_id: userId,
      role,
      client_metadata: { source: "web_studio" },
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function endLiveSessionAttendance(attendanceId: string) {
  const { userId, supabase } = await requireLearner();
  const leftAt = new Date();

  const { data: attendance } = await supabase
    .from("live_session_attendance")
    .select("joined_at")
    .eq("id", attendanceId)
    .eq("user_id", userId)
    .single();

  if (!attendance) return;

  const durationSeconds = Math.max(0, Math.round((leftAt.getTime() - new Date(attendance.joined_at).getTime()) / 1000));
  await supabase
    .from("live_session_attendance")
    .update({
      left_at: leftAt.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("id", attendanceId)
    .eq("user_id", userId);
}
