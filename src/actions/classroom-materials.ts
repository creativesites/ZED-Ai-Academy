"use server";

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";

const BUCKET = "classroom-materials";
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MATERIAL_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/x-python",
  "text/javascript",
  "application/javascript",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

async function ensureMaterialsBucket(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data: existing } = await serviceClient.storage.getBucket(BUCKET);
  if (!existing) {
    await serviceClient.storage
      .createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_BYTES,
        allowedMimeTypes: ALLOWED_MATERIAL_MIME_TYPES,
      })
      .catch(() => null);
    return;
  }

  await serviceClient.storage
    .updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_BYTES,
      allowedMimeTypes: ALLOWED_MATERIAL_MIME_TYPES,
    })
    .catch(() => null);
}

async function ensureProfileRow(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string
) {
  const { data: existingProfile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile) return;

  const user = await currentUser().catch(() => null);
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null;
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    email ||
    "Academy Instructor";

  await serviceClient
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        avatar_url: user?.imageUrl ?? null,
      },
      { onConflict: "id" }
    );
}

function buildSafeMaterialPath(companyId: string, fileName: string, prefix?: string) {
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() ?? "bin" : "bin";
  const baseName =
    fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase()
      .slice(0, 50) || "material";
  return `${companyId}/${prefix ? `${prefix}-` : ""}${Date.now()}-${baseName}.${ext}`;
}

export interface ClassroomFolder {
  id: string;
  company_id: string;
  cohort_id: string | null;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  materials_count?: number;
}

export interface ClassroomMaterial {
  id: string;
  company_id: string;
  folder_id: string | null;
  cohort_id: string | null;
  course_id: string | null;
  author_id: string;
  title: string;
  description: string | null;
  material_type: "pdf" | "document" | "slides" | "worksheet" | "code" | "link" | "video";
  category?: string;
  visibility?: string;
  requires_acknowledgement?: boolean;
  published_at?: string;
  file_url: string | null;
  file_size_bytes: number;
  tags: string[];
  is_pinned: boolean;
  is_published: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
  is_bookmarked?: boolean;
  is_acknowledged?: boolean;
  author?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
  folder?: {
    name: string;
    color: string;
  } | null;
  cohort?: {
    name: string;
    color: string;
  } | null;
  course?: {
    id: string;
    title: string;
    slug: string;
  } | null;
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export async function getClassroomFolders(
  companyId: string,
  cohortId?: string | null
): Promise<ClassroomFolder[]> {
  const { supabase } = await requireTenantMember(companyId);

  let query = supabase
    .from("classroom_folders")
    .select("*, classroom_materials(count)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (cohortId) {
    query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load classroom folders:", error);
    return [];
  }

  return (data ?? []).map((f: any) => ({
    id: f.id,
    company_id: f.company_id,
    cohort_id: f.cohort_id,
    name: f.name,
    color: f.color || "#fd5523",
    icon: f.icon || "folder",
    created_at: f.created_at,
    materials_count: f.classroom_materials?.[0]?.count || 0,
  }));
}

export async function createClassroomFolder(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const color = (formData.get("color") as string) || "#fd5523";
  const icon = (formData.get("icon") as string) || "folder";
  const cohortId = (formData.get("cohortId") as string) || null;

  if (!name) throw new Error("Folder name is required");

  const { supabase } = await requireTenantTeacher(companyId);

  const { data, error } = await supabase
    .from("classroom_folders")
    .insert({
      company_id: companyId,
      name,
      color,
      icon,
      cohort_id: cohortId && cohortId !== "all" ? cohortId : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/academy/${companySlug}/classroom`);
  return data;
}

export async function deleteClassroomFolder(folderId: string, companyId: string, companySlug: string) {
  const { supabase } = await requireTenantTeacher(companyId);

  const { error } = await supabase
    .from("classroom_folders")
    .delete()
    .eq("id", folderId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true };
}

// ─── Materials ───────────────────────────────────────────────────────────────

export async function getClassroomMaterials(
  companyId: string,
  optionsOrCohortId?:
    | string
    | null
    | {
        folderId?: string | null;
        cohortId?: string | null;
        courseId?: string | null;
        search?: string;
        materialType?: string;
        category?: string;
        tag?: string;
        sort?: "updated" | "title" | "created";
        isBookmarkedOnly?: boolean;
      }
): Promise<ClassroomMaterial[]> {
  const options =
    typeof optionsOrCohortId === "string"
      ? { cohortId: optionsOrCohortId }
      : optionsOrCohortId && typeof optionsOrCohortId === "object"
      ? optionsOrCohortId
      : {};

  const { userId, supabase } = await requireTenantMember(companyId);

  let query = supabase
    .from("classroom_materials")
    .select(`
      *,
      author:profiles!classroom_materials_author_id_fkey(full_name, avatar_url, email),
      folder:classroom_folders(name, color),
      cohort:classroom_groups(name, color),
      course:courses(id, title, slug)
    `)
    .eq("company_id", companyId);

  if (options.folderId) {
    if (options.folderId === "unfiled") {
      query = query.is("folder_id", null);
    } else {
      query = query.eq("folder_id", options.folderId);
    }
  }

  if (options.cohortId && options.cohortId !== "all") {
    query = query.or(`cohort_id.eq.${options.cohortId},cohort_id.is.null`);
  }

  if (options.courseId && options.courseId !== "all") {
    query = query.eq("course_id", options.courseId);
  }

  if (options.materialType && options.materialType !== "all") {
    query = query.eq("material_type", options.materialType as any);
  }

  if (options.category && options.category !== "all") {
    query = query.eq("category", options.category);
  }

  if (options.sort === "title") {
    query = query.order("title", { ascending: true });
  } else if (options.sort === "created") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load classroom materials:", error);
    return [];
  }

  let list = (data ?? []) as any[];

  // Fetch bookmarks and acknowledgements for current user
  try {
    const [bookmarksRes, acksRes] = await Promise.all([
      supabase
        .from("classroom_bookmarks")
        .select("document_id")
        .eq("student_id", userId)
        .eq("company_id", companyId),
      supabase
        .from("class_document_acknowledgements")
        .select("document_id")
        .eq("student_id", userId)
        .eq("company_id", companyId),
    ]);

    const bookmarkedSet = new Set((bookmarksRes.data ?? []).map((b: any) => b.document_id));
    const ackedSet = new Set((acksRes.data ?? []).map((a: any) => a.document_id));

    list = list.map((m) => ({
      ...m,
      is_bookmarked: bookmarkedSet.has(m.id),
      is_acknowledged: ackedSet.has(m.id),
    }));
  } catch (enrichErr) {
    console.warn("Could not enrich materials with bookmarks/acknowledgements:", enrichErr);
  }

  if (options.isBookmarkedOnly) {
    list = list.filter((m) => m.is_bookmarked);
  }

  if (typeof options.search === "string" && options.search.trim()) {
    const s = options.search.toLowerCase();
    list = list.filter(
      (m) =>
        m.title.toLowerCase().includes(s) ||
        (m.description && m.description.toLowerCase().includes(s)) ||
        (m.tags && m.tags.some((t: string) => t.toLowerCase().includes(s)))
    );
  }

  if (options.tag && options.tag !== "all") {
    list = list.filter((m) => m.tags && m.tags.includes(options.tag!));
  }

  return list;
}

export async function getPinnedClassroomMaterials(
  companyId: string,
  cohortId?: string | null
): Promise<ClassroomMaterial[]> {
  const { supabase } = await requireTenantMember(companyId);

  let query = supabase
    .from("classroom_materials")
    .select(`
      *,
      author:profiles!classroom_materials_author_id_fkey(full_name, avatar_url, email),
      folder:classroom_folders(name, color),
      cohort:classroom_groups(name, color)
    `)
    .eq("company_id", companyId)
    .eq("is_pinned", true)
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (cohortId && cohortId !== "all") {
    query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load pinned classroom materials:", error);
    return [];
  }

  return (data ?? []) as any[];
}

export interface MaterialSignedUploadSession {
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

export async function createMaterialSignedUpload(
  companyId: string,
  fileName: string,
  prefix?: string
): Promise<MaterialSignedUploadSession> {
  await requireTenantTeacher(companyId);
  const serviceClient = createServiceClient();
  await ensureMaterialsBucket(serviceClient);

  const uniquePath = buildSafeMaterialPath(companyId, fileName || "material", prefix);
  const { data, error } = await serviceClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(uniquePath);

  if (error || !data) {
    throw new Error(error?.message || "Could not initialize storage upload URL.");
  }

  const { data: publicData } = serviceClient.storage
    .from(BUCKET)
    .getPublicUrl(uniquePath);

  return {
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicData.publicUrl,
  };
}

export async function createClassroomMaterialRecord(input: {
  companyId: string;
  companySlug: string;
  title: string;
  description?: string | null;
  materialType?: string;
  category?: string;
  visibility?: string;
  requiresAcknowledgement?: boolean;
  folderId?: string | null;
  cohortId?: string | null;
  courseId?: string | null;
  isPinned?: boolean;
  isPublished?: boolean;
  tags?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number;
  mimeType?: string | null;
}) {
  const title = input.title?.trim();
  if (!title) throw new Error("Material title is required");

  const { userId } = await requireTenantTeacher(input.companyId);
  const serviceClient = createServiceClient();
  await ensureProfileRow(serviceClient, userId);

  const tags = (input.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const { data: newMaterial, error } = await serviceClient
    .from("classroom_materials")
    .insert({
      company_id: input.companyId,
      folder_id: input.folderId && input.folderId !== "unfiled" ? input.folderId : null,
      cohort_id: input.cohortId && input.cohortId !== "all" ? input.cohortId : null,
      course_id: input.courseId && input.courseId !== "all" ? input.courseId : null,
      author_id: userId,
      title,
      description: input.description?.trim() || null,
      material_type: (input.materialType || "document") as any,
      category: input.category || "lecture_notes",
      visibility: input.visibility || "class",
      requires_acknowledgement: Boolean(input.requiresAcknowledgement),
      file_url: input.fileUrl?.trim() || null,
      file_size_bytes: input.fileSizeBytes ?? 0,
      tags,
      is_pinned: Boolean(input.isPinned),
      is_published: input.isPublished !== false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (input.fileUrl && (input.fileSizeBytes ?? 0) > 0) {
    try {
      await serviceClient.from("class_document_versions").insert({
        document_id: (newMaterial as any).id,
        version_number: 1,
        file_url: input.fileUrl,
        file_name: input.fileName || title,
        file_size_bytes: input.fileSizeBytes ?? 0,
        mime_type: input.mimeType || "application/octet-stream",
        change_note: "Initial upload",
        uploaded_by: userId,
      });
    } catch (verErr) {
      console.warn("Could not record initial document version:", verErr);
    }
  }

  revalidatePath(`/academy/${input.companySlug}/classroom`);
  revalidatePath(`/academy/${input.companySlug}/admin/classroom`);
  return newMaterial;
}

export async function createClassroomMaterial(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const materialType = (formData.get("materialType") as string) || "document";
  const category = (formData.get("category") as string) || "lecture_notes";
  const visibility = (formData.get("visibility") as string) || "class";
  const requiresAcknowledgement = formData.get("requiresAcknowledgement") === "true";
  const folderId = (formData.get("folderId") as string) || null;
  const cohortId = (formData.get("cohortId") as string) || null;
  const courseId = (formData.get("courseId") as string) || null;
  const isPinned = formData.get("isPinned") === "true";
  const isPublished = formData.get("isPublished") !== "false";
  const rawTags = (formData.get("tags") as string) || "";
  const externalUrl = (formData.get("externalUrl") as string)?.trim();
  const file = formData.get("file") as File | null;

  if (!title) throw new Error("Material title is required");

  const { userId } = await requireTenantTeacher(companyId);
  const serviceClient = createServiceClient();
  await ensureProfileRow(serviceClient, userId);

  let fileUrl = externalUrl || null;
  let fileSizeBytes = 0;

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("File size exceeds 50 MB limit");
    }

    await ensureMaterialsBucket(serviceClient);
    const uniquePath = buildSafeMaterialPath(companyId, file.name);
    const bodyBuffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(uniquePath, bodyBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: publicData } = serviceClient.storage
      .from(BUCKET)
      .getPublicUrl(uniquePath);
    fileUrl = publicData.publicUrl;
    fileSizeBytes = file.size;
  }

  return createClassroomMaterialRecord({
    companyId,
    companySlug,
    title,
    description,
    materialType,
    category,
    visibility,
    requiresAcknowledgement,
    folderId,
    cohortId,
    courseId,
    isPinned,
    isPublished,
    tags: rawTags,
    fileUrl,
    fileName: file?.name || title,
    fileSizeBytes,
    mimeType: file?.type || "application/octet-stream",
  });
}

export async function recordDocumentVersion(input: {
  companyId: string;
  companySlug: string;
  documentId: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType?: string | null;
  changeNote?: string | null;
}) {
  const { userId } = await requireTenantTeacher(input.companyId);
  const serviceClient = createServiceClient();
  await ensureProfileRow(serviceClient, userId);

  const { data: existingVersions } = await serviceClient
    .from("class_document_versions")
    .select("version_number")
    .eq("document_id", input.documentId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVersion = (existingVersions?.[0]?.version_number || 1) + 1;

  await serviceClient.from("class_document_versions").insert({
    document_id: input.documentId,
    version_number: nextVersion,
    file_url: input.fileUrl,
    file_name: input.fileName,
    file_size_bytes: input.fileSizeBytes,
    mime_type: input.mimeType || "application/octet-stream",
    change_note: input.changeNote?.trim() || null,
    uploaded_by: userId,
  });

  await serviceClient
    .from("classroom_materials")
    .update({
      file_url: input.fileUrl,
      file_size_bytes: input.fileSizeBytes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.documentId);

  revalidatePath(`/academy/${input.companySlug}/classroom`);
  revalidatePath(`/academy/${input.companySlug}/admin/classroom`);
  return { success: true, version: nextVersion, fileUrl: input.fileUrl };
}

export async function uploadDocumentVersion(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const documentId = formData.get("documentId") as string;
  const changeNote = (formData.get("changeNote") as string)?.trim() || null;
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) throw new Error("A replacement file is required");
  if (file.size > MAX_FILE_BYTES) throw new Error("File size exceeds 50 MB limit");

  await requireTenantTeacher(companyId);
  const serviceClient = createServiceClient();
  await ensureMaterialsBucket(serviceClient);

  const uniquePath = buildSafeMaterialPath(companyId, file.name, `${documentId}-ver`);
  const bodyBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(uniquePath, bodyBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data: publicData } = serviceClient.storage
    .from(BUCKET)
    .getPublicUrl(uniquePath);

  return recordDocumentVersion({
    companyId,
    companySlug,
    documentId,
    fileUrl: publicData.publicUrl,
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    changeNote,
  });
}

export async function getDocumentVersions(documentId: string, companyId: string) {
  const { supabase } = await requireTenantMember(companyId);
  const { data, error } = await supabase
    .from("class_document_versions")
    .select(`
      *,
      uploader:profiles!class_document_versions_uploaded_by_fkey(full_name, email, avatar_url)
    `)
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });

  if (error) {
    console.error("Failed to load document versions:", error);
    return [];
  }
  return data ?? [];
}

export async function toggleBookmarkDocument(documentId: string, companyId: string, companySlug: string) {
  const { userId, supabase } = await requireTenantMember(companyId);
  const { data: existing } = await supabase
    .from("classroom_bookmarks")
    .select("id")
    .eq("student_id", userId)
    .eq("document_id", documentId)
    .maybeSingle();

  if (existing) {
    await supabase.from("classroom_bookmarks").delete().eq("id", existing.id);
    revalidatePath(`/academy/${companySlug}/classroom`);
    return { isBookmarked: false };
  } else {
    await supabase.from("classroom_bookmarks").insert({
      student_id: userId,
      document_id: documentId,
      company_id: companyId,
    });
    revalidatePath(`/academy/${companySlug}/classroom`);
    return { isBookmarked: true };
  }
}

export async function acknowledgeClassDocument(documentId: string, companyId: string, companySlug: string) {
  const { userId, supabase } = await requireTenantMember(companyId);
  const { error } = await supabase
    .from("class_document_acknowledgements")
    .upsert(
      {
        document_id: documentId,
        student_id: userId,
        company_id: companyId,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: "document_id,student_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true };
}

export async function getDocumentAcknowledgements(documentId: string, companyId: string) {
  const { supabase } = await requireTenantTeacher(companyId);
  const { data, error } = await supabase
    .from("class_document_acknowledgements")
    .select(`
      acknowledged_at,
      student:profiles!class_document_acknowledgements_student_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq("document_id", documentId)
    .order("acknowledged_at", { ascending: false });

  if (error) {
    console.error("Failed to load document acknowledgements:", error);
    return [];
  }
  return data ?? [];
}

export async function togglePinClassroomMaterial(materialId: string, companyId: string, companySlug: string) {
  const { supabase } = await requireTenantTeacher(companyId);

  const { data: current } = await supabase
    .from("classroom_materials")
    .select("is_pinned")
    .eq("id", materialId)
    .single();

  if (!current) throw new Error("Material not found");

  const { error } = await supabase
    .from("classroom_materials")
    .update({ is_pinned: !current.is_pinned, updated_at: new Date().toISOString() })
    .eq("id", materialId);

  if (error) throw new Error(error.message);

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { isPinned: !current.is_pinned };
}

export async function deleteClassroomMaterial(materialId: string, companyId: string, companySlug: string) {
  const { supabase } = await requireTenantTeacher(companyId);

  const { data: material } = await supabase
    .from("classroom_materials")
    .select("file_url")
    .eq("id", materialId)
    .single();

  const { error } = await supabase
    .from("classroom_materials")
    .delete()
    .eq("id", materialId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  // Attempt to delete from storage if hosted internally
  if (material?.file_url && material.file_url.includes(BUCKET)) {
    try {
      const parts = material.file_url.split(`${BUCKET}/`);
      if (parts[1]) {
        const serviceClient = createServiceClient();
        await serviceClient.storage.from(BUCKET).remove([parts[1]]);
      }
    } catch (e) {
      console.warn("Storage deletion warning:", e);
    }
  }

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true };
}
