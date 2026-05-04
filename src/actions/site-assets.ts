"use server";

import { requireMediaManager, uploadMediaAssetFile } from "@/lib/media-assets";
import type { SiteAsset } from "@/types/database";

export async function listSiteAssets(): Promise<SiteAsset[]> {
  const { supabase } = await requireMediaManager();
  const { data, error } = await supabase
    .from("site_assets")
    .select("*")
    .order("page", { ascending: true })
    .order("key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function updateSiteAssetUrl(id: string, newUrl: string): Promise<SiteAsset> {
  const { supabase } = await requireMediaManager();
  const normalizedUrl = newUrl.trim();

  if (!id) {
    throw new Error("Asset id is required");
  }

  if (!normalizedUrl) {
    throw new Error("Image URL is required");
  }

  const { data, error } = await supabase
    .from("site_assets")
    .update({ url: normalizedUrl, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function uploadSiteAssetImage(formData: FormData): Promise<SiteAsset> {
  const { supabase } = await requireMediaManager();
  const id = formData.get("id");
  const file = formData.get("file");

  if (typeof id !== "string" || !id) {
    throw new Error("Asset id is required");
  }

  if (!(file instanceof File)) {
    throw new Error("Image file is required");
  }

  const mediaAsset = await uploadMediaAssetFile(file, {
    folder: `site-assets/${id}`,
    metadata: {
      source: "site_asset",
      siteAssetId: id,
    },
  });

  const { data, error: updateError } = await supabase
    .from("site_assets")
    .update({ url: mediaAsset.public_url, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    await supabase.from("media_assets").delete().eq("id", mediaAsset.id);
    await supabase.storage.from(mediaAsset.bucket).remove([mediaAsset.path]);
    throw new Error(updateError.message);
  }

  return data;
}
