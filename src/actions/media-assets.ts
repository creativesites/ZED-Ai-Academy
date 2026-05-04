"use server";

import {
  deleteMediaAsset,
  listMediaAssets,
  updateMediaAssetRecord,
  uploadMediaAssetFile,
} from "@/lib/media-assets";
import type { Json, MediaAsset } from "@/types/database";

function parseMetadata(raw: FormDataEntryValue | null): Json | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as Json;
  } catch {
    throw new Error("Invalid metadata payload");
  }
}

export async function listMediaAssetsAction(limit?: number): Promise<MediaAsset[]> {
  return listMediaAssets(limit);
}

export async function uploadMediaAsset(formData: FormData): Promise<MediaAsset> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Image file is required");
  }

  const folder = formData.get("folder");
  const altText = formData.get("altText");
  const caption = formData.get("caption");
  const metadata = parseMetadata(formData.get("metadata"));

  return uploadMediaAssetFile(file, {
    folder: typeof folder === "string" ? folder : undefined,
    altText: typeof altText === "string" ? altText : null,
    caption: typeof caption === "string" ? caption : null,
    metadata,
  });
}

export async function updateMediaAssetDetails(
  id: string,
  input: { alt_text?: string | null; caption?: string | null; metadata?: Json }
): Promise<MediaAsset> {
  return updateMediaAssetRecord(id, input);
}

export async function deleteMediaAssetAction(id: string): Promise<void> {
  await deleteMediaAsset(id);
}
