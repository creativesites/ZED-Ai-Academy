import { MediaManager } from "@/components/admin/media-manager";
import { listMediaAssets } from "@/lib/media-assets";
import { listPageMediaSlotsForAdmin } from "@/lib/page-media-admin";
import { listBlogPostsForAdmin } from "@/lib/blog-posts";

export default async function AdminImagesPage() {
  const [mediaAssets, pageSlots, blogPosts] = await Promise.all([
    listMediaAssets(),
    listPageMediaSlotsForAdmin(),
    listBlogPostsForAdmin(),
  ]);

  return (
    <MediaManager
      initialMediaAssets={mediaAssets}
      initialPageSlots={pageSlots}
      initialBlogPosts={blogPosts}
    />
  );
}
