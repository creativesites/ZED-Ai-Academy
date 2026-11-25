"use server";

import { toActionResult } from "@/lib/actions/result";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/** Course media needs course-manage rights; shared assets (logos, banners) need any staff role. */
async function assertCanUploadTo(userId: string, courseId: string) {
  const supabase = createServiceClient();
  if (UUID_RE.test(courseId)) {
    await assertCanManageCourse(supabase, courseId, userId);
    return;
  }
  if (!SAFE_SEGMENT.test(courseId)) throw new Error("Invalid upload location.");
  const [{ data: profile }, { data: staffRows }, { data: owned }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("company_members")
      .select("role")
      .eq("profile_id", userId)
      .eq("status", "active")
      .neq("role", "learner")
      .limit(1),
    supabase.from("companies").select("id").eq("admin_id", userId).limit(1),
  ]);
  const isStaff =
    (profile?.role && profile.role !== "learner") || (staffRows?.length ?? 0) > 0 || (owned?.length ?? 0) > 0;
  if (!isStaff) throw new Error("Only academy staff can upload files here.");
}

function buildPath(courseId: string, folder: string, fileName: string) {
  const safeFolder = SAFE_SEGMENT.test(folder) ? folder : "misc";
  const ext = (fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return `${courseId}/${safeFolder}/${uniqueName}`;
}

/**
 * Step 1 of a direct upload: returns a one-time signed upload token so the browser sends the file
 * straight to Supabase Storage. Files never pass through a Vercel function (4.5 MB body limit).
 */
async function createMediaUploadImpl(input: {
  courseId: string;
  folder: string;
  fileName: string;
  size: number;
  contentType: string;
}): Promise<{ path: string; token: string; publicUrl: string; bucket: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Please sign in again to upload files.");
  if (!input.courseId) throw new Error("Missing upload location.");
  const isImage = input.contentType.startsWith("image/");
  const limit = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (!(input.size > 0)) throw new Error("That file is empty.");
  if (input.size > limit) throw new Error(`File exceeds ${isImage ? "5 MB" : "25 MB"} limit`);

  await assertCanUploadTo(userId, input.courseId);

  const supabase = createServiceClient();
  const path = buildPath(input.courseId, input.folder || "misc", input.fileName);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Could not start the upload.");
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, token: data.token, publicUrl: pub.publicUrl, bucket: BUCKET };
}

const BUCKET = "courses_media";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_FILE_BYTES  = 25 * 1024 * 1024;  // 25 MB

async function uploadMediaImpl(formData: FormData): Promise<{ url: string; name: string; size: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;
  const folder = (formData.get("folder") as string | null) ?? "misc";

  if (!file || !courseId) throw new Error("Missing file or courseId");
  await assertCanUploadTo(userId, courseId);

  const isImage = file.type.startsWith("image/");
  const limit = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.size > limit) {
    throw new Error(`File exceeds ${isImage ? "5 MB" : "25 MB"} limit`);
  }

  const path = buildPath(courseId, folder, file.name);

  const buffer = await file.arrayBuffer();
  const supabase = createServiceClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size };
}

async function deleteMediaImpl(path: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

// ── Public actions: return { ok, data | error } so the real error reaches the author. ──
export async function uploadMedia(...args: Parameters<typeof uploadMediaImpl>) {
  return toActionResult("uploadMedia", () => uploadMediaImpl(...args));
}

export async function deleteMedia(...args: Parameters<typeof deleteMediaImpl>) {
  return toActionResult("deleteMedia", () => deleteMediaImpl(...args));
}

export async function createMediaUpload(...args: Parameters<typeof createMediaUploadImpl>) {
  return toActionResult("createMediaUpload", () => createMediaUploadImpl(...args));
}
