import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { Database, Json, MediaAsset } from "@/types/database";
import { DEFAULT_BLOG_POSTS, serializeBlogContent, type BlogContentBlock } from "@/lib/default-blog-posts";

export type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];

export type ResolvedBlogPost = BlogPostRow & {
  card_image_src: string | null;
  hero_image_src: string | null;
  content_blocks: BlogContentBlock[];
};

function resolveMediaUrl(
  asset: Pick<MediaAsset, "public_url"> | null,
  fallbackUrl: string | null
) {
  return asset?.public_url ?? fallbackUrl;
}

function mapBlogPost(
  post: BlogPostRow,
  cardAsset: Pick<MediaAsset, "public_url"> | null,
  heroAsset: Pick<MediaAsset, "public_url"> | null
): ResolvedBlogPost {
  return {
    ...post,
    card_image_src: resolveMediaUrl(cardAsset, post.card_image_url),
    hero_image_src: resolveMediaUrl(heroAsset, post.hero_image_url),
    content_blocks: (post.content as unknown as BlogContentBlock[]) ?? [],
  };
}

async function ensureDefaultBlogPosts() {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("blog_posts")
    .select("*", { head: true, count: "exact" });

  if ((count ?? 0) > 0) {
    return;
  }

  await supabase.from("blog_posts").insert(
    DEFAULT_BLOG_POSTS.map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      author_name: post.author_name,
      read_time: post.read_time,
      tags: post.tags as unknown as Json,
      content: serializeBlogContent(post.content),
      card_image_url: post.card_image_url,
      hero_image_url: post.hero_image_url,
      status: "published",
      published_at: post.published_at,
    }))
  );
}

async function fetchMediaAssetMap(ids: string[]) {
  const supabase = createServiceClient();
  if (ids.length === 0) {
    return new Map<string, Pick<MediaAsset, "public_url">>();
  }

  const { data } = await supabase
    .from("media_assets")
    .select("id, public_url")
    .in("id", ids);

  return new Map((data ?? []).map((asset) => [asset.id, asset as Pick<MediaAsset, "public_url">]));
}

export async function listPublishedBlogPosts(limit?: number): Promise<ResolvedBlogPost[]> {
  await ensureDefaultBlogPosts();

  const supabase = createServiceClient();
  let query = supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data } = await query;
  const posts = (data ?? []) as BlogPostRow[];
  const mediaIds = posts
    .flatMap((post) => [post.card_media_asset_id, post.hero_media_asset_id])
    .filter(Boolean) as string[];
  const mediaMap = await fetchMediaAssetMap(mediaIds);

  return posts.map((post) =>
    mapBlogPost(
      post,
      post.card_media_asset_id ? mediaMap.get(post.card_media_asset_id) ?? null : null,
      post.hero_media_asset_id ? mediaMap.get(post.hero_media_asset_id) ?? null : null
    )
  );
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<ResolvedBlogPost | null> {
  await ensureDefaultBlogPosts();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const post = data as BlogPostRow | null;
  if (!post) {
    return null;
  }

  const mediaIds = [post.card_media_asset_id, post.hero_media_asset_id].filter(Boolean) as string[];
  const mediaMap = await fetchMediaAssetMap(mediaIds);

  return mapBlogPost(
    post,
    post.card_media_asset_id ? mediaMap.get(post.card_media_asset_id) ?? null : null,
    post.hero_media_asset_id ? mediaMap.get(post.hero_media_asset_id) ?? null : null
  );
}

export async function listBlogPostsForAdmin(): Promise<ResolvedBlogPost[]> {
  await ensureDefaultBlogPosts();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .order("published_at", { ascending: false });

  const posts = (data ?? []) as BlogPostRow[];
  const mediaIds = posts
    .flatMap((post) => [post.card_media_asset_id, post.hero_media_asset_id])
    .filter(Boolean) as string[];
  const mediaMap = await fetchMediaAssetMap(mediaIds);

  return posts.map((post) =>
    mapBlogPost(
      post,
      post.card_media_asset_id ? mediaMap.get(post.card_media_asset_id) ?? null : null,
      post.hero_media_asset_id ? mediaMap.get(post.hero_media_asset_id) ?? null : null
    )
  );
}
