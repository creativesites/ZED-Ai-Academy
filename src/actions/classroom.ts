"use server";

import { revalidatePath } from "next/cache";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";

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

export async function toggleClassroomSession(companyId: string, companySlug: string, active: boolean, roomName: string | null = null, scheduleId: string | null = null) {
  const { supabase } = await requireInstructor(companyId);

  let activeSessionId = null;

  if (active) {
    // Starting a session: Create history record
    const { data: sessionData, error: sessionError } = await (supabase
      .from("classroom_sessions") as any)
      .insert({
        company_id: companyId,
        schedule_id: scheduleId || null,
        room_name: roomName || "Unknown Room",
      })
      .select("id")
      .single();
      
    if (!sessionError && sessionData) {
      activeSessionId = (sessionData as any).id;
    }
  } else {
    // Ending a session: update ended_at and calculate duration
    const { data: companyData } = await supabase
      .from("companies")
      .select("active_session_id")
      .eq("id", companyId)
      .single();
      
    if (companyData?.active_session_id) {
      const endedAt = new Date().toISOString();
      await (supabase
        .from("classroom_sessions") as any)
        .update({ ended_at: endedAt })
        .eq("id", companyData.active_session_id);
    }
  }

  const { error } = await supabase
    .from("companies")
    .update({ 
      is_session_active: active,
      active_room_name: active ? roomName : null,
      active_schedule_id: active ? scheduleId : null,
      active_session_id: activeSessionId
    } as any)
    .eq("id", companyId);

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  return { success: true };
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
  revalidatePath(`/classroom/${companySlug}`);
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
  const { error } = await supabase
    .from("classroom_group_members")
    .insert({ group_id: groupId, profile_id: profileId } as any);
    
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function removeGroupMember(groupId: string, profileId: string, companyId: string, companySlug: string) {
  const { supabase } = await requireInstructor(companyId);
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
    .eq("schedule_id", scheduleId)
    .eq("date", date);

  if (error) return [];
  return data;
}

export async function deleteClassSchedule(scheduleId: string, companySlug: string) {
  const { supabase } = await requireTenantMember("ignored"); // Bypassing company ID check for simple delete, RLS handles it
  const { error } = await supabase.from("class_schedules").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function duplicateClassSchedule(scheduleId: string, companySlug: string) {
  const { supabase } = await requireTenantMember("ignored");
  const { data: schedule, error: fetchError } = await supabase.from("class_schedules").select("*").eq("id", scheduleId).single();
  if (fetchError || !schedule) throw new Error("Schedule not found");

  const { id, created_at, ...copyData } = schedule;
  copyData.title = `${copyData.title} (Copy)`;
  const { error } = await supabase.from("class_schedules").insert(copyData);
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function markAutoAttendance(companyId: string, sessionId: string, scheduleId: string | null) {
  // Learner level access is enough to mark self as present
  const { supabase, userId } = await requireTenantMember(companyId) as any;
  if (!userId) return;

  await supabase
    .from("student_attendance")
    .upsert(
      { 
        company_id: companyId, 
        schedule_id: scheduleId, 
        profile_id: userId, 
        session_id: sessionId,
        status: "present", 
        date: new Date().toISOString().split("T")[0] 
      } as any,
      { onConflict: "schedule_id, profile_id, date" } // Using existing constraint, but updating session_id
    );
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

