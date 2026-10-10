"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { getJaasAppId, signJaasToken, type JaasUser } from "@/lib/jitsi/token";

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

    const user = await currentJaasUser();
    if (!user) throw new Error("Unauthorized");

    const moderator = access.isSuperAdmin || isTeachingRole(access.tenantRole);
    const token = signJaasToken({ room: state.active_room_name, user, moderator });
    return { success: true, token, roomName: state.active_room_name, appId: getJaasAppId(), moderator };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Join a confirmed 1:1 booking. Only the booking's learner and instructor may
 * join, inside the join window; only the instructor is a moderator.
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

    if (!booking || (booking.learner_id !== userId && booking.instructor_id !== userId)) {
      throw new Error("Session not found.");
    }
    const isInstructor = booking.instructor_id === userId;
    if (booking.status !== "confirmed" && !isInstructor) throw new Error("This session is not confirmed yet.");

    const now = Date.now();
    const opensAt = new Date(booking.starts_at).getTime() - 15 * 60_000;
    const closesAt = new Date(booking.ends_at).getTime() + 30 * 60_000;
    if (!isInstructor && (now < opensAt || now > closesAt)) {
      throw new Error("This session is outside its join window.");
    }

    const { data: meeting } = await supabase
      .from("zoom_meetings")
      .select("zoom_meeting_id")
      .eq("booking_id", booking.id)
      .maybeSingle();
    const roomName = meeting?.zoom_meeting_id || booking.id;

    const user = await currentJaasUser();
    if (!user) throw new Error("Unauthorized");

    const token = signJaasToken({ room: roomName, user, moderator: isInstructor });
    return { success: true, token, roomName, appId: getJaasAppId(), moderator: isInstructor };
  } catch (error) {
    return failure(error);
  }
}
