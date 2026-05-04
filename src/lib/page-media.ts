import type { MediaAsset, PageMediaSlot } from "@/types/database";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

export type ResolvedPageMediaSlot = PageMediaSlot & {
  resolved_url: string | null;
  resolved_alt_text: string | null;
  media_asset: Pick<MediaAsset, "id" | "public_url" | "alt_text" | "caption"> | null;
};

function resolveSlot(
  slot: PageMediaSlot,
  asset: Pick<MediaAsset, "id" | "public_url" | "alt_text" | "caption"> | null
): ResolvedPageMediaSlot {
  return {
    ...slot,
    resolved_url: asset?.public_url ?? slot.image_url,
    resolved_alt_text: slot.alt_text ?? asset?.alt_text ?? null,
    media_asset: asset,
  };
}

async function fetchMediaAssetsByIds(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, Pick<MediaAsset, "id" | "public_url" | "alt_text" | "caption">>();
  }

  const supabase = createBrowserClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, public_url, alt_text, caption")
    .in("id", ids);

  return new Map(
    (data ?? []).map((asset) => [asset.id, asset as Pick<MediaAsset, "id" | "public_url" | "alt_text" | "caption">])
  );
}

export async function getResolvedPageMediaSlots(pageKey?: string): Promise<ResolvedPageMediaSlot[]> {
  const supabase = createBrowserClient();
  let query = supabase
    .from("page_media_slots")
    .select("*")
    .order("page_key", { ascending: true })
    .order("slot_key", { ascending: true });

  if (pageKey) {
    query = query.eq("page_key", pageKey);
  }

  const { data } = await query;
  const slots = (data ?? []) as PageMediaSlot[];
  const mediaIds = slots.map((slot) => slot.media_asset_id).filter(Boolean) as string[];
  const assetsById = await fetchMediaAssetsByIds(mediaIds);

  return slots.map((slot) =>
    resolveSlot(slot, slot.media_asset_id ? assetsById.get(slot.media_asset_id) ?? null : null)
  );
}

export async function getResolvedPageMediaSlot(
  pageKey: string,
  slotKey: string,
  fallbackUrl: string
): Promise<{ url: string; altText: string | null }> {
  const supabase = createBrowserClient();
  const { data } = await supabase
    .from("page_media_slots")
    .select("*")
    .eq("page_key", pageKey)
    .eq("slot_key", slotKey)
    .maybeSingle();

  const slot = data as PageMediaSlot | null;
  if (!slot) {
    return { url: fallbackUrl, altText: null };
  }

  if (slot.media_asset_id) {
    const assetsById = await fetchMediaAssetsByIds([slot.media_asset_id]);
    const asset = assetsById.get(slot.media_asset_id) ?? null;
    return {
      url: asset?.public_url ?? slot.image_url ?? fallbackUrl,
      altText: slot.alt_text ?? asset?.alt_text ?? null,
    };
  }

  return { url: slot.image_url ?? fallbackUrl, altText: slot.alt_text ?? null };
}
