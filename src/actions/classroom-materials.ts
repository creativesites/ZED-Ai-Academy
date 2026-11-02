"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";

const BUCKET = "classroom-materials";
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

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
  file_url: string | null;
  file_size_bytes: number;
  tags: string[];
  is_pinned: boolean;
  is_published: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
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
  options?: {
    folderId?: string | null;
    cohortId?: string | null;
    search?: string;
    materialType?: string;
    tag?: string;
    sort?: "updated" | "title" | "created";
  }
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
    .eq("company_id", companyId);

  if (options?.folderId) {
    if (options.folderId === "unfiled") {
      query = query.is("folder_id", null);
    } else {
      query = query.eq("folder_id", options.folderId);
    }
  }

  if (options?.cohortId && options.cohortId !== "all") {
    query = query.or(`cohort_id.eq.${options.cohortId},cohort_id.is.null`);
  }

  if (options?.materialType && options.materialType !== "all") {
    query = query.eq("material_type", options.materialType as any);
  }

  if (options?.sort === "title") {
    query = query.order("title", { ascending: true });
  } else if (options?.sort === "created") {
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

  if (options?.search) {
    const s = options.search.toLowerCase();
    list = list.filter(
      (m) =>
        m.title.toLowerCase().includes(s) ||
        (m.description && m.description.toLowerCase().includes(s)) ||
        (m.tags && m.tags.some((t: string) => t.toLowerCase().includes(s)))
    );
  }

  if (options?.tag && options.tag !== "all") {
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

export async function createClassroomMaterial(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const materialType = (formData.get("materialType") as string) || "document";
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

  let fileUrl = externalUrl || null;
  let fileSizeBytes = 0;

  // Handle uploaded file if present
  if (file && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`File size exceeds 50 MB limit`);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const safeName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .toLowerCase()
      .slice(0, 50);
    const uniquePath = `${companyId}/${Date.now()}-${safeName}.${ext}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(uniquePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      // If bucket didn't exist or failed, fallback to public courses_media bucket
      const { error: fallbackError } = await serviceClient.storage
        .from("courses_media")
        .upload(uniquePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (fallbackError) throw new Error(fallbackError.message);
      const { data: publicData } = serviceClient.storage
        .from("courses_media")
        .getPublicUrl(uniquePath);
      fileUrl = publicData.publicUrl;
    } else {
      const { data: publicData } = serviceClient.storage
        .from(BUCKET)
        .getPublicUrl(uniquePath);
      fileUrl = publicData.publicUrl;
    }

    fileSizeBytes = file.size;
  }

  // Parse comma-separated tags
  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const { data: newMaterial, error } = await serviceClient
    .from("classroom_materials")
    .insert({
      company_id: companyId,
      folder_id: folderId && folderId !== "unfiled" ? folderId : null,
      cohort_id: cohortId && cohortId !== "all" ? cohortId : null,
      course_id: courseId && courseId !== "all" ? courseId : null,
      author_id: userId,
      title,
      description,
      material_type: materialType as any,
      file_url: fileUrl,
      file_size_bytes: fileSizeBytes,
      tags,
      is_pinned: isPinned,
      is_published: isPublished,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/academy/${companySlug}/classroom`);
  return newMaterial;
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
