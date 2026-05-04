import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database, Json, MediaAsset } from "@/types/database";

export const MEDIA_BUCKET = "media-assets";
export const MAX_MEDIA_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_MEDIA_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);

export type MediaAssetUploadOptions = {
  folder?: string;
  altText?: string | null;
  caption?: string | null;
  metadata?: Json | null;
};

export type MediaAssetUpdateInput = {
  alt_text?: string | null;
  caption?: string | null;
  metadata?: Json;
  updated_at?: string;
};

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function sanitizeMediaFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function requireMediaManager() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const supabase = createServiceClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!["super_admin", "instructor"].includes(profile?.role ?? "")) {
    throw new Error("Forbidden");
  }

  return { supabase, userId };
}

export async function listMediaAssets(limit?: number): Promise<MediaAsset[]> {
  const { supabase } = await requireMediaManager();

  let query = supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getMediaAssetById(id: string): Promise<MediaAsset | null> {
  const { supabase } = await requireMediaManager();
  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createMediaAssetRecord(
  input: Omit<
    Database["public"]["Tables"]["media_assets"]["Insert"],
    "id" | "created_at" | "updated_at"
  >
): Promise<MediaAsset> {
  const { supabase } = await requireMediaManager();
  const { data, error } = await supabase
    .from("media_assets")
    .insert(input)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateMediaAssetRecord(
  id: string,
  input: MediaAssetUpdateInput
): Promise<MediaAsset> {
  const { supabase } = await requireMediaManager();
  const { data, error } = await supabase
    .from("media_assets")
    .update({
      ...input,
      alt_text: normalizeText(input.alt_text),
      caption: normalizeText(input.caption),
      updated_at: input.updated_at ?? new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function uploadMediaAssetFile(
  file: File,
  options: MediaAssetUploadOptions = {}
): Promise<MediaAsset> {
  const { supabase, userId } = await requireMediaManager();

  if (!ALLOWED_MEDIA_IMAGE_TYPES.has(file.type)) {
    throw new Error("Unsupported image type");
  }

  if (file.size > MAX_MEDIA_IMAGE_BYTES) {
    throw new Error("Image exceeds 8 MB limit");
  }

  const sanitizedName = sanitizeMediaFileName(file.name) || "image";
  const folder = options.folder?.replace(/^\/+|\/+$/g, "") || "library";
  const path = `${folder}/${Date.now()}-${sanitizedName}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      bucket: MEDIA_BUCKET,
      path,
      public_url: publicUrl,
      file_name: path.split("/").pop() ?? sanitizedName,
      original_name: file.name,
      alt_text: normalizeText(options.altText),
      caption: normalizeText(options.caption),
      mime_type: file.type,
      size_bytes: file.size,
      metadata: options.metadata ?? {},
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteMediaAsset(id: string): Promise<void> {
  const { supabase } = await requireMediaManager();

  const { data: existing, error: fetchError } = await supabase
    .from("media_assets")
    .select("bucket, path")
    .eq("id", id)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const { error: deleteError } = await supabase
    .from("media_assets")
    .delete()
    .eq("id", id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: storageError } = await supabase.storage
    .from(existing.bucket)
    .remove([existing.path]);

  if (storageError) {
    throw new Error(storageError.message);
  }
}
