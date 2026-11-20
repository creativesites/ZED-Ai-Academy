import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const CLASSROOM_MATERIALS_BUCKET = "classroom-materials";
export const CLASSROOM_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_CLASSROOM_MIME_TYPES = [
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

/**
 * Ensures the shared classroom-materials bucket exists with permissive classroom
 * file limits and MIME types before signed or server-side uploads run.
 */
export async function ensureClassroomBucket(supabase: SupabaseClient<Database>) {
  const { data: existing } = await supabase.storage.getBucket(CLASSROOM_MATERIALS_BUCKET);
  if (!existing) {
    await supabase.storage
      .createBucket(CLASSROOM_MATERIALS_BUCKET, {
        public: true,
        fileSizeLimit: CLASSROOM_MAX_FILE_BYTES,
        allowedMimeTypes: ALLOWED_CLASSROOM_MIME_TYPES,
      })
      .catch(() => null);
    return;
  }

  await supabase.storage
    .updateBucket(CLASSROOM_MATERIALS_BUCKET, {
      public: true,
      fileSizeLimit: CLASSROOM_MAX_FILE_BYTES,
      allowedMimeTypes: ALLOWED_CLASSROOM_MIME_TYPES,
    })
    .catch(() => null);
}

/**
 * Uploads a Web File to the classroom-materials bucket as a Node Buffer so
 * MIME types and binary payloads succeed reliably across environments.
 */
export async function uploadFileToClassroomBucket(
  supabase: SupabaseClient<Database>,
  filePath: string,
  file: File,
  upsert = false
): Promise<{ publicUrl: string }> {
  if (file.size > CLASSROOM_MAX_FILE_BYTES) {
    throw new Error("File size exceeds 50 MB limit.");
  }

  await ensureClassroomBucket(supabase);

  const bodyBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(CLASSROOM_MATERIALS_BUCKET)
    .upload(filePath, bodyBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage
    .from(CLASSROOM_MATERIALS_BUCKET)
    .getPublicUrl(filePath);

  return { publicUrl: publicData.publicUrl };
}
