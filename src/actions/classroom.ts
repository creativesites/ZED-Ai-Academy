"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";
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
  const { supabase, userId } = await requireInstructor(companyId);

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
      .eq("company_id", companyId)
      .maybeSingle();
    if (!record || record.ended_at) return;
    const endedAt = new Date();
    const durationSeconds = record.started_at
      ? Math.max(0, Math.round((endedAt.getTime() - new Date(record.started_at).getTime()) / 1000))
      : null;
    await (supabase.from("classroom_sessions") as any)
      .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
      .eq("id", state.active_session_id)
      .eq("company_id", companyId);
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

  // Notify active academy members that live class has started
  try {
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    const { data: members } = await supabase
      .from("company_members")
      .select("profile_id")
      .eq("company_id", companyId)
      .eq("status", "active");

    const studentIds = (members ?? [])
      .map((m: any) => m.profile_id)
      .filter((pid: string) => pid && pid !== userId);

    if (studentIds.length > 0) {
      const companyName = company?.name || "Your Academy";
      const notifications = studentIds.map((pid: string) => ({
        user_id: pid,
        type: "live_session",
        title: `🔴 Live Class is in Session!`,
        body: `Instructor has started the live classroom session for ${companyName}. Tap to join now!`,
        data: {
          company_id: companyId,
          company_slug: companySlug,
          schedule_id: scheduleId,
          url: `/academy/${companySlug}/classroom?tab=session`,
        },
      }));
      await supabase.from("notifications").insert(notifications as any);
    }
  } catch (notifErr) {
    console.error("Failed to dispatch live session notifications:", notifErr);
  }

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

  const { data: newSchedule, error } = await supabase
    .from("class_schedules")
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Notify students of newly scheduled class
  try {
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    let studentIds: string[] = [];

    if (groupId && groupId !== "all") {
      const { data: groupMembers } = await supabase
        .from("classroom_group_members")
        .select("profile_id")
        .eq("group_id", groupId);
      studentIds = (groupMembers ?? []).map((m: any) => m.profile_id).filter((pid: string) => pid && pid !== userId);
    } else {
      const { data: members } = await supabase
        .from("company_members")
        .select("profile_id")
        .eq("company_id", companyId)
        .eq("status", "active");
      studentIds = (members ?? [])
        .map((m: any) => m.profile_id)
        .filter((pid: string) => pid && pid !== userId);
    }

    if (studentIds.length > 0) {
      const timeDesc = isRecurring
        ? `Every ${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][(insertData.day_of_week || 1) - 1]} at ${insertData.start_time_only}`
        : `on ${new Date(insertData.starts_at).toLocaleString()}`;

      const notifications = studentIds.map((pid: string) => ({
        user_id: pid,
        type: "class_schedule",
        title: `📅 New Live Class: ${title}`,
        body: `Scheduled ${timeDesc} for ${company?.name || "your academy"}. View your timetable.`,
        data: {
          schedule_id: newSchedule?.id,
          company_id: companyId,
          company_slug: companySlug,
          url: `/academy/${companySlug}/classroom?tab=timetable`,
        },
      }));
      await supabase.from("notifications").insert(notifications as any);
    }
  } catch (notifErr) {
    console.error("Failed to notify students of new schedule:", notifErr);
  }

  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  return newSchedule;
}

export async function sendScheduleReminder(companyId: string, scheduleId: string, companySlug: string) {
  const { userId, supabase } = await requireInstructor(companyId);

  const { data: rawSchedule } = await supabase
    .from("class_schedules")
    .select("*, companies(name)")
    .eq("id", scheduleId)
    .eq("company_id", companyId)
    .maybeSingle();

  const schedule = rawSchedule as any;
  if (!schedule) throw new Error("Schedule not found");

  let studentIds: string[] = [];

  if (schedule.group_id) {
    const { data: groupMembers } = await supabase
      .from("classroom_group_members")
      .select("profile_id")
      .eq("group_id", schedule.group_id);
    studentIds = (groupMembers ?? []).map((m: any) => m.profile_id).filter((pid: string) => pid && pid !== userId);
  } else {
    const { data: members } = await supabase
      .from("company_members")
      .select("profile_id")
      .eq("company_id", companyId)
      .eq("status", "active");
    studentIds = (members ?? [])
      .map((m: any) => m.profile_id)
      .filter((pid: string) => pid && pid !== userId);
  }

  if (studentIds.length === 0) {
    return { count: 0, message: "No active students to notify." };
  }

  const companyName = (schedule as any).companies?.name || "your academy";
  const timeDesc = schedule.start_time_only ? `at ${schedule.start_time_only}` : "starting soon";

  const notifications = studentIds.map((pid: string) => ({
    user_id: pid,
    type: "live_session_reminder",
    title: `⏰ Reminder: ${schedule.title} Starts Soon`,
    body: `Your live class with ${companyName} is scheduled ${timeDesc}. Tap to enter the classroom.`,
    data: {
      schedule_id: scheduleId,
      company_id: companyId,
      company_slug: companySlug,
      url: `/academy/${companySlug}/classroom?tab=session`,
    },
  }));

  const { error } = await supabase.from("notifications").insert(notifications as any);
  if (error) throw new Error(error.message);

  return { count: studentIds.length, message: `Reminder sent to ${studentIds.length} student(s)!` };
}

export async function getUpcomingUserClasses(): Promise<any[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = createClient();
  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, companies(id, name, slug, logo_url, is_session_active, active_room_name)")
    .eq("profile_id", userId)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) return [];

  const companyIds = memberships.map((m: any) => m.company_id);

  const { data: schedules } = await supabase
    .from("class_schedules")
    .select("*, companies(id, name, slug, is_session_active, active_room_name)")
    .in("company_id", companyIds)
    .order("day_of_week", { ascending: true })
    .order("start_time_only", { ascending: true });

  return schedules ?? [];
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

export async function deleteClassSchedule(companyId: string, scheduleId: string, companySlug: string) {
  const { supabase } = await requireInstructor(companyId);
  const { data, error } = await supabase
    .from("class_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("company_id", companyId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Schedule not found.");
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function duplicateClassSchedule(companyId: string, scheduleId: string, companySlug: string) {
  const { supabase } = await requireInstructor(companyId);
  const { data: schedule, error: fetchError } = await supabase
    .from("class_schedules")
    .select("*")
    .eq("id", scheduleId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (fetchError || !schedule) throw new Error("Schedule not found");

  const { id: _id, created_at: _createdAt, ...copyData } = schedule;
  copyData.title = `${copyData.title} (Copy)`;
  copyData.company_id = companyId;
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
      .upsert(row as never, { onConflict: "schedule_id, profile_id, date" });
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
  if (!existing) await supabase.from("student_attendance").insert(row as never);
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

export type GradebookQuizAttempt = {
  id: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  passed: boolean;
  created_at: string;
};

export type GradebookCertificate = {
  id: string;
  course_id: string;
  course_title: string;
  issued_at: string;
  public_id: string;
  file_url: string | null;
};

export type StudentGradebookRecord = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  enrolledCourseTitles: string[];
  totalLessons: number;
  completedLessons: number;
  completionPercent: number;
  quizAttempts: GradebookQuizAttempt[];
  avgQuizScore: number;
  passedQuizzesCount: number;
  certificates: GradebookCertificate[];
  status: "active" | "completed" | "inactive";
  lastActive: string | null;
};

export type AcademyGradebookData = {
  courses: { id: string; title: string; slug: string; thumbnail_url: string | null }[];
  students: StudentGradebookRecord[];
  metrics: {
    totalStudents: number;
    avgCompletionRate: number;
    avgQuizScore: number;
    certificatesIssued: number;
  };
};

/**
 * Returns comprehensive gradebook data for an academy:
 * Enrolled students, their lesson completion rates, quiz scores, and certificates.
 */
export async function getAcademyGradebook(companyId: string): Promise<AcademyGradebookData> {
  const { supabase } = await requireTenantTeacher(companyId);

  // 1. Fetch courses belonging to this academy
  const { data: coursesData } = await supabase
    .from("courses")
    .select("id, title, slug, thumbnail_url")
    .eq("company_id", companyId);

  const courses = coursesData ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));

  // Empty state if no courses exist in this academy yet
  if (courseIds.length === 0) {
    return {
      courses: [],
      students: [],
      metrics: { totalStudents: 0, avgCompletionRate: 0, avgQuizScore: 0, certificatesIssued: 0 },
    };
  }

  // 2. Fetch modules and lessons to compute curriculum totals
  const { data: modulesData } = await supabase
    .from("modules")
    .select("id, course_id")
    .in("course_id", courseIds);

  const modules = modulesData ?? [];
  const moduleIds = modules.map((m) => m.id);
  const moduleToCourse = new Map(modules.map((m) => [m.id, m.course_id]));

  let lessons: { id: string; module_id: string; title: string }[] = [];
  if (moduleIds.length > 0) {
    const { data: lessonsData } = await supabase
      .from("lessons")
      .select("id, module_id, title")
      .in("module_id", moduleIds);
    lessons = lessonsData ?? [];
  }

  const lessonIds = lessons.map((l) => l.id);
  const lessonToCourse = new Map(lessons.map((l) => [l.id, moduleToCourse.get(l.module_id)]));
  const totalAcademyLessons = lessonIds.length;

  // 3. Fetch quizzes for these lessons
  let quizzes: { id: string; lesson_id: string; title: string | null; pass_threshold: number }[] = [];
  if (lessonIds.length > 0) {
    const { data: quizzesData } = await supabase
      .from("quizzes")
      .select("id, lesson_id, title, pass_threshold")
      .in("lesson_id", lessonIds);
    quizzes = quizzesData ?? [];
  }

  const quizIds = quizzes.map((q) => q.id);
  const quizTitleMap = new Map(quizzes.map((q) => [q.id, q.title || "Lesson Quiz"]));

  // 4. Fetch students (learners in company_members or with active enrollments in this company)
  const [{ data: memberRows }, { data: enrollmentRows }] = await Promise.all([
    supabase
      .from("company_members")
      .select("profile_id, joined_at")
      .eq("company_id", companyId)
      .eq("status", "active")
      .eq("role", "learner"),
    supabase
      .from("enrollments")
      .select("id, user_id, course_id, enrolled_at, completed_at, status")
      .eq("company_id", companyId),
  ]);

  const studentIdSet = new Set<string>();
  const studentEnrollmentMap = new Map<string, string[]>(); // userId -> courseIds[]

  for (const row of memberRows ?? []) {
    studentIdSet.add(row.profile_id);
  }

  for (const row of enrollmentRows ?? []) {
    studentIdSet.add(row.user_id);
    const existing = studentEnrollmentMap.get(row.user_id) || [];
    if (!existing.includes(row.course_id)) {
      existing.push(row.course_id);
      studentEnrollmentMap.set(row.user_id, existing);
    }
  }

  const studentIds = Array.from(studentIdSet);

  if (studentIds.length === 0) {
    return {
      courses,
      students: [],
      metrics: { totalStudents: 0, avgCompletionRate: 0, avgQuizScore: 0, certificatesIssued: 0 },
    };
  }

  // 5. Fetch profiles, lesson_progress, quiz_attempts, and certificates
  const [
    { data: profilesData },
    { data: progressData },
    { data: attemptsData },
    { data: certsData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .in("id", studentIds),
    lessonIds.length > 0
      ? supabase
          .from("lesson_progress")
          .select("user_id, lesson_id, completed, completed_at")
          .in("user_id", studentIds)
          .in("lesson_id", lessonIds)
          .eq("completed", true)
      : Promise.resolve({ data: [] }),
    quizIds.length > 0
      ? supabase
          .from("quiz_attempts")
          .select("id, quiz_id, user_id, score, passed, created_at")
          .in("user_id", studentIds)
          .in("quiz_id", quizIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("certificates")
      .select("id, user_id, course_id, issued_at, public_id, file_url")
      .in("user_id", studentIds)
      .in("course_id", courseIds),
  ]);

  const profiles = profilesData ?? [];
  const progressRows = progressData ?? [];
  const attemptRows = attemptsData ?? [];
  const certRows = certsData ?? [];

  // Group progress by user
  const progressByUser = new Map<string, Set<string>>();
  for (const p of progressRows) {
    if (!p.completed) continue;
    const userSet = progressByUser.get(p.user_id) || new Set<string>();
    userSet.add(p.lesson_id);
    progressByUser.set(p.user_id, userSet);
  }

  // Group quiz attempts by user
  const attemptsByUser = new Map<string, GradebookQuizAttempt[]>();
  for (const a of attemptRows) {
    const list = attemptsByUser.get(a.user_id) || [];
    list.push({
      id: a.id,
      quiz_id: a.quiz_id,
      quiz_title: quizTitleMap.get(a.quiz_id) || "Quiz",
      score: a.score ?? 0,
      passed: !!a.passed,
      created_at: a.created_at,
    });
    attemptsByUser.set(a.user_id, list);
  }

  // Group certificates by user
  const certsByUser = new Map<string, GradebookCertificate[]>();
  for (const c of certRows) {
    const list = certsByUser.get(c.user_id) || [];
    list.push({
      id: c.id,
      course_id: c.course_id,
      course_title: courseTitleMap.get(c.course_id) || "Course",
      issued_at: c.issued_at,
      public_id: c.public_id,
      file_url: c.file_url,
    });
    certsByUser.set(c.user_id, list);
  }

  // Build student records
  let totalCompletionPercentages = 0;
  let totalQuizScores = 0;
  let totalQuizAttemptsCount = 0;

  const students: StudentGradebookRecord[] = profiles.map((p) => {
    const userCompletedLessons = progressByUser.get(p.id)?.size || 0;
    const userAttempts = attemptsByUser.get(p.id) || [];
    const userCerts = certsByUser.get(p.id) || [];
    const enrolledCourseIds = studentEnrollmentMap.get(p.id) || [];

    // Calculate lessons denominator: either specific enrolled courses or all academy lessons
    let userTotalLessons = 0;
    if (enrolledCourseIds.length > 0) {
      for (const l of lessons) {
        const cId = lessonToCourse.get(l.id);
        if (cId && enrolledCourseIds.includes(cId)) {
          userTotalLessons++;
        }
      }
    }
    if (userTotalLessons === 0) {
      userTotalLessons = totalAcademyLessons || 1;
    }

    const completionPercent = Math.min(
      100,
      Math.round((userCompletedLessons / Math.max(1, userTotalLessons)) * 100)
    );
    totalCompletionPercentages += completionPercent;

    let avgQuizScore = 0;
    if (userAttempts.length > 0) {
      const sum = userAttempts.reduce((acc, curr) => acc + curr.score, 0);
      avgQuizScore = Math.round(sum / userAttempts.length);
      totalQuizScores += sum;
      totalQuizAttemptsCount += userAttempts.length;
    }

    const passedQuizzesCount = userAttempts.filter((a) => a.passed).length;

    const enrolledCourseTitles = enrolledCourseIds
      .map((cId) => courseTitleMap.get(cId))
      .filter((title): title is string => !!title);

    // If no explicit enrollments, indicate General Academy Student
    if (enrolledCourseTitles.length === 0 && courses.length > 0) {
      enrolledCourseTitles.push(courses[0].title);
    }

    const lastAttemptDate = userAttempts[0]?.created_at;
    const lastCertDate = userCerts[0]?.issued_at;
    const dates = [lastAttemptDate, lastCertDate].filter(Boolean) as string[];
    const lastActive = dates.length > 0 ? dates.sort().reverse()[0] : null;

    let status: "active" | "completed" | "inactive" = "active";
    if (completionPercent >= 100 || userCerts.length > 0) {
      status = "completed";
    } else if (completionPercent === 0 && userAttempts.length === 0) {
      status = "inactive";
    }

    return {
      id: p.id,
      full_name: p.full_name || "Enrolled Student",
      avatar_url: p.avatar_url,
      email: p.email || "",
      enrolledCourseTitles,
      totalLessons: userTotalLessons,
      completedLessons: userCompletedLessons,
      completionPercent,
      quizAttempts: userAttempts,
      avgQuizScore,
      passedQuizzesCount,
      certificates: userCerts,
      status,
      lastActive,
    };
  });

  const avgCompletionRate = students.length > 0 ? Math.round(totalCompletionPercentages / students.length) : 0;
  const avgQuizScore = totalQuizAttemptsCount > 0 ? Math.round(totalQuizScores / totalQuizAttemptsCount) : 0;

  return {
    courses,
    students,
    metrics: {
      totalStudents: students.length,
      avgCompletionRate,
      avgQuizScore,
      certificatesIssued: certRows.length,
    },
  };
}

