"use server";

import { revalidatePath } from "next/cache";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";
import { createClient } from "@/lib/supabase/server";
import { newRoomName } from "@/lib/jitsi/token";

type ClassScheduleInsert = {
  company_id: string;
  title: string;
  instructor_id: string;
  schedule_type: "live_session" | "workshop" | "assignment_due" | "other";
  topics_covered: string | null;
  is_recurring: boolean;
  group_id: string | null;
  day_of_week?: number;
  start_time_only?: string;
  end_time_only?: string;
  starts_at: string;
  ends_at: string;
};

async function requireInstructor(companyId: string) {
  return requireTenantTeacher(companyId);
}

type ServiceClient = Awaited<ReturnType<typeof requireTenantMember>>["supabase"];

// Never trust that an id sent by the client belongs to the companyId it was sent with.
async function assertGroupInCompany(supabase: ServiceClient, groupId: string, companyId: string) {
  const { data } = await supabase
    .from("classroom_groups")
    .select("id")
    .eq("id", groupId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) throw new Error("Group not found.");
}

async function assertScheduleInCompany(supabase: ServiceClient, scheduleId: string, companyId: string) {
  const { data } = await supabase
    .from("class_schedules")
    .select("id")
    .eq("id", scheduleId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) throw new Error("Schedule not found.");
}

async function assertStudentInCompany(supabase: ServiceClient, profileId: string, companyId: string) {
  const [{ data: member }, { data: enrollment }] = await Promise.all([
    supabase
      .from("company_members")
      .select("profile_id")
      .eq("company_id", companyId)
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("user_id", profileId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!member && !enrollment) throw new Error("Student not found in this academy.");
}

// Resolve the owning company from the schedule row itself, then authorize.
async function requireInstructorForSchedule(scheduleId: string) {
  const { data: schedule } = await createClient()
    .from("class_schedules")
    .select("company_id")
    .eq("id", scheduleId)
    .maybeSingle();
  if (!schedule?.company_id) throw new Error("Schedule not found.");
  return requireInstructor(schedule.company_id as string);
}

// Session State
export async function getCompanySessionState(companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const { data, error } = await supabase
    .from("companies")
    .select("is_session_active, active_room_name, active_schedule_id, active_session_id")
    .eq("id", companyId)
    .single();
  
  if (error) return { is_session_active: false, active_room_name: null, active_schedule_id: null, active_session_id: null };
  return data as any;
}

/**
 * Start or end the academy's live class. The room name is generated here on
 * the server (unguessable) and never accepted from the client.
 */
export async function toggleClassroomSession(companyId: string, companySlug: string, active: boolean, scheduleId: string | null = null) {
  const { supabase } = await requireInstructor(companyId);

  const { data: current } = await supabase
    .from("companies")
    .select("is_session_active, active_room_name, active_session_id")
    .eq("id", companyId)
    .single();
  const state = current as { is_session_active: boolean; active_room_name: string | null; active_session_id: string | null } | null;

  // Close the previous history record (if any) before starting/ending.
  async function closeActiveRecord() {
    if (!state?.active_session_id) return;
    const { data: record } = await (supabase.from("classroom_sessions") as any)
      .select("started_at, ended_at")
      .eq("id", state.active_session_id)
      .maybeSingle();
    if (!record || record.ended_at) return;
    const endedAt = new Date();
    const durationSeconds = record.started_at
      ? Math.max(0, Math.round((endedAt.getTime() - new Date(record.started_at).getTime()) / 1000))
      : null;
    await (supabase.from("classroom_sessions") as any)
      .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
      .eq("id", state.active_session_id);
  }

  if (!active) {
    await closeActiveRecord();
    const { error } = await supabase
      .from("companies")
      .update({ is_session_active: false, active_room_name: null, active_schedule_id: null, active_session_id: null } as any)
      .eq("id", companyId);
    if (error) throw new Error(error.message);
    revalidatePath(`/academy/${companySlug}/admin/classroom`);
    return { success: true, roomName: null, created: false };
  }

  // Already live: starting again is a no-op (idempotent), so a double click or
  // a second teacher doesn't orphan the running class.
  if (state?.is_session_active && state.active_room_name) {
    return { success: true, roomName: state.active_room_name, created: false };
  }

  if (scheduleId) await assertScheduleInCompany(supabase, scheduleId, companyId);

  const roomName = newRoomName(`classroom-${companySlug}`);
  const { data: sessionData, error: sessionError } = await (supabase.from("classroom_sessions") as any)
    .insert({ company_id: companyId, schedule_id: scheduleId || null, room_name: roomName })
    .select("id")
    .single();
  if (sessionError || !sessionData) throw new Error(sessionError?.message || "Failed to start the class.");

  const { error } = await supabase
    .from("companies")
    .update({
      is_session_active: true,
      active_room_name: roomName,
      active_schedule_id: scheduleId || null,
      active_session_id: (sessionData as any).id,
    } as any)
    .eq("id", companyId);

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  return { success: true, roomName, created: true };
}

// Announcements (Fixed revalidation)
export async function getAnnouncements(companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function postAnnouncement(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const { userId, supabase } = await requireInstructor(companyId);

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  const { error } = await supabase.from("announcements").insert({
    company_id: companyId,
    author_id: userId,
    title,
    content,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/classroom`);
}

// Timetable
export async function getClassSchedules(companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const { data, error } = await supabase
    .from("class_schedules")
    .select("*")
    .eq("company_id", companyId)
    .order("day_of_week", { ascending: true })
    .order("start_time_only", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

// Groups and Students
export async function getClassroomGroups(companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const { data, error } = await supabase
    .from("classroom_groups")
    .select("*")
    .eq("company_id", companyId);
  if (error) return [];
  return data;
}

export async function getGroupMembers(groupId: string, companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  await assertGroupInCompany(supabase, groupId, companyId);
  const { data, error } = await supabase
    .from("classroom_group_members")
    .select("profile_id")
    .eq("group_id", groupId);
    
  if (error || !data || data.length === 0) return [];
  
  const profileIds = (data as any[]).map(d => d.profile_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .in("id", profileIds);
    
  return profiles || [];
}

export async function createClassroomGroup(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  
  const { supabase } = await requireInstructor(companyId);
  const { error } = await supabase
    .from("classroom_groups")
    .insert({ company_id: companyId, name, description } as any);
    
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function addGroupMember(groupId: string, profileId: string, companyId: string, companySlug: string) {
  const { supabase } = await requireInstructor(companyId);
  await assertGroupInCompany(supabase, groupId, companyId);
  await assertStudentInCompany(supabase, profileId, companyId);
  const { error } = await supabase
    .from("classroom_group_members")
    .insert({ group_id: groupId, profile_id: profileId } as any);
    
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function removeGroupMember(groupId: string, profileId: string, companyId: string, companySlug: string) {
  const { supabase } = await requireInstructor(companyId);
  await assertGroupInCompany(supabase, groupId, companyId);
  const { error } = await supabase
    .from("classroom_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
    
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function getCompanyStudents(companyId: string) {
  const { supabase } = await requireTenantTeacher(companyId);
  
  // 1. Get explicit company members
  const { data: members } = await supabase
    .from("company_members")
    .select("profile_id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .eq("role", "learner");

  // 2. Get students with active enrollments in this company's courses
  const { data: enrolledStudents } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");

  const memberIds = (members ?? []).map((m) => m.profile_id);
  const enrolledIds = (enrolledStudents ?? []).map((e) => e.user_id);
  
  const allStudentIds = Array.from(new Set([...memberIds, ...enrolledIds]));

  if (!allStudentIds.length) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .in("id", allStudentIds);
  
  if (error) return [];
  return data;
}

export async function postClassSchedule(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const { userId, supabase } = await requireInstructor(companyId);

  const title = formData.get("title") as string;
  const isRecurring = formData.get("isRecurring") === "true";
  const groupId = formData.get("groupId") as string || null;
  if (groupId && groupId !== "all") await assertGroupInCompany(supabase, groupId, companyId);
  
  const rawScheduleType = String(formData.get("type") || "live_session");
  const scheduleType: ClassScheduleInsert["schedule_type"] =
    rawScheduleType === "workshop" || rawScheduleType === "assignment_due" || rawScheduleType === "other"
      ? rawScheduleType
      : "live_session";
  const now = new Date().toISOString();
  const insertData: ClassScheduleInsert = {
    company_id: companyId,
    title,
    instructor_id: userId,
    schedule_type: scheduleType,
    topics_covered: formData.get("topics") as string || null,
    is_recurring: isRecurring,
    group_id: groupId === "all" ? null : groupId,
    starts_at: now,
    ends_at: now,
  };

  if (isRecurring) {
    insertData.day_of_week = parseInt(formData.get("dayOfWeek") as string);
    insertData.start_time_only = formData.get("startTime") as string;
    insertData.end_time_only = formData.get("endTime") as string;
  } else {
    insertData.starts_at = formData.get("startsAt") as string;
    insertData.ends_at = formData.get("endsAt") as string;
  }

  const { error } = await supabase.from("class_schedules").insert(insertData);

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

// Attendance
export async function markAttendance(companyId: string, scheduleId: string, profileId: string, status: "present" | "absent" | "late", companySlug: string) {
  const { supabase } = await requireInstructor(companyId);
  await assertScheduleInCompany(supabase, scheduleId, companyId);
  await assertStudentInCompany(supabase, profileId, companyId);
  const { error } = await supabase
    .from("student_attendance")
    .upsert(
      { company_id: companyId, schedule_id: scheduleId, profile_id: profileId, status, date: new Date().toISOString().split("T")[0] } as any,
      { onConflict: "schedule_id, profile_id, date" }
    );

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function getSessionAttendance(companyId: string, scheduleId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const date = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("student_attendance")
    .select("profile_id, status")
    .eq("company_id", companyId)
    .eq("schedule_id", scheduleId)
    .eq("date", date);

  if (error) return [];
  return data;
}

export async function deleteClassSchedule(scheduleId: string, companySlug: string) {
  const { supabase } = await requireInstructorForSchedule(scheduleId);
  const { error } = await supabase.from("class_schedules").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function duplicateClassSchedule(scheduleId: string, companySlug: string) {
  const { supabase } = await requireInstructorForSchedule(scheduleId);
  const { data: schedule, error: fetchError } = await supabase.from("class_schedules").select("*").eq("id", scheduleId).single();
  if (fetchError || !schedule) throw new Error("Schedule not found");

  const { id, created_at, ...copyData } = schedule;
  copyData.title = `${copyData.title} (Copy)`;
  const { error } = await supabase.from("class_schedules").insert(copyData);
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function markAutoAttendance(companyId: string, sessionId: string, _scheduleId: string | null) {
  // Learner level access is enough to mark self as present, but only for the
  // session that is actually live in this company. The schedule comes from the
  // server-side state, not from the client.
  const { supabase, userId } = await requireTenantMember(companyId);
  if (!userId) return;

  const { data: company } = await supabase
    .from("companies")
    .select("is_session_active, active_session_id, active_schedule_id")
    .eq("id", companyId)
    .single();
  const state = company as { is_session_active: boolean; active_session_id: string | null; active_schedule_id: string | null } | null;
  if (!state?.is_session_active || !state.active_session_id || state.active_session_id !== sessionId) return;

  const scheduleId = state.active_schedule_id;
  const date = new Date().toISOString().split("T")[0];
  const row = {
    company_id: companyId,
    schedule_id: scheduleId,
    profile_id: userId,
    session_id: sessionId,
    status: "present",
    date,
  };

  if (scheduleId) {
    await supabase
      .from("student_attendance")
      .upsert(row as any, { onConflict: "schedule_id, profile_id, date" });
    return;
  }

  // Unscheduled sessions have a NULL schedule_id, which never conflicts in the
  // unique index — check for an existing row to avoid duplicates on rejoin.
  const { data: existing } = await supabase
    .from("student_attendance")
    .select("id")
    .eq("session_id", sessionId)
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();
  if (!existing) await supabase.from("student_attendance").insert(row as any);
}

export async function getSessionHistory(companyId: string) {
  const { supabase } = await requireInstructor(companyId);
  
  // Fetch sessions
  const { data: sessions, error } = await (supabase
    .from("classroom_sessions") as any)
    .select(`
      *,
      class_schedules ( title )
    `)
    .eq("company_id", companyId)
    .order("started_at", { ascending: false });

  if (error || !sessions) return [];

  // Fetch attendance counts
  const sessionIds = (sessions as any[]).map((s: any) => s.id);
  
  if (sessionIds.length > 0) {
    const { data: attendanceData } = await supabase
      .from("student_attendance")
      .select("session_id, profile_id, status")
      .in("session_id", sessionIds);
      
    if (attendanceData) {
      return sessions.map((session: any) => {
        const records = (attendanceData as any[]).filter(a => a.session_id === session.id);
        const presentCount = records.filter((a: any) => a.status === "present").length;
        
        return {
          ...session,
          title: session.class_schedules?.title || "Ad-hoc Session",
          attendance_count: presentCount,
          attendance_records: records
        };
      });
    }
  }

  return sessions.map((s: any) => ({
    ...s,
    title: s.class_schedules?.title || "Ad-hoc Session",
    attendance_count: 0,
    attendance_records: []
  }));
}

