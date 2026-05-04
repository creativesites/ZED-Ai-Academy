"use server";

import { requireMediaManager, uploadMediaAssetFile } from "@/lib/media-assets";
import type { Database } from "@/types/database";

export async function updateBlogPostImages(
  id: string,
  input: Pick<
    Database["public"]["Tables"]["blog_posts"]["Update"],
    "card_image_url" | "card_media_asset_id" | "hero_image_url" | "hero_media_asset_id"
  >
) {
  const { supabase } = await requireMediaManager();
  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      ...input,
      card_image_url: input.card_image_url?.trim() || null,
      hero_image_url: input.hero_image_url?.trim() || null,
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

export async function uploadBlogPostImage(formData: FormData) {
  const postId = formData.get("postId");
  const target = formData.get("target");
  const file = formData.get("file");

  if (typeof postId !== "string" || !postId) {
    throw new Error("Post id is required");
  }

  if (target !== "card" && target !== "hero") {
    throw new Error("Image target is required");
  }

  if (!(file instanceof File)) {
    throw new Error("Image file is required");
  }

  const mediaAsset = await uploadMediaAssetFile(file, {
    folder: `blog-posts/${postId}/${target}`,
    metadata: {
      source: "blog_post",
      postId,
      target,
    },
  });

  return updateBlogPostImages(
    postId,
    target === "card"
      ? { card_image_url: null, card_media_asset_id: mediaAsset.id }
      : { hero_image_url: null, hero_media_asset_id: mediaAsset.id }
  );
}
