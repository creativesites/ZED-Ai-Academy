"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";
import {
  aggregateSpeakingMetricsByUser,
  emptyUserSpeakingMetrics,
  extractReportAverageScore,
  speakingMsToMinutes,
} from "@/lib/classroom/speaking-metrics";

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

// Session State (cleanly separated between Academy-wide and Cohort-specific concurrent sessions)
export async function getCompanySessionState(companyId: string, cohortId?: string | null) {
  const { supabase } = await requireTenantMember(companyId);

  const isCohortScoped = Boolean(cohortId && cohortId !== "all");
  if (isCohortScoped) {
    const { data: groupData, error } = await supabase
      .from("classroom_groups")
      .select("is_session_active, active_room_name, active_schedule_id, active_session_id")
      .eq("id", cohortId!)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !groupData) {
      return {
        is_session_active: false,
        active_room_name: null,
        active_schedule_id: null,
        active_session_id: null,
      };
    }

    return {
      is_session_active: Boolean((groupData as any).is_session_active),
      active_room_name: (groupData as any).active_room_name ?? null,
      active_schedule_id: (groupData as any).active_schedule_id ?? null,
      active_session_id: (groupData as any).active_session_id ?? null,
    };
  }

  const { data, error } = await supabase
    .from("companies")
    .select("is_session_active, active_room_name, active_schedule_id, active_session_id")
    .eq("id", companyId)
    .single();
  
  if (error || !data) {
    return {
      is_session_active: false,
      active_room_name: null,
      active_schedule_id: null,
      active_session_id: null,
    };
  }
  return data as any;
}

export async function toggleClassroomSession(
  companyId: string,
  companySlug: string,
  active: boolean,
  roomName: string | null = null,
  scheduleId: string | null = null,
  cohortId: string | null = null
) {
  const { supabase, userId } = await requireInstructor(companyId);
  const isCohortScoped = Boolean(cohortId && cohortId !== "all");

  let activeSessionId: string | null = null;

  if (active) {
    // Starting a session: Create history record linked to cohort if scoped
    const { data: sessionData, error: sessionError } = await (supabase
      .from("classroom_sessions") as any)
      .insert({
        company_id: companyId,
        cohort_id: isCohortScoped ? cohortId : null,
        schedule_id: scheduleId || null,
        room_name: roomName || "Unknown Room",
      })
      .select("id")
      .single();
      
    if (!sessionError && sessionData) {
      activeSessionId = (sessionData as any).id;
    }

    // Notify cohort or active academy members that live class has started
    try {
      const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
      let studentIds: string[] = [];

      if (isCohortScoped) {
        const { data: groupMembers } = await supabase
          .from("classroom_group_members")
          .select("profile_id")
          .eq("group_id", cohortId!);
        studentIds = (groupMembers ?? []).map((m: any) => m.profile_id).filter((pid: string) => pid && pid !== userId);
      } else {
        const { data: members } = await supabase
          .from("company_members")
          .select("profile_id")
          .eq("company_id", companyId)
          .eq("status", "active");
        studentIds = (members ?? []).map((m: any) => m.profile_id).filter((pid: string) => pid && pid !== userId);
      }

      if (studentIds.length > 0) {
        const companyName = company?.name || "Your Academy";
        const cohortQuery = isCohortScoped ? `&cohort=${cohortId}` : "";
        const notifications = studentIds.map((pid: string) => ({
          user_id: pid,
          type: "live_session",
          title: `🔴 Live Class is in Session!`,
          body: `Instructor has started the live classroom session for ${companyName}. Tap to join now!`,
          data: {
            company_id: companyId,
            company_slug: companySlug,
            cohort_id: isCohortScoped ? cohortId : null,
            schedule_id: scheduleId,
            url: `/academy/${companySlug}/classroom?tab=session${cohortQuery}`,
          },
        }));
        await supabase.from("notifications").insert(notifications as any);
      }
    } catch (notifErr) {
      console.error("Failed to dispatch live session notifications:", notifErr);
    }
  } else {
    // Ending a session: update ended_at on the matching scope's active session only
    let targetSessionId: string | null = null;
    if (isCohortScoped) {
      const { data: groupData } = await supabase
        .from("classroom_groups")
        .select("active_session_id")
        .eq("id", cohortId!)
        .eq("company_id", companyId)
        .maybeSingle();
      targetSessionId = (groupData as any)?.active_session_id ?? null;
    } else {
      const { data: companyData } = await supabase
        .from("companies")
        .select("active_session_id")
        .eq("id", companyId)
        .single();
      targetSessionId = (companyData as any)?.active_session_id ?? null;
    }
      
    if (targetSessionId) {
      const endedAt = new Date().toISOString();
      await (supabase
        .from("classroom_sessions") as any)
        .update({ ended_at: endedAt })
        .eq("id", targetSessionId)
        .eq("company_id", companyId);
    }
  }

  // Update ONLY the targeted scope so concurrent cohort sessions never clobber each other or academy-wide state
  if (isCohortScoped) {
    const { error } = await (supabase.from("classroom_groups") as any)
      .update({
        is_session_active: active,
        active_room_name: active ? roomName : null,
        active_schedule_id: active ? scheduleId : null,
        active_session_id: activeSessionId,
      })
      .eq("id", cohortId!)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);
  } else {
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
  }

  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true, activeSessionId, roomName: active ? roomName : null };
}

// Announcements & Notice Board with Priority & Push Notifications
export async function getAnnouncements(companyId: string, cohortId?: string | null) {
  const { supabase } = await requireTenantMember(companyId);
  let query = supabase
    .from("announcements")
    .select(`
      *,
      author:profiles!announcements_author_id_fkey(full_name, avatar_url)
    `)
    .eq("company_id", companyId);

  if (cohortId && cohortId !== "all") {
    query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
  }

  const { data, error } = await query
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback if join is not available
    const { data: fallbackData } = await supabase
      .from("announcements")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    return fallbackData ?? [];
  }
  return data ?? [];
}

export async function postAnnouncement(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const { userId, supabase } = await requireInstructor(companyId);

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const priority = (formData.get("priority") as string) || "notice";
  const cohortId = (formData.get("cohortId") as string) || null;
  const isPinned = formData.get("isPinned") === "true";

  if (!title || !content) throw new Error("Title and content are required");

  const { data: newNotice, error } = await supabase
    .from("announcements")
    .insert({
      company_id: companyId,
      author_id: userId,
      title,
      content,
      priority,
      cohort_id: cohortId && cohortId !== "all" ? cohortId : null,
      is_pinned: isPinned,
    } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Dispatch student notifications
  try {
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    let studentIds: string[] = [];

    if (cohortId && cohortId !== "all") {
      const { data: groupMembers } = await supabase
        .from("classroom_group_members")
        .select("profile_id")
        .eq("group_id", cohortId);
      studentIds = (groupMembers ?? []).map((m: any) => m.profile_id).filter((pid: string) => pid && pid !== userId);
    } else {
      const { data: members } = await supabase
        .from("company_members")
        .select("profile_id")
        .eq("company_id", companyId)
        .eq("status", "active");
      studentIds = (members ?? []).map((m: any) => m.profile_id).filter((pid: string) => pid && pid !== userId);
    }

    if (studentIds.length > 0) {
      const prefix =
        priority === "urgent"
          ? "🚨 URGENT Notice"
          : priority === "exam"
          ? "📝 Exam Notice"
          : priority === "event"
          ? "🎉 School Event"
          : "📢 New Announcement";

      const notifications = studentIds.map((pid: string) => ({
        user_id: pid,
        type: "announcement",
        title: `${prefix}: ${title}`,
        body: content.slice(0, 150) + (content.length > 150 ? "..." : ""),
        data: {
          announcement_id: newNotice?.id,
          priority,
          company_id: companyId,
          company_slug: companySlug,
          url: `/academy/${companySlug}/classroom?tab=noticeboard`,
        },
      }));

      await supabase.from("notifications").insert(notifications as any);
    }
  } catch (notifErr) {
    console.error("Failed to dispatch announcement notifications:", notifErr);
  }

  revalidatePath(`/academy/${companySlug}/classroom`);
  return newNotice;
}

export async function deleteAnnouncement(announcementId: string, companyId: string, companySlug: string) {
  const { supabase } = await requireInstructor(companyId);

  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true };
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

// Courses / Programs for Cohort assignment
export async function getCompanyCourses(companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, slug, description, published")
    .eq("company_id", companyId)
    .order("title", { ascending: true });

  if (error) return [];
  return data ?? [];
}

// Groups and Cohorts
export async function getClassroomGroups(companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const { data, error } = await supabase
    .from("classroom_groups")
    .select(`
      *,
      course:courses(id, title, slug),
      classroom_group_members(count)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    // Graceful fallback if joined columns differ
    const { data: fallbackData } = await supabase
      .from("classroom_groups")
      .select("*")
      .eq("company_id", companyId);
    return fallbackData ?? [];
  }

  const groups = data ?? [];
  const teacherIds = Array.from(
    new Set(groups.map((g: any) => g.primary_teacher_id).filter(Boolean))
  ) as string[];

  let teachersMap = new Map<string, any>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", teacherIds);
    teachersMap = new Map((teachers ?? []).map((t) => [t.id, t]));
  }

  return groups.map((g: any) => ({
    ...g,
    primary_teacher: g.primary_teacher_id ? teachersMap.get(g.primary_teacher_id) || null : null,
    students_count: g.classroom_group_members?.[0]?.count ?? 0,
  }));
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
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const courseId = (formData.get("courseId") as string) || null;
  const academicPeriod = (formData.get("academicPeriod") as string)?.trim() || null;
  const primaryTeacherId = (formData.get("primaryTeacherId") as string) || null;
  const color = (formData.get("color") as string) || "#fd5523";
  const status = (formData.get("status") as string) || "active";
  
  if (!name) throw new Error("Cohort name is required");

  const { supabase } = await requireInstructor(companyId);
  const { data, error } = await supabase
    .from("classroom_groups")
    .insert({
      company_id: companyId,
      name,
      description,
      course_id: courseId && courseId !== "all" ? courseId : null,
      academic_period: academicPeriod,
      primary_teacher_id: primaryTeacherId && primaryTeacherId !== "all" ? primaryTeacherId : null,
      color,
      status,
    } as any)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/classroom`);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  return data;
}

export async function updateClassroomGroup(groupId: string, formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const courseId = (formData.get("courseId") as string) || null;
  const academicPeriod = (formData.get("academicPeriod") as string)?.trim() || null;
  const primaryTeacherId = (formData.get("primaryTeacherId") as string) || null;
  const color = (formData.get("color") as string) || "#fd5523";
  const status = (formData.get("status") as string) || "active";

  if (!name) throw new Error("Cohort name is required");

  const { supabase } = await requireInstructor(companyId);
  const { error } = await supabase
    .from("classroom_groups")
    .update({
      name,
      description,
      course_id: courseId && courseId !== "all" ? courseId : null,
      academic_period: academicPeriod,
      primary_teacher_id: primaryTeacherId && primaryTeacherId !== "all" ? primaryTeacherId : null,
      color,
      status,
    } as any)
    .eq("id", groupId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/classroom`);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  return { success: true };
}

export async function deleteClassroomGroup(groupId: string, companyId: string, companySlug: string) {
  const { supabase } = await requireInstructor(companyId);
  const { error } = await supabase
    .from("classroom_groups")
    .delete()
    .eq("id", groupId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/classroom`);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
  return { success: true };
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
    .single();

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
  const [{ data: memberships }, { data: groupMemberships }] = await Promise.all([
    supabase
      .from("company_members")
      .select("company_id, role, companies(id, name, slug, logo_url, is_session_active, active_room_name)")
      .eq("profile_id", userId)
      .eq("status", "active"),
    supabase
      .from("classroom_group_members")
      .select("group_id")
      .eq("profile_id", userId),
  ]);

  if (!memberships || memberships.length === 0) return [];

  const companyIds = memberships.map((m: any) => m.company_id);
  const teachingCompanyIds = new Set(
    memberships
      .filter((m: any) => m.role === "company_admin" || m.role === "teacher" || m.role === "instructor")
      .map((m: any) => m.company_id)
  );
  const myGroupIds = new Set((groupMemberships ?? []).map((g: any) => g.group_id));

  const { data: schedules } = await supabase
    .from("class_schedules")
    .select("*, companies(id, name, slug, is_session_active, active_room_name)")
    .in("company_id", companyIds)
    .order("day_of_week", { ascending: true })
    .order("start_time_only", { ascending: true });

  // Filter schedules so learners only see academy-wide schedules or schedules for their cohorts
  return (schedules ?? []).filter((s: any) => {
    if (!s.group_id) return true;
    if (teachingCompanyIds.has(s.company_id)) return true;
    return myGroupIds.has(s.group_id);
  });
}

export interface ActiveLiveSessionBannerItem {
  companyId: string;
  companyName: string;
  companySlug: string;
  cohortId: string | null;
  cohortName: string | null;
  scheduleId: string | null;
  title: string;
}

/**
 * Returns active live sessions across all academies AND enrolled cohorts for the signed-in user.
 * Works for both scheduled and ad-hoc live sessions.
 */
export async function getActiveUserLiveSessions(): Promise<ActiveLiveSessionBannerItem[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = createClient();
  const [{ data: memberships }, { data: groupMemberships }] = await Promise.all([
    supabase
      .from("company_members")
      .select(
        "company_id, role, companies(id, name, slug, is_session_active, active_schedule_id)"
      )
      .eq("profile_id", userId)
      .eq("status", "active"),
    supabase
      .from("classroom_group_members")
      .select(
        "group_id, classroom_groups(id, name, company_id, is_session_active, active_schedule_id)"
      )
      .eq("profile_id", userId),
  ]);

  if (!memberships || memberships.length === 0) return [];

  const companyMap = new Map<string, { id: string; name: string; slug: string }>();
  const activeItems: ActiveLiveSessionBannerItem[] = [];

  for (const m of memberships as any[]) {
    const comp = Array.isArray(m.companies) ? m.companies[0] : m.companies;
    if (!comp) continue;
    companyMap.set(comp.id, { id: comp.id, name: comp.name, slug: comp.slug });

    if (comp.is_session_active) {
      activeItems.push({
        companyId: comp.id,
        companyName: comp.name,
        companySlug: comp.slug,
        cohortId: null,
        cohortName: null,
        scheduleId: comp.active_schedule_id ?? null,
        title: `${comp.name} Live Classroom`,
      });
    }
  }

  for (const gm of (groupMemberships ?? []) as any[]) {
    const grp = Array.isArray(gm.classroom_groups)
      ? gm.classroom_groups[0]
      : gm.classroom_groups;
    if (!grp || !grp.is_session_active) continue;
    const comp = companyMap.get(grp.company_id);
    if (!comp) continue;

    activeItems.push({
      companyId: comp.id,
      companyName: comp.name,
      companySlug: comp.slug,
      cohortId: grp.id,
      cohortName: grp.name,
      scheduleId: grp.active_schedule_id ?? null,
      title: `${grp.name} · Live Class`,
    });
  }

  return activeItems;
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
  const { createClient } = await import("@/lib/supabase/server");
  const tempSupabase = createClient();
  const { data: schedule } = await tempSupabase
    .from("class_schedules")
    .select("company_id")
    .eq("id", scheduleId)
    .single();

  if (!schedule) throw new Error("Schedule not found.");
  const { supabase } = await requireTenantTeacher(schedule.company_id);

  const { error } = await supabase.from("class_schedules").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/admin/classroom`);
}

export async function duplicateClassSchedule(scheduleId: string, companySlug: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const tempSupabase = createClient();
  const { data: schedule, error: fetchError } = await tempSupabase
    .from("class_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) throw new Error("Schedule not found");
  const { supabase } = await requireTenantTeacher(schedule.company_id);

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
      const profileIds = Array.from(
        new Set((attendanceData as any[]).map((a) => a.profile_id).filter(Boolean))
      );
      let profileMap: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {};

      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", profileIds);
        for (const p of (profilesData ?? []) as any[]) {
          profileMap[p.id] = {
            full_name: p.full_name,
            email: p.email,
            avatar_url: p.avatar_url,
          };
        }
      }

      return sessions.map((session: any) => {
        const records = (attendanceData as any[])
          .filter((a) => a.session_id === session.id)
          .map((a) => ({
            ...a,
            profile: profileMap[a.profile_id] ?? null,
          }));
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

export type GradebookAssignmentRecord = {
  id: string;
  assignment_id: string;
  assignment_title: string;
  max_points: number;
  grade: number | null;
  status: string;
  submitted_at: string;
  feedback: string | null;
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
  assignments?: GradebookAssignmentRecord[];
  avgAssignmentScore?: number;
  submittedAssignmentsCount?: number;
  speakingMinutes: number;
  scenariosCompleted: number;
  avgSpeakingScore: number | null;
  flaggedSessionsCount: number;
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
    avgAssignmentScore?: number;
    certificatesIssued: number;
    totalSpeakingMinutes: number;
    totalScenariosCompleted: number;
    avgSpeakingScore: number | null;
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
      metrics: {
        totalStudents: 0,
        avgCompletionRate: 0,
        avgQuizScore: 0,
        certificatesIssued: 0,
        totalSpeakingMinutes: 0,
        totalScenariosCompleted: 0,
        avgSpeakingScore: null,
      },
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
      metrics: {
        totalStudents: 0,
        avgCompletionRate: 0,
        avgQuizScore: 0,
        certificatesIssued: 0,
        totalSpeakingMinutes: 0,
        totalScenariosCompleted: 0,
        avgSpeakingScore: null,
      },
    };
  }

  // 5. Fetch profiles, lesson_progress, quiz_attempts, certificates, and assignment submissions
  const [
    { data: profilesData },
    { data: progressData },
    { data: attemptsData },
    { data: certsData },
    { data: assignmentSubmissionsData },
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
    supabase
      .from("classroom_assignment_submissions")
      .select(`
        id,
        assignment_id,
        student_id,
        grade,
        status,
        submitted_at,
        feedback,
        assignment:classroom_assignments(title, max_points)
      `)
      .in("student_id", studentIds)
      .eq("company_id", companyId),
  ]);

  const profiles = profilesData ?? [];
  const progressRows = progressData ?? [];
  const attemptRows = attemptsData ?? [];
  const certRows = certsData ?? [];
  const submissionRows = assignmentSubmissionsData ?? [];

  // 5b. Fetch AI speaking practice sessions & reports for enrolled students (resilient fallback)
  let speakingMetrics = aggregateSpeakingMetricsByUser([], []);
  try {
    const db = createServiceClient();
    const { data: tutorSessionsData } = await db
      .from("tutor_sessions")
      .select("id, user_id, learner_speaking_ms, status, started_at, scenario_id, shared_with_teacher")
      .eq("company_id", companyId)
      .neq("origin", "ask") // P1-06: lesson Ask conversations are not speaking practice
      .in("user_id", studentIds);

    const sessionRows = tutorSessionsData ?? [];
    let reportRows: { session_id: string; scores: unknown }[] = [];
    if (sessionRows.length > 0) {
      const { data: tutorReportsData } = await db
        .from("tutor_reports")
        .select("session_id, scores")
        .in(
          "session_id",
          sessionRows.map((s) => s.id),
        );
      reportRows = tutorReportsData ?? [];
    }

    speakingMetrics = aggregateSpeakingMetricsByUser(sessionRows, reportRows);
  } catch (speakingErr) {
    console.warn("Unable to aggregate tutor speaking metrics for gradebook:", speakingErr);
  }

  // Group assignment submissions by student
  const assignmentsByUser = new Map<string, GradebookAssignmentRecord[]>();
  for (const s of submissionRows as any[]) {
    const list = assignmentsByUser.get(s.student_id) || [];
    list.push({
      id: s.id,
      assignment_id: s.assignment_id,
      assignment_title: s.assignment?.title || "Assignment",
      max_points: s.assignment?.max_points || 100,
      grade: s.grade,
      status: s.status,
      submitted_at: s.submitted_at,
      feedback: s.feedback,
    });
    assignmentsByUser.set(s.student_id, list);
  }

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

    // Student assignments
    const userAssignments = assignmentsByUser.get(p.id) || [];
    const gradedAssignments = userAssignments.filter((a) => a.grade !== null && a.grade !== undefined);
    let avgAssignmentScore = 0;
    if (gradedAssignments.length > 0) {
      const sum = gradedAssignments.reduce((acc, curr) => acc + (curr.grade || 0), 0);
      avgAssignmentScore = Math.round(sum / gradedAssignments.length);
    }

    const enrolledCourseTitles = enrolledCourseIds
      .map((cId) => courseTitleMap.get(cId))
      .filter((title): title is string => !!title);

    // If no explicit enrollments, indicate General Academy Student
    if (enrolledCourseTitles.length === 0 && courses.length > 0) {
      enrolledCourseTitles.push(courses[0].title);
    }

    const lastAttemptDate = userAttempts[0]?.created_at;
    const lastCertDate = userCerts[0]?.issued_at;
    const lastSubDate = userAssignments[0]?.submitted_at;
    const userSpeaking = speakingMetrics.byUser.get(p.id) ?? emptyUserSpeakingMetrics();
    const dates = [
      lastAttemptDate,
      lastCertDate,
      lastSubDate,
      userSpeaking.lastSpeakingAt,
    ].filter(Boolean) as string[];
    const lastActive = dates.length > 0 ? dates.sort().reverse()[0] : null;

    let status: "active" | "completed" | "inactive" = "active";
    if (completionPercent >= 100 || userCerts.length > 0) {
      status = "completed";
    } else if (
      completionPercent === 0 &&
      userAttempts.length === 0 &&
      userAssignments.length === 0 &&
      userSpeaking.totalSessions === 0
    ) {
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
      assignments: userAssignments,
      avgAssignmentScore,
      submittedAssignmentsCount: userAssignments.length,
      speakingMinutes: userSpeaking.speakingMinutes,
      scenariosCompleted: userSpeaking.scenariosCompleted,
      avgSpeakingScore: userSpeaking.avgSpeakingScore,
      flaggedSessionsCount: userSpeaking.flaggedSessionsCount,
      status,
      lastActive,
    };
  });

  const avgCompletionRate = students.length > 0 ? Math.round(totalCompletionPercentages / students.length) : 0;
  const avgQuizScore = totalQuizAttemptsCount > 0 ? Math.round(totalQuizScores / totalQuizAttemptsCount) : 0;
  
  const allGraded = submissionRows.filter((s: any) => s.grade !== null && s.grade !== undefined);
  const avgAssignmentScore =
    allGraded.length > 0
      ? Math.round(allGraded.reduce((acc: number, curr: any) => acc + (curr.grade || 0), 0) / allGraded.length)
      : 0;

  return {
    courses,
    students,
    metrics: {
      totalStudents: students.length,
      avgCompletionRate,
      avgQuizScore,
      avgAssignmentScore,
      certificatesIssued: certRows.length,
      totalSpeakingMinutes: speakingMetrics.summary.totalSpeakingMinutes,
      totalScenariosCompleted: speakingMetrics.summary.totalScenariosCompleted,
      avgSpeakingScore: speakingMetrics.summary.avgSpeakingScore,
    },
  };
}

export interface MyClassroomProgress {
  completionPercent: number;
  completedLessons: number;
  totalLessons: number;
  avgQuizScore: number;
  avgAssignmentScore: number;
  attendancePercent: number;
  totalClassesAttended: number;
  totalClassSessions: number;
  speakingMinutes: number;
  scenariosCompleted: number;
  avgSpeakingScore: number | null;
  speakingSessions: Array<{
    id: string;
    scenario_title: string;
    origin: string;
    mode: string;
    status: string;
    started_at: string;
    speaking_minutes: number;
    score: number | null;
    teacher_feedback: string | null;
  }>;
  nextLesson?: {
    id: string;
    title: string;
    course_slug: string;
    course_title: string;
  } | null;
  quizzes: Array<{
    id: string;
    quiz_id: string;
    title: string;
    score: number;
    passed: boolean;
    taken_at: string;
  }>;
  assignments: Array<{
    id: string;
    assignment_id: string;
    title: string;
    max_points: number;
    grade: number | null;
    status: string;
    submitted_at: string;
    feedback: string | null;
  }>;
  attendanceRecords: Array<{
    date: string;
    status: "present" | "late" | "absent";
  }>;
  certificates: Array<{
    id: string;
    course_id: string;
    course_title: string;
    issued_at: string;
    public_id: string;
    file_url: string | null;
  }>;
}

export async function getMyClassroomProgress(
  companyId: string,
  cohortId?: string | null
): Promise<MyClassroomProgress> {
  const { userId, supabase } = await requireTenantMember(companyId);

  // 1. Determine relevant courses for this academy / cohort
  let courseIds: string[] = [];
  if (cohortId && cohortId !== "all") {
    const { data: group } = await supabase
      .from("classroom_groups")
      .select("course_id")
      .eq("id", cohortId)
      .maybeSingle();
    if (group?.course_id) {
      courseIds = [group.course_id];
    }
  }

  if (courseIds.length === 0) {
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("company_id", companyId);
    courseIds = (courses ?? []).map((c) => c.id);
  }

  // 2. Fetch courses info for slug & title
  const { data: coursesData } = await supabase
    .from("courses")
    .select("id, title, slug")
    .in("id", courseIds);
  const coursesMap = new Map((coursesData ?? []).map((c) => [c.id, c]));

  // 3. Fetch modules and lessons
  const { data: modulesData } = await supabase
    .from("modules")
    .select("id, course_id, position")
    .in("course_id", courseIds)
    .order("position", { ascending: true });

  const moduleIds = (modulesData ?? []).map((m) => m.id);
  const moduleCourseMap = new Map((modulesData ?? []).map((m) => [m.id, m.course_id]));

  let lessonsData: any[] = [];
  if (moduleIds.length > 0) {
    const { data: lData } = await supabase
      .from("lessons")
      .select("id, module_id, title, position")
      .in("module_id", moduleIds)
      .order("position", { ascending: true });
    lessonsData = lData ?? [];
  }

  const totalLessons = lessonsData.length;
  const lessonIds = lessonsData.map((l) => l.id);

  // 4. Fetch lesson progress for current user
  let completedLessonIds = new Set<string>();
  if (lessonIds.length > 0) {
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds)
      .eq("completed", true);
    completedLessonIds = new Set((progress ?? []).map((p) => p.lesson_id));
  }
  const completedLessons = completedLessonIds.size;
  const completionPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // 5. Determine next lesson to continue
  let nextLesson = null;
  for (const l of lessonsData) {
    if (!completedLessonIds.has(l.id)) {
      const courseId = moduleCourseMap.get(l.module_id);
      const course = courseId ? coursesMap.get(courseId) : null;
      if (course) {
        nextLesson = {
          id: l.id,
          title: l.title,
          course_slug: course.slug,
          course_title: course.title,
        };
        break;
      }
    }
  }

  // 6. Fetch quizzes & attempts
  let quizzes: any[] = [];
  if (lessonIds.length > 0) {
    const { data: qData } = await supabase
      .from("quizzes")
      .select("id, title, lesson_id")
      .in("lesson_id", lessonIds);
    quizzes = qData ?? [];
  }
  const quizTitleMap = new Map(quizzes.map((q) => [q.id, q.title || "Lesson Quiz"]));
  const quizIds = quizzes.map((q) => q.id);

  let attempts: any[] = [];
  if (quizIds.length > 0) {
    const { data: aData } = await supabase
      .from("quiz_attempts")
      .select("id, quiz_id, score, passed, created_at")
      .eq("user_id", userId)
      .in("quiz_id", quizIds)
      .order("created_at", { ascending: false });
    attempts = aData ?? [];
  }

  const avgQuizScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length)
      : 0;

  const quizList = attempts.map((a) => ({
    id: a.id,
    quiz_id: a.quiz_id,
    title: quizTitleMap.get(a.quiz_id) || "Lesson Quiz",
    score: a.score ?? 0,
    passed: !!a.passed,
    taken_at: a.created_at,
  }));

  // 7. Fetch assignments & grades
  const { data: assignmentRows } = await supabase
    .from("classroom_assignment_submissions")
    .select(`
      id,
      assignment_id,
      grade,
      status,
      submitted_at,
      feedback,
      assignment:classroom_assignments(title, max_points)
    `)
    .eq("student_id", userId)
    .eq("company_id", companyId)
    .order("submitted_at", { ascending: false });

  const assignmentList = (assignmentRows ?? []).map((s: any) => ({
    id: s.id,
    assignment_id: s.assignment_id,
    title: s.assignment?.title || "Class Assignment",
    max_points: s.assignment?.max_points || 100,
    grade: s.grade,
    status: s.status,
    submitted_at: s.submitted_at,
    feedback: s.feedback,
  }));

  const gradedAssignments = assignmentList.filter((a) => a.grade !== null && a.grade !== undefined);
  const avgAssignmentScore =
    gradedAssignments.length > 0
      ? Math.round(gradedAssignments.reduce((acc, curr) => acc + (curr.grade || 0), 0) / gradedAssignments.length)
      : 0;

  // 8. Fetch student attendance
  const { data: attRows } = await supabase
    .from("student_attendance")
    .select("date, status")
    .eq("company_id", companyId)
    .eq("profile_id", userId)
    .order("date", { ascending: false });

  const attendanceRecords = (attRows ?? []) as any[];
  const totalClassSessions = attendanceRecords.length;
  const totalClassesAttended = attendanceRecords.filter((a) => a.status === "present" || a.status === "late").length;
  const attendancePercent =
    totalClassSessions > 0 ? Math.round((totalClassesAttended / totalClassSessions) * 100) : 100;

  // 9. Fetch certificates
  let certQuery = supabase
    .from("certificates")
    .select("id, course_id, issued_at, public_id, file_url")
    .eq("user_id", userId);

  if (courseIds.length > 0) {
    certQuery = certQuery.in("course_id", courseIds);
  }

  const { data: certRows } = await certQuery.order("issued_at", { ascending: false });

  const certificates = (certRows ?? []).map((c: any) => ({
    id: c.id,
    course_id: c.course_id,
    course_title: coursesMap.get(c.course_id)?.title || "Course Certificate",
    issued_at: c.issued_at,
    public_id: c.public_id,
    file_url: c.file_url,
  }));

  // 10. Fetch AI speaking practice sessions & scores
  let speakingMetrics = emptyUserSpeakingMetrics();
  let speakingSessions: MyClassroomProgress["speakingSessions"] = [];
  try {
    const db = createServiceClient();
    const { data: mySessions } = await db
      .from("tutor_sessions")
      .select(
        "id, user_id, origin, mode, status, started_at, learner_speaking_ms, scenario_id, shared_with_teacher"
      )
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .neq("origin", "ask") // P1-06: lesson Ask conversations are not practice sessions
      .order("started_at", { ascending: false })
      .limit(25);

    const sessionList = mySessions ?? [];
    const scenarioIds = Array.from(
      new Set(sessionList.map((s) => s.scenario_id).filter((id): id is string => Boolean(id))),
    );
    let reportRows: { session_id: string; scores: unknown; tone_stats: unknown }[] = [];
    const scenarioTitleById = new Map<string, string>();
    if (sessionList.length > 0) {
      const [{ data: reps }, { data: scens }] = await Promise.all([
        db
          .from("tutor_reports")
          .select("session_id, scores, tone_stats")
          .in(
            "session_id",
            sessionList.map((s) => s.id),
          ),
        scenarioIds.length > 0
          ? db.from("practice_scenarios").select("id, title").in("id", scenarioIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      ]);
      reportRows = reps ?? [];
      for (const sc of scens ?? []) {
        scenarioTitleById.set(sc.id, sc.title);
      }
    }

    const aggregated = aggregateSpeakingMetricsByUser(sessionList, reportRows);
    speakingMetrics = aggregated.byUser.get(userId) ?? emptyUserSpeakingMetrics();

    const reportBySession = new Map(reportRows.map((r) => [r.session_id, r]));
    speakingSessions = sessionList.map((s) => {
      const rep = reportBySession.get(s.id);
      const toneStats =
        rep?.tone_stats && typeof rep.tone_stats === "object" && !Array.isArray(rep.tone_stats)
          ? (rep.tone_stats as Record<string, unknown>)
          : null;
      const reviewObj =
        toneStats?.teacher_review && typeof toneStats.teacher_review === "object" && !Array.isArray(toneStats.teacher_review)
          ? (toneStats.teacher_review as Record<string, unknown>)
          : null;
      const feedbackNote =
        typeof reviewObj?.notes === "string" && reviewObj.notes.trim().length > 0
          ? reviewObj.notes
          : null;

      return {
        id: s.id,
        scenario_title: (s.scenario_id && scenarioTitleById.get(s.scenario_id)) || "AI Teacher Practice",
        origin: s.origin,
        mode: s.mode,
        status: s.status,
        started_at: s.started_at,
        speaking_minutes: speakingMsToMinutes(s.learner_speaking_ms),
        score: rep ? extractReportAverageScore(rep.scores) : null,
        teacher_feedback: feedbackNote,
      };
    });
  } catch (speakErr) {
    console.warn("Unable to load learner speaking metrics:", speakErr);
  }

  return {
    completionPercent,
    completedLessons,
    totalLessons,
    avgQuizScore,
    avgAssignmentScore,
    attendancePercent,
    totalClassesAttended,
    totalClassSessions,
    speakingMinutes: speakingMetrics.speakingMinutes,
    scenariosCompleted: speakingMetrics.scenariosCompleted,
    avgSpeakingScore: speakingMetrics.avgSpeakingScore,
    speakingSessions,
    nextLesson,
    quizzes: quizList,
    assignments: assignmentList,
    attendanceRecords,
    certificates,
  };
}

export async function getAcademyInstructors(companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const { data: members, error } = await supabase
    .from("company_members")
    .select(`
      profile_id,
      role,
      profile:profiles(id, full_name, email, avatar_url)
    `)
    .eq("company_id", companyId)
    .eq("status", "active")
    .in("role", ["instructor", "teacher", "company_admin"]);

  if (error || !members) return [];
  return members
    .map((m: any) => m.profile)
    .filter((p: any) => Boolean(p && p.id));
}

export async function getInstructorOverviewStats(
  companyId: string,
  cohortId?: string | null
) {
  const { supabase } = await requireTenantMember(companyId);

  let assignmentIds: string[] | null = null;
  if (cohortId && cohortId !== "all") {
    const { data: assignments } = await supabase
      .from("classroom_assignments")
      .select("id")
      .eq("company_id", companyId)
      .eq("cohort_id", cohortId);
    assignmentIds = (assignments ?? []).map((a) => a.id);
  }

  let subQuery = supabase
    .from("classroom_assignment_submissions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "submitted");

  if (assignmentIds !== null) {
    if (assignmentIds.length > 0) {
      subQuery = subQuery.in("assignment_id", assignmentIds);
    } else {
      subQuery = subQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  let matQuery = supabase
    .from("classroom_materials")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (cohortId && cohortId !== "all") {
    matQuery = matQuery.eq("cohort_id", cohortId);
  }

  let studentsCount = 0;
  if (cohortId && cohortId !== "all") {
    const { count } = await supabase
      .from("classroom_group_members")
      .select("profile_id", { count: "exact", head: true })
      .eq("group_id", cohortId);
    studentsCount = count || 0;
  } else {
    const { count } = await supabase
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "active")
      .eq("role", "learner");
    studentsCount = count || 0;
  }

  const [submissionsCountRes, materialsCountRes] = await Promise.all([
    subQuery,
    matQuery,
  ]);

  return {
    pendingGradingCount: submissionsCountRes.count || 0,
    materialsCount: materialsCountRes.count || 0,
    activeStudentsCount: studentsCount,
  };
}

export async function setCourseClassLinks(
  companyId: string,
  courseId: string,
  groupIds: string[],
  companySlug?: string
) {
  const { supabase } = await requireInstructor(companyId);

  // Clear course_id on classes previously linked to this course, then assign selected ones
  await supabase
    .from("classroom_groups")
    .update({ course_id: null } as any)
    .eq("company_id", companyId)
    .eq("course_id", courseId);

  if (groupIds.length > 0) {
    await supabase
      .from("classroom_groups")
      .update({ course_id: courseId } as any)
      .eq("company_id", companyId)
      .in("id", groupIds);
  }

  if (companySlug) {
    revalidatePath(`/academy/${companySlug}/classroom`);
    revalidatePath(`/academy/${companySlug}/admin/classroom`);
    revalidatePath(`/academy/${companySlug}/admin/courses/${courseId}`);
  }
  return { success: true };
}

