"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { getJaasAppId, sanitizeRoomSegment, signJaasToken, type JaasUser } from "@/lib/jitsi/token";

/**
 * Every JaaS token is minted here, on the server. The client only says WHAT it
 * wants to join (an academy, a booking or a lesson block); the room name and
 * the moderator role are always derived from the database and the caller's
 * identity — never taken from the client.
 */
type JitsiJoinResult =
  | { success: true; token: string; roomName: string; appId: string; moderator: boolean }
  | { success: false; error: string };

async function currentJaasUser(): Promise<JaasUser | null> {
  const user = await currentUser();
  if (!user) return null;
  return {
    id: user.id,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Participant",
    email: user.primaryEmailAddress?.emailAddress ?? "",
    avatar: user.imageUrl || "",
  };
}

function failure(error: unknown): JitsiJoinResult {
  const message = error instanceof Error ? error.message : "Failed to join the session";
  return { success: false, error: message };
}

async function mint(roomName: string, moderator: boolean): Promise<JitsiJoinResult> {
  const user = await currentJaasUser();
  if (!user) throw new Error("Unauthorized");
  const token = signJaasToken({ room: roomName, user, moderator });
  return { success: true, token, roomName, appId: getJaasAppId(), moderator };
}

async function isPlatformSuperAdmin(userId: string) {
  const { data } = await createClient().from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "super_admin";
}

// Canonical room for a 1:1 booking, shared by learner and instructor. Not
// exported: every export of a "use server" file is callable from the browser.
function bookingRoomName(bookingId: string, zoomMeetingId: string | null | undefined) {
  const fromZoom = zoomMeetingId ? sanitizeRoomSegment(zoomMeetingId) : "";
  return fromZoom || `zed-session-${bookingId}`;
}

/**
 * Join the academy classroom's currently live session. The room and the
 * moderator role are decided on the server from the session state and the
 * caller's membership — nothing is taken from the client except the academy id.
 */
export async function getClassroomJitsiToken(companyId: string): Promise<JitsiJoinResult> {
  try {
    const access = await getCurrentTenantAccess(companyId);
    if (!access || (!access.isSuperAdmin && !access.isMember)) throw new Error("You are not a member of this academy.");

    const { data: company } = await createClient()
      .from("companies")
      .select("is_session_active, active_room_name")
      .eq("id", companyId)
      .single();
    const state = company as { is_session_active: boolean; active_room_name: string | null } | null;
    if (!state?.is_session_active || !state.active_room_name) throw new Error("There is no live class right now.");

    const moderator = access.isSuperAdmin || isTeachingRole(access.tenantRole);
    return await mint(state.active_room_name, moderator);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Join a 1:1 booking. Only the booking's learner and instructor (or a platform
 * super admin) may join. Learners need a confirmed booking inside the join
 * window; only the instructor or a super admin is a moderator.
 */
export async function getBookingJitsiToken(bookingId: string): Promise<JitsiJoinResult> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const supabase = createClient();
    const { data: booking } = await supabase
      .from("live_session_bookings")
      .select("id, learner_id, instructor_id, status, starts_at, ends_at")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) throw new Error("Session not found.");

    const isInstructor = booking.instructor_id === userId;
    const isLearner = booking.learner_id === userId;
    const isSuperAdmin = !isInstructor && !isLearner && (await isPlatformSuperAdmin(userId));
    if (!isInstructor && !isLearner && !isSuperAdmin) throw new Error("Session not found.");

    const isHost = isInstructor || isSuperAdmin;
    if (!isHost) {
      if (booking.status !== "confirmed") throw new Error("This session is not confirmed yet.");
      const now = Date.now();
      const opensAt = new Date(booking.starts_at).getTime() - 15 * 60_000;
      const closesAt = new Date(booking.ends_at).getTime() + 30 * 60_000;
      if (now < opensAt || now > closesAt) throw new Error("This session is outside its join window.");
    }

    const { data: meeting } = await supabase
      .from("zoom_meetings")
      .select("zoom_meeting_id")
      .eq("booking_id", booking.id)
      .maybeSingle();

    return await mint(bookingRoomName(booking.id, meeting?.zoom_meeting_id), isHost);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Join the standalone live class embedded in a lesson's "meeting" block (no
 * booking). Enrolled learners join as participants; the course instructor,
 * the academy's teaching staff and platform super admins join as moderators.
 * The room is scoped to the course so another course can never share it.
 */
export async function getLessonMeetingJitsiToken(blockId: string): Promise<JitsiJoinResult> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const supabase = createClient();
    const { data: block } = await supabase
      .from("content_blocks")
      .select("id, lesson_id, type, content")
      .eq("id", blockId)
      .eq("type", "meeting")
      .maybeSingle();
    if (!block) throw new Error("Live class not found.");

    const { data: lesson } = await supabase.from("lessons").select("id, module_id").eq("id", block.lesson_id).maybeSingle();
    if (!lesson) throw new Error("Live class not found.");
    const { data: moduleRow } = await supabase.from("modules").select("course_id").eq("id", lesson.module_id).maybeSingle();
    if (!moduleRow) throw new Error("Live class not found.");
    const { data: course } = await supabase
      .from("courses")
      .select("id, instructor_id, company_id")
      .eq("id", moduleRow.course_id)
      .maybeSingle();
    if (!course) throw new Error("Live class not found.");

    let moderator = course.instructor_id === userId;
    if (!moderator && course.company_id) {
      const access = await getCurrentTenantAccess(course.company_id);
      moderator = !!access && (access.isSuperAdmin || isTeachingRole(access.tenantRole));
    }
    if (!moderator) moderator = await isPlatformSuperAdmin(userId);

    if (!moderator) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("status")
        .eq("user_id", userId)
        .eq("course_id", course.id)
        .maybeSingle();
      if (enrollment?.status !== "active") throw new Error("Enroll in this course to join its live class.");
    }

    const content = (block.content ?? {}) as Record<string, unknown>;
    const configured = typeof content.meeting_id === "string" ? sanitizeRoomSegment(content.meeting_id, 48) : "";
    const roomName = `course-${course.id}-${configured || `lesson-${lesson.id}`}`;

    return await mint(roomName, moderator);
  } catch (error) {
    return failure(error);
  }
}
