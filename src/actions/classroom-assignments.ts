"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";
import {
  signClassroomStorageUrls,
  uploadFileToClassroomBucket,
} from "@/lib/storage/classroom-bucket";
import { insertSingleWithSchemaFallback } from "@/lib/supabase/schema-fallback";

export interface RubricCriterion {
  id: string;
  title: string;
  description?: string;
  points: number;
}

export interface AssignmentAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface AssignmentWithMeta {
  id: string;
  company_id: string;
  cohort_id: string | null;
  course_id: string | null;
  author_id: string;
  title: string;
  description: string | null;
  due_date: string;
  max_points: number;
  submission_type: "file" | "link" | "file_or_link";
  attachments: AssignmentAttachment[];
  rubric: RubricCriterion[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  cohort?: {
    id: string;
    name: string;
  } | null;
  course?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  my_submission?: {
    id: string;
    status: "submitted" | "graded" | "late" | "resubmit_requested";
    grade: number | null;
    feedback: string | null;
    file_url: string | null;
    repo_url: string | null;
    file_name: string | null;
    file_size_bytes: number;
    submission_text: string | null;
    submitted_at: string;
    graded_at: string | null;
  } | null;
  submissions_count?: {
    total: number;
    graded: number;
    pending: number;
  };
}

export async function getClassroomAssignments(
  companyId: string,
  cohortId?: string | null
): Promise<AssignmentWithMeta[]> {
  const { userId, tenantRole, isSuperAdmin, supabase } = await requireTenantMember(companyId);
  const isInstructorOrAdmin = isSuperAdmin || tenantRole === "company_admin" || tenantRole === "teacher" || tenantRole === "instructor";

  let query = supabase
    .from("classroom_assignments")
    .select(`
      *,
      author:profiles!classroom_assignments_author_id_fkey(full_name, avatar_url),
      cohort:classroom_groups(id, name),
      course:courses(id, title, slug)
    `)
    .eq("company_id", companyId);

  if (cohortId && cohortId !== "all") {
    query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
  }

  const { data: assignments, error } = await query
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Failed to fetch assignments:", error);
    return [];
  }

  if (!assignments || assignments.length === 0) return [];

  const assignmentIds = assignments.map((a: any) => a.id);

  if (!isInstructorOrAdmin) {
    // For student: fetch own submissions
    const { data: submissions } = await supabase
      .from("classroom_assignment_submissions")
      .select("*")
      .in("assignment_id", assignmentIds)
      .eq("student_id", userId);

    const serviceClient = createServiceClient();
    const urlsToSign: Array<string | null | undefined> = [];
    for (const a of assignments as any[]) {
      if (Array.isArray(a.attachments)) {
        for (const att of a.attachments) urlsToSign.push(att?.url);
      }
    }
    for (const s of submissions ?? []) {
      urlsToSign.push((s as any).file_url);
    }
    const signedMap = await signClassroomStorageUrls(serviceClient, urlsToSign);

    const submissionMap = new Map(
      (submissions ?? []).map((s: any) => [
        s.assignment_id,
        {
          ...s,
          file_url: s.file_url ? (signedMap.get(s.file_url) ?? s.file_url) : null,
        },
      ])
    );

    return assignments.map((a: any) => ({
      ...a,
      attachments: Array.isArray(a.attachments)
        ? a.attachments.map((att: any) => ({
            ...att,
            url: att?.url ? (signedMap.get(att.url) ?? att.url) : att?.url,
          }))
        : [],
      rubric: Array.isArray(a.rubric) ? a.rubric : [],
      my_submission: submissionMap.get(a.id) ?? null,
    }));
  } else {
    // For instructor: fetch submission counts
    const { data: submissions } = await supabase
      .from("classroom_assignment_submissions")
      .select("id, assignment_id, status")
      .in("assignment_id", assignmentIds);

    const serviceClient = createServiceClient();
    const urlsToSign: Array<string | null | undefined> = [];
    for (const a of assignments as any[]) {
      if (Array.isArray(a.attachments)) {
        for (const att of a.attachments) urlsToSign.push(att?.url);
      }
    }
    const signedMap = await signClassroomStorageUrls(serviceClient, urlsToSign);

    const countsMap = new Map<string, { total: number; graded: number; pending: number }>();
    for (const aId of assignmentIds) {
      countsMap.set(aId, { total: 0, graded: 0, pending: 0 });
    }

    for (const sub of submissions ?? []) {
      const c = countsMap.get(sub.assignment_id) || { total: 0, graded: 0, pending: 0 };
      c.total++;
      if (sub.status === "graded") {
        c.graded++;
      } else {
        c.pending++;
      }
      countsMap.set(sub.assignment_id, c);
    }

    return assignments.map((a: any) => ({
      ...a,
      attachments: Array.isArray(a.attachments)
        ? a.attachments.map((att: any) => ({
            ...att,
            url: att?.url ? (signedMap.get(att.url) ?? att.url) : att?.url,
          }))
        : [],
      rubric: Array.isArray(a.rubric) ? a.rubric : [],
      submissions_count: countsMap.get(a.id) ?? { total: 0, graded: 0, pending: 0 },
    }));
  }
}

export async function createClassroomAssignment(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const { userId, supabase } = await requireTenantTeacher(companyId);

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const dueDateStr = formData.get("dueDate") as string;
  const maxPoints = parseInt((formData.get("maxPoints") as string) || "100", 10);
  const submissionType = ((formData.get("submissionType") as string) || "file_or_link") as "file" | "link" | "file_or_link";
  const cohortIdRaw = formData.get("cohortId") as string;
  const cohortId = cohortIdRaw && cohortIdRaw !== "all" ? cohortIdRaw : null;
  const courseIdRaw = formData.get("courseId") as string;
  const courseId = courseIdRaw && courseIdRaw !== "all" ? courseIdRaw : null;

  if (!title) throw new Error("Assignment title is required.");
  if (!dueDateStr) throw new Error("Due date is required.");

  const dueDate = new Date(dueDateStr).toISOString();

  // Rubric
  let rubric: RubricCriterion[] = [];
  const rubricJson = formData.get("rubric") as string;
  if (rubricJson) {
    try {
      rubric = JSON.parse(rubricJson);
    } catch {
      rubric = [];
    }
  }

  // File Attachment (prefer pre-uploaded signed URL for large files up to 50 MB)
  const attachments: AssignmentAttachment[] = [];
  const preUrl = (formData.get("preUploadedFileUrl") as string)?.trim();
  const preName = (formData.get("preUploadedFileName") as string)?.trim();
  const preSize = parseInt((formData.get("preUploadedFileSize") as string) || "0", 10);
  const preType = (formData.get("preUploadedFileType") as string)?.trim();
  const file = formData.get("file") as File | null;

  if (preUrl && preName) {
    attachments.push({
      name: preName,
      url: preUrl,
      size: Number.isFinite(preSize) ? preSize : 0,
      type: preType || "application/octet-stream",
    });
  } else if (file && file.size > 0) {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${companyId}/assignments/${Date.now()}_${cleanFileName}`;
    const serviceClient = createServiceClient();
    const { publicUrl } = await uploadFileToClassroomBucket(serviceClient, filePath, file, false);

    attachments.push({
      name: file.name,
      url: publicUrl,
      size: file.size,
      type: file.type || "application/octet-stream",
    });
  }

  const { data: newAssignment, error } = await insertSingleWithSchemaFallback(
    supabase,
    "classroom_assignments",
    {
      company_id: companyId,
      cohort_id: cohortId,
      course_id: courseId,
      author_id: userId,
      title,
      description,
      due_date: dueDate,
      max_points: maxPoints,
      submission_type: submissionType,
      attachments: attachments as any,
      rubric: rubric as any,
      is_published: true,
    }
  );

  if (error) {
    console.error("Create assignment error:", error);
    throw new Error(error.message);
  }

  // Push notifications to enrolled students
  try {
    let studentIds: string[] = [];
    if (cohortId) {
      const { data: members } = await supabase
        .from("classroom_group_members")
        .select("profile_id")
        .eq("group_id", cohortId);
      studentIds = (members ?? []).map((m: any) => m.profile_id).filter((pid: string) => pid && pid !== userId);
    } else {
      const { data: members } = await supabase
        .from("company_members")
        .select("profile_id")
        .eq("company_id", companyId)
        .eq("status", "active")
        .eq("role", "learner");
      studentIds = (members ?? []).map((m: any) => m.profile_id).filter((pid: string) => pid && pid !== userId);
    }

    if (studentIds.length > 0) {
      const notifs = studentIds.map((pid) => ({
        user_id: pid,
        type: "assignment",
        title: `📝 New Assignment: ${title}`,
        body: `Due ${new Date(dueDate).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · Max ${maxPoints} points`,
        data: {
          assignment_id: newAssignment.id,
          company_id: companyId,
          company_slug: companySlug,
          url: `/academy/${companySlug}/classroom?tab=assignments`,
        },
      }));
      await supabase.from("notifications").insert(notifs as any);
    }
  } catch (notifErr) {
    console.error("Failed to notify students of assignment:", notifErr);
  }

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true, assignment: newAssignment };
}

export async function deleteClassroomAssignment(
  assignmentId: string,
  companyId: string,
  companySlug: string
) {
  const { supabase } = await requireTenantTeacher(companyId);

  const { error } = await supabase
    .from("classroom_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true };
}

export async function submitClassroomAssignment(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const assignmentId = formData.get("assignmentId") as string;

  const { userId, supabase } = await requireTenantMember(companyId);

  const submissionText = (formData.get("submissionText") as string)?.trim() || null;
  const repoUrl = (formData.get("repoUrl") as string)?.trim() || null;
  const file = formData.get("file") as File | null;

  if (!assignmentId) throw new Error("Assignment ID is required.");

  // Check assignment details & due date
  const { data: assignment, error: aError } = await supabase
    .from("classroom_assignments")
    .select("id, due_date, max_points, title")
    .eq("id", assignmentId)
    .eq("company_id", companyId)
    .single();

  if (aError || !assignment) throw new Error("Assignment not found.");

  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let fileSizeBytes: number = 0;

  const preUrl = (formData.get("preUploadedFileUrl") as string)?.trim();
  const preName = (formData.get("preUploadedFileName") as string)?.trim();
  const preSize = parseInt((formData.get("preUploadedFileSize") as string) || "0", 10);

  if (preUrl && preName) {
    fileUrl = preUrl;
    fileName = preName;
    fileSizeBytes = Number.isFinite(preSize) ? preSize : 0;
  } else if (file && file.size > 0) {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${companyId}/submissions/${assignmentId}/${userId}_${Date.now()}_${cleanFileName}`;
    const serviceClient = createServiceClient();
    const { publicUrl } = await uploadFileToClassroomBucket(serviceClient, filePath, file, true);

    fileUrl = publicUrl;
    fileName = file.name;
    fileSizeBytes = file.size;
  }

  // Validate that student provided at least something
  if (!fileUrl && !repoUrl && !submissionText) {
    throw new Error("Please upload a file, provide a GitHub repo link, or enter submission notes.");
  }

  const isLate = new Date() > new Date(assignment.due_date);
  const status = isLate ? "late" : "submitted";

  const { data: submission, error: subError } = await supabase
    .from("classroom_assignment_submissions")
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: userId,
        company_id: companyId,
        submission_text: submissionText,
        file_url: fileUrl,
        repo_url: repoUrl,
        file_name: fileName,
        file_size_bytes: fileSizeBytes,
        status: status,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,student_id" }
    )
    .select()
    .single();

  if (subError) {
    console.error("Save submission error:", subError);
    throw new Error(subError.message);
  }

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true, submission };
}

export async function getAssignmentSubmissionsForInstructor(
  assignmentId: string,
  companyId: string
) {
  const { supabase } = await requireTenantTeacher(companyId);

  const { data, error } = await supabase
    .from("classroom_assignment_submissions")
    .select(`
      *,
      student:profiles!classroom_assignment_submissions_student_id_fkey(id, full_name, avatar_url, email)
    `)
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Get submissions error:", error);
    throw new Error(error.message);
  }

  const rows = data ?? [];
  if (rows.length > 0) {
    const serviceClient = createServiceClient();
    const signedMap = await signClassroomStorageUrls(
      serviceClient,
      rows.map((r: any) => r.file_url)
    );
    return rows.map((r: any) => ({
      ...r,
      file_url: r.file_url ? (signedMap.get(r.file_url) ?? r.file_url) : null,
    }));
  }

  return rows;
}

export async function gradeClassroomSubmission(formData: FormData) {
  const submissionId = formData.get("submissionId") as string;
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const grade = parseFloat(formData.get("grade") as string);
  const feedback = (formData.get("feedback") as string)?.trim() || null;

  const { userId, supabase } = await requireTenantTeacher(companyId);

  if (!submissionId) throw new Error("Submission ID is required.");
  if (isNaN(grade)) throw new Error("Valid numeric grade is required.");

  const { data: submission, error: updateError } = await supabase
    .from("classroom_assignment_submissions")
    .update({
      grade,
      feedback,
      status: "graded",
      graded_by: userId,
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select(`
      *,
      assignment:classroom_assignments(title, max_points)
    `)
    .single();

  if (updateError) {
    console.error("Grading error:", updateError);
    throw new Error(updateError.message);
  }

  // Notify student
  try {
    const sub = submission as any;
    if (sub?.student_id) {
      const assignmentTitle = sub.assignment?.title || "Assignment";
      const maxPoints = sub.assignment?.max_points || 100;

      await supabase.from("notifications").insert({
        user_id: sub.student_id,
        type: "grade",
        title: `🎯 Assignment Graded: ${assignmentTitle}`,
        body: `You received ${grade}/${maxPoints} points. Click to review your instructor's feedback.`,
        data: {
          submission_id: sub.id,
          assignment_id: sub.assignment_id,
          company_id: companyId,
          company_slug: companySlug,
          url: `/academy/${companySlug}/classroom?tab=assignments`,
        },
      } as any);
    }
  } catch (notifErr) {
    console.error("Failed to notify student of grade:", notifErr);
  }

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true, submission };
}
