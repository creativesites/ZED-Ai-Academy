"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "courses_media";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_FILE_BYTES  = 25 * 1024 * 1024;  // 25 MB

export async function uploadMedia(formData: FormData): Promise<{ url: string; name: string; size: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;
  const folder = (formData.get("folder") as string | null) ?? "misc";

  if (!file || !courseId) throw new Error("Missing file or courseId");

  const isImage = file.type.startsWith("image/");
  const limit = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.size > limit) {
    throw new Error(`File exceeds ${isImage ? "5 MB" : "25 MB"} limit`);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${courseId}/${folder}/${uniqueName}`;

  const buffer = await file.arrayBuffer();
  const supabase = createServiceClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size };
}

export async function deleteMedia(path: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}
