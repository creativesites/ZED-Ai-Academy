"use server";

import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";
import { requireTenantStaff } from "@/lib/authz/context-server";

const BUCKET = "courses_media";
// Server Action bodies are capped at 4 MB (Vercel rejects > 4.5 MB), so keep files under that.
// Larger resources should go through a signed direct-to-storage upload instead.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Extension → content type we serve the file as. Anything not listed is rejected.
 * SVG and HTML are deliberately excluded: the bucket is public and they can carry script.
 */
const ALLOWED: Record<string, { type: string; image: boolean }> = {
  jpg: { type: "image/jpeg", image: true },
  jpeg: { type: "image/jpeg", image: true },
  png: { type: "image/png", image: true },
  webp: { type: "image/webp", image: true },
  gif: { type: "image/gif", image: true },
  avif: { type: "image/avif", image: true },
  pdf: { type: "application/pdf", image: false },
  zip: { type: "application/zip", image: false },
  csv: { type: "text/csv", image: false },
  txt: { type: "text/plain", image: false },
  md: { type: "text/markdown", image: false },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", image: false },
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", image: false },
  pptx: { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", image: false },
};

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const SITE_ASSETS = "site-assets";
const SITE_PREFIX = "site-";

type SupabaseService = ReturnType<typeof createServiceClient>;

/**
 * Work out (and authorise) the top-level storage folder for an upload.
 * - A course id → the caller must be able to manage that course.
 * - "site-assets" + tenantSlug → academy branding/site images; caller must be academy staff.
 *   Stored under `site-<companyId>/…` so each academy's files are separate.
 */
async function authorizeScope(supabase: SupabaseService, userId: string, scope: string, tenantSlug: string | null) {
  if (scope === SITE_ASSETS) {
    if (!tenantSlug) throw new Error("Missing academy");
    const { data: company } = await supabase.from("companies").select("id").eq("slug", tenantSlug).maybeSingle();
    if (!company) throw new Error("Academy not found");
    await requireTenantStaff(company.id, userId);
    return `${SITE_PREFIX}${company.id}`;
  }
  const course = await assertCanManageCourse(supabase, scope, userId);
  return course.id;
}

export async function uploadMedia(formData: FormData): Promise<{ url: string; name: string; size: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;
  const folder = (formData.get("folder") as string | null) ?? "misc";
  const tenantSlug = (formData.get("tenantSlug") as string | null) || null;

  if (!file || !courseId) throw new Error("Missing file or courseId");
  if (!SAFE_SEGMENT.test(folder)) throw new Error("Invalid folder");

  const supabase = createServiceClient();
  // Only people who can edit this course (or this academy's site) may upload into it.
  const root = await authorizeScope(supabase, userId, courseId, tenantSlug);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const kind = ALLOWED[ext];
  if (!kind) {
    throw new Error("This file type isn't supported. Use an image, PDF, Office document, CSV, TXT, MD or ZIP.");
  }
  const limit = kind.image ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.size > limit) {
    throw new Error("File exceeds the 4 MB upload limit. Compress it or link to it instead.");
  }

  const uniqueName = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const path = `${root}/${folder}/${uniqueName}`;

  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: kind.type, upsert: false });

  if (error) {
    console.error("[upload] storage upload failed", error);
    throw new Error("Upload failed. Please try again.");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size };
}

export async function deleteMedia(path: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Paths are `${courseId | site-<companyId>}/${folder}/${file}`. Only someone who can manage
  // that course (or that academy) may delete.
  const segments = (path ?? "").split("/");
  if (segments.length !== 3 || segments.some((s) => !s || s === "." || s === "..")) {
    throw new Error("Invalid path");
  }
  const supabase = createServiceClient();
  if (segments[0].startsWith(SITE_PREFIX)) {
    await requireTenantStaff(segments[0].slice(SITE_PREFIX.length), userId);
  } else {
    await assertCanManageCourse(supabase, segments[0], userId);
  }

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("[upload] storage delete failed", error);
    throw new Error("Delete failed. Please try again.");
  }
}
