"use client";

import { createMediaUpload } from "@/actions/upload";
import { unwrapAction } from "@/lib/actions/unwrap";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads a file for a course (or shared academy assets) directly to Supabase Storage using a
 * signed upload token from the server, so large files avoid Vercel's 4.5 MB request limit.
 */
export async function uploadCourseMedia(
  file: File,
  courseId: string,
  folder: string,
): Promise<{ url: string; name: string; size: number }> {
  const ticket = await unwrapAction(
    createMediaUpload({
      courseId,
      folder,
      fileName: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  );
  const { error } = await createClient()
    .storage.from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { url: ticket.publicUrl, name: file.name, size: file.size };
}
