import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const CLASSROOM_MATERIALS_BUCKET = "classroom-materials";
export const CLASSROOM_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

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
 * Ensures the shared classroom-materials bucket exists as a PRIVATE bucket
 * with classroom file limits and MIME types.
 */
export async function ensureClassroomBucket(supabase: SupabaseClient<Database>) {
  const { data: existing } = await supabase.storage.getBucket(CLASSROOM_MATERIALS_BUCKET);
  if (!existing) {
    await supabase.storage
      .createBucket(CLASSROOM_MATERIALS_BUCKET, {
        public: false,
        fileSizeLimit: CLASSROOM_MAX_FILE_BYTES,
        allowedMimeTypes: ALLOWED_CLASSROOM_MIME_TYPES,
      })
      .catch(() => null);
    return;
  }

  if (existing.public !== false) {
    await supabase.storage
      .updateBucket(CLASSROOM_MATERIALS_BUCKET, {
        public: false,
        fileSizeLimit: CLASSROOM_MAX_FILE_BYTES,
        allowedMimeTypes: ALLOWED_CLASSROOM_MIME_TYPES,
      })
      .catch(() => null);
  }
}

/**
 * Extracts the bucket-relative storage path from a raw path or a Supabase Storage URL
 * (public or signed) for `classroom-materials`. Returns `null` for external links.
 */
export function extractClassroomStoragePath(
  storedUrlOrPath: string | null | undefined
): string | null {
  if (!storedUrlOrPath) return null;
  const trimmed = storedUrlOrPath.trim();
  if (!trimmed) return null;

  // Raw storage path (not an http(s) URL)
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  // Match Supabase Storage public/authenticated/sign URLs for this bucket
  const match = trimmed.match(
    /\/storage\/v1\/object\/(?:public|authenticated|sign)\/classroom-materials\/([^?#]+)/i
  );
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return null;
}

/**
 * Batch-signs all classroom-materials storage URLs/paths in a single Storage API call.
 * External URLs (YouTube, GitHub, Google Drive, etc.) are left untouched.
 */
export async function signClassroomStorageUrls(
  serviceClient: SupabaseClient<Database>,
  values: Array<string | null | undefined>,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const pathToOriginals = new Map<string, string[]>();

  for (const raw of values) {
    if (!raw) continue;
    const path = extractClassroomStoragePath(raw);
    if (!path) continue;
    const list = pathToOriginals.get(path) || [];
    list.push(raw);
    pathToOriginals.set(path, list);
  }

  const uniquePaths = Array.from(pathToOriginals.keys());
  if (uniquePaths.length === 0) return result;

  try {
    const { data, error } = await serviceClient.storage
      .from(CLASSROOM_MATERIALS_BUCKET)
      .createSignedUrls(uniquePaths, expiresInSeconds);

    if (error || !data) {
      console.error("Failed to sign classroom storage URLs:", error);
      return result;
    }

    for (const item of data) {
      if (!item.path || !item.signedUrl) continue;
      const originals = pathToOriginals.get(item.path) || [];
      for (const orig of originals) {
        result.set(orig, item.signedUrl);
      }
    }
  } catch (err) {
    console.error("Unexpected error signing classroom storage URLs:", err);
  }

  return result;
}

/**
 * Uploads a Web File to the private classroom-materials bucket as a Node Buffer so
 * MIME types and binary payloads succeed reliably across environments.
 * Returns the canonical storage path (stored in DB and signed on read).
 */
export async function uploadFileToClassroomBucket(
  supabase: SupabaseClient<Database>,
  filePath: string,
  file: File,
  upsert = false
): Promise<{ path: string; publicUrl: string }> {
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

  return { path: filePath, publicUrl: filePath };
}
