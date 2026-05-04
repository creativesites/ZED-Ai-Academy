"use server";

import { requireMediaManager, uploadMediaAssetFile } from "@/lib/media-assets";
import type { Database, PageMediaSlot } from "@/types/database";

export async function updatePageMediaSlot(
  id: string,
  input: Pick<Database["public"]["Tables"]["page_media_slots"]["Update"], "image_url" | "alt_text" | "media_asset_id">
): Promise<PageMediaSlot> {
  const { supabase } = await requireMediaManager();
  const { data, error } = await supabase
    .from("page_media_slots")
    .update({
      ...input,
      image_url: input.image_url?.trim() || null,
      alt_text: input.alt_text?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function uploadPageMediaSlotImage(formData: FormData): Promise<PageMediaSlot> {
  const slotId = formData.get("slotId");
  const file = formData.get("file");

  if (typeof slotId !== "string" || !slotId) {
    throw new Error("Slot id is required");
  }

  if (!(file instanceof File)) {
    throw new Error("Image file is required");
  }

  const mediaAsset = await uploadMediaAssetFile(file, {
    folder: `page-slots/${slotId}`,
    metadata: {
      source: "page_media_slot",
      slotId,
    },
  });

  return updatePageMediaSlot(slotId, {
    image_url: null,
    media_asset_id: mediaAsset.id,
  });
}
