import "server-only";

import type { MediaAsset } from "@/types/database";
import { createServiceClient } from "@/lib/supabase/server";
import type { ResolvedPageMediaSlot } from "@/lib/page-media";

export async function listPageMediaSlotsForAdmin(): Promise<ResolvedPageMediaSlot[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("page_media_slots")
    .select("*")
    .order("page_key", { ascending: true })
    .order("slot_key", { ascending: true });

  const slots = data ?? [];
  const mediaIds = slots.map((slot) => slot.media_asset_id).filter(Boolean) as string[];
  const { data: mediaAssets } = mediaIds.length === 0
    ? { data: [] as Pick<MediaAsset, "id" | "public_url" | "alt_text" | "caption">[] }
    : await supabase
        .from("media_assets")
        .select("id, public_url, alt_text, caption")
        .in("id", mediaIds);

  const assetsById = new Map(
    (mediaAssets ?? []).map((asset) => [asset.id, asset as Pick<MediaAsset, "id" | "public_url" | "alt_text" | "caption">])
  );

  return slots.map((slot) => ({
    ...slot,
    resolved_url: slot.media_asset_id ? assetsById.get(slot.media_asset_id)?.public_url ?? slot.image_url : slot.image_url,
    resolved_alt_text: slot.alt_text ?? (slot.media_asset_id ? assetsById.get(slot.media_asset_id)?.alt_text ?? null : null),
    media_asset: slot.media_asset_id ? assetsById.get(slot.media_asset_id) ?? null : null,
  }));
}
