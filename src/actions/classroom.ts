"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";
import {
  resolveTimezone, validateSchedule, findConflicts, nextOccurrence, dayName, tzLabel, todayInTz,
  normalizeTime, type ScheduleLike, type TimetableRow,
} from "@/lib/schedule";

type ClassScheduleInsert = {
  company_id: string;
  title: string;
  instructor_id: string;
  schedule_type: "live_session" | "workshop" | "assignment_due" | "other";
  topics_covered: string | null;
  is_recurring: boolean;
  group_id: string | null;
  day_of_week: number | null;
  start_time_only: string | null;
  end_time_only: string | null;
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
  const { supabase, userId } = await requireInstructor(companyId);

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

/* ------------------------------------------------------------------ */
/* Timetable helpers                                                   */
/* ------------------------------------------------------------------ */

async function getAcademyTimezone(supabase: ReturnType<typeof createClient>, companyId: string) {
  // If the timezone column has not been migrated yet the select errors and we fall back to the default.
  const { data } = await supabase.from("companies").select("timezone").eq("id", companyId).maybeSingle();
  return resolveTimezone((data as { timezone?: string | null } | null)?.timezone);
}

/** "every Monday at 09:00 CAT" / "Mon, 9 Nov, 09:00 CAT" - used in notifications. */
function describeWhen(s: ScheduleLike, tz: string, now: Date = new Date()): string {
  if (s.is_recurring) {
    return `every ${dayName(s.day_of_week)} at ${normalizeTime(s.start_time_only)} ${tzLabel(tz, now)}`;
  }
  const start = s.starts_at ? new Date(s.starts_at) : null;
  if (!start) return "soon";
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(start);
  return `${when} ${tzLabel(tz, start)}`;
}

/** Notify everyone a class is for: the chosen group, or every active member when it is for the whole academy. */
async function notifyAudience(
  supabase: ReturnType<typeof createClient>,
  a: { companyId: string; companySlug: string; groupId: string | null; excludeUserId: string; type: string; title: string; body: string; scheduleId?: string; tab: string }
) {
  let ids: string[] = [];
  if (a.groupId) {
    const { data } = await supabase.from("classroom_group_members").select("profile_id").eq("group_id", a.groupId);
    ids = (data ?? []).map((m: any) => m.profile_id);
  } else {
    const { data } = await supabase.from("company_members").select("profile_id").eq("company_id", a.companyId).eq("status", "active");
    ids = (data ?? []).map((m: any) => m.profile_id);
  }
  ids = [...new Set(ids.filter((id) => id && id !== a.excludeUserId))];
  if (ids.length === 0) return 0;

  const rows = ids.map((uid) => ({
    user_id: uid,
    type: a.type,
    title: a.title,
    body: a.body,
    data: { schedule_id: a.scheduleId, company_id: a.companyId, company_slug: a.companySlug, url: `/academy/${a.companySlug}/classroom?tab=${a.tab}` },
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("notifications").insert(rows.slice(i, i + 500) as any);
    if (error) throw new Error(error.message);
  }
  return ids.length;
}

export type ScheduleConflict = { id: string; title: string; when: string };
export type SaveScheduleResult =
  | { ok: true; schedule: any }
  | { ok: false; errors: string[]; conflicts?: ScheduleConflict[] };

function readScheduleForm(formData: FormData) {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  const rawType = str("type") || "live_session";
  const scheduleType: ClassScheduleInsert["schedule_type"] =
    rawType === "workshop" || rawType === "assignment_due" || rawType === "other" ? rawType : "live_session";
  const rawGroup = str("groupId");
  return {
    input: {
      title: str("title"),
      isRecurring: str("isRecurring") === "true",
      dayOfWeek: str("dayOfWeek"),
      startTime: str("startTime"),
      endTime: str("endTime"),
      startsAt: str("startsAt"),
      endsAt: str("endsAt"),
    },
    scheduleType,
    topics: str("topics").trim().slice(0, 2000) || null,
    groupId: rawGroup && rawGroup !== "all" ? rawGroup : null,
    allowConflict: str("allowConflict") === "true",
  };
}

async function saveSchedule(args: {
  mode: "create" | "update";
  companyId: string;
  companySlug: string;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  formData: FormData;
  existing?: any; // the row being edited
}): Promise<SaveScheduleResult> {
  const { mode, companyId, companySlug, userId, supabase, formData, existing } = args;
  const tz = await getAcademyTimezone(supabase, companyId);
  const form = readScheduleForm(formData);

  const validated = validateSchedule(form.input, tz);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  // The group must belong to this academy (the service role would otherwise accept any group id).
  if (form.groupId) {
    const { data: group } = await supabase.from("classroom_groups").select("id").eq("id", form.groupId).eq("company_id", companyId).maybeSingle();
    if (!group) return { ok: false, errors: ["That class group doesn't exist in this academy."] };
  }

  const instructorId = existing?.instructor_id ?? userId;
  const candidate: ScheduleLike = { id: existing?.id, ...validated.timing, instructor_id: instructorId, group_id: form.groupId };

  const { data: others } = await supabase.from("class_schedules").select("*").eq("company_id", companyId);
  const clashes = findConflicts(candidate, (others ?? []) as ScheduleLike[], tz) as any[];
  if (clashes.length > 0 && !form.allowConflict) {
    return {
      ok: false,
      errors: [],
      conflicts: clashes.map((c) => ({ id: c.id, title: c.title, when: describeWhen(c, tz) })),
    };
  }

  // company_id is deliberately not part of the editable fields: an edit can never move a class to another academy.
  const fields = {
    title: validated.title,
    instructor_id: instructorId,
    schedule_type: form.scheduleType,
    topics_covered: form.topics,
    group_id: form.groupId,
    ...validated.timing,
  };

  const query =
    mode === "create"
      ? supabase.from("class_schedules").insert({ company_id: companyId, ...fields }).select().single()
      : supabase.from("class_schedules").update(fields).eq("id", existing.id).eq("company_id", companyId).select().single();
  const { data: saved, error } = await query;
  if (error) throw new Error(error.message);

  // Tell students (best effort - a notification failure must not undo the save).
  try {
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    const when = describeWhen(saved as ScheduleLike, tz);
    await notifyAudience(supabase, {
      companyId, companySlug, groupId: form.groupId, excludeUserId: userId, scheduleId: saved?.id, tab: "timetable",
      type: "class_schedule",
      title: mode === "create" ? `📅 New class: ${validated.title}` : `📅 Class updated: ${validated.title}`,
      body: `${mode === "create" ? "Scheduled" : "Now"} ${when} for ${company?.name || "your academy"}. View your timetable.`,
    });
  } catch (notifErr) {
    console.error("Failed to notify students of schedule change:", notifErr);
  }

  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  revalidatePath(`/academy/${companySlug}/classroom`);
  return { ok: true, schedule: saved };
}

export async function postClassSchedule(formData: FormData): Promise<SaveScheduleResult> {
  const companyId = String(formData.get("companyId") ?? "");
  const companySlug = String(formData.get("companySlug") ?? "");
  const { userId, supabase } = await requireInstructor(companyId);
  return saveSchedule({ mode: "create", companyId, companySlug, userId, supabase, formData });
}

export async function updateClassSchedule(scheduleId: string, formData: FormData): Promise<SaveScheduleResult> {
  const { schedule, userId, supabase } = await requireScheduleInstructor(scheduleId);
  const companySlug = String(formData.get("companySlug") ?? "");
  return saveSchedule({ mode: "update", companyId: schedule.company_id, companySlug, userId, supabase, formData, existing: schedule });
}

/** Load a schedule and require the caller to teach in the academy that owns it. */
async function requireScheduleInstructor(scheduleId: string) {
  const { data } = await createClient().from("class_schedules").select("*").eq("id", scheduleId).maybeSingle();
  if (!data) throw new Error("Class not found.");
  const ctx = await requireInstructor((data as any).company_id);
  return { ...ctx, schedule: data as any };
}

/** Timetable for the classroom: rows + the academy timezone + instructor names. */
export async function getTimetable(companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const [timezone, res] = await Promise.all([
    getAcademyTimezone(supabase, companyId),
    supabase.from("class_schedules").select("*").eq("company_id", companyId),
  ]);
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data ?? []) as any[];

  const instructorIds = [...new Set(rows.map((r) => r.instructor_id).filter(Boolean))] as string[];
  const names: Record<string, string> = {};
  if (instructorIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", instructorIds);
    for (const pr of (profiles ?? []) as any[]) if (pr.full_name) names[pr.id] = pr.full_name;
  }
  return { timezone, schedules: rows.map((r) => ({ ...r, instructor_name: names[r.instructor_id] ?? null })) as TimetableRow[] };
}

export async function sendScheduleReminder(companyId: string, scheduleId: string, companySlug: string) {
  const { userId, supabase } = await requireInstructor(companyId);

  const { data: schedule } = await supabase
    .from("class_schedules")
    .select("*, companies(name)")
    .eq("id", scheduleId)
    .eq("company_id", companyId) // an instructor may only remind their own academy's students
    .maybeSingle();
  if (!schedule) throw new Error("Class not found in this academy.");

  const tz = await getAcademyTimezone(supabase, companyId);
  const occ = nextOccurrence(schedule as ScheduleLike, tz);
  const when = occ ? describeWhen({ is_recurring: false, starts_at: occ.start.toISOString() }, tz) : "soon";
  const companyName = (schedule as any).companies?.name || "your academy";

  const count = await notifyAudience(supabase, {
    companyId, companySlug, groupId: (schedule as any).group_id ?? null, excludeUserId: userId, scheduleId, tab: "session",
    type: "live_session_reminder",
    title: `⏰ Reminder: ${(schedule as any).title}`,
    body: `Your live class with ${companyName} is on ${when}. Tap to enter the classroom.`,
  });
  if (count === 0) return { count: 0, message: "No active students to notify." };
  return { count, message: `Reminder sent to ${count} student(s)!` };
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

  // The class and the student must both belong to this academy.
  const [{ data: sched }, { data: member }] = await Promise.all([
    supabase.from("class_schedules").select("id").eq("id", scheduleId).eq("company_id", companyId).maybeSingle(),
    supabase.from("company_members").select("profile_id").eq("company_id", companyId).eq("profile_id", profileId).maybeSingle(),
  ]);
  if (!sched) throw new Error("Class not found in this academy.");
  if (!member) throw new Error("That student is not a member of this academy.");

  const tz = await getAcademyTimezone(supabase, companyId);
  const { error } = await supabase
    .from("student_attendance")
    .upsert(
      { company_id: companyId, schedule_id: scheduleId, profile_id: profileId, status, date: todayInTz(tz) } as any,
      { onConflict: "schedule_id, profile_id, date" }
    );

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function getSessionAttendance(companyId: string, scheduleId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const tz = await getAcademyTimezone(supabase, companyId);
  const { data, error } = await supabase
    .from("student_attendance")
    .select("profile_id, status")
    .eq("company_id", companyId)
    .eq("schedule_id", scheduleId)
    .eq("date", todayInTz(tz));

  if (error) return [];
  return data;
}

export async function deleteClassSchedule(scheduleId: string, companySlug: string) {
  // Previously this called requireTenantMember("ignored"), which only ever passed for platform
  // super-admins - so instructors could not delete their own classes. Authorize against the
  // academy that actually owns the class.
  const { schedule, supabase } = await requireScheduleInstructor(scheduleId);
  const { error } = await supabase.from("class_schedules").delete().eq("id", scheduleId).eq("company_id", schedule.company_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  revalidatePath(`/academy/${companySlug}/classroom`);
}

export async function duplicateClassSchedule(scheduleId: string, companySlug: string) {
  const { schedule, supabase } = await requireScheduleInstructor(scheduleId);
  const { id: _id, created_at: _createdAt, ...copy } = schedule;
  const { error } = await supabase.from("class_schedules").insert({ ...copy, title: `${copy.title} (Copy)` });
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  revalidatePath(`/academy/${companySlug}/classroom`);
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
        date: todayInTz(await getAcademyTimezone(supabase, companyId)),
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

