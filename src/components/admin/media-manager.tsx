"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  FileImage,
  Image as ImageIcon,
  LayoutPanelTop,
  Newspaper,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { uploadMediaAsset, updateMediaAssetDetails, listMediaAssetsAction } from "@/actions/media-assets";
import { updatePageMediaSlot, uploadPageMediaSlotImage } from "@/actions/page-media";
import { updateBlogPostImages, uploadBlogPostImage } from "@/actions/blog-posts";
import type { MediaAsset, PageMediaSlot, BlogPost } from "@/types/database";
import type { ResolvedPageMediaSlot } from "@/lib/page-media";
import type { ResolvedBlogPost } from "@/lib/blog-posts";

type Props = {
  initialMediaAssets: MediaAsset[];
  initialPageSlots: ResolvedPageMediaSlot[];
  initialBlogPosts: ResolvedBlogPost[];
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type MediaSummary = Pick<MediaAsset, "id" | "public_url" | "alt_text" | "caption">;

function resolvePageSlot(
  slot: PageMediaSlot,
  mediaAssets: MediaAsset[]
): ResolvedPageMediaSlot {
  const mediaAsset = slot.media_asset_id
    ? mediaAssets.find((asset) => asset.id === slot.media_asset_id)
    : null;

  const mediaSummary = mediaAsset
    ? ({
        id: mediaAsset.id,
        public_url: mediaAsset.public_url,
        alt_text: mediaAsset.alt_text,
        caption: mediaAsset.caption,
      } satisfies MediaSummary)
    : null;

  return {
    ...slot,
    resolved_url: mediaSummary?.public_url ?? slot.image_url,
    resolved_alt_text: slot.alt_text ?? mediaSummary?.alt_text ?? null,
    media_asset: mediaSummary,
  };
}

function resolveBlogPost(
  post: BlogPost,
  mediaAssets: MediaAsset[]
): ResolvedBlogPost {
  const cardMedia = post.card_media_asset_id
    ? mediaAssets.find((asset) => asset.id === post.card_media_asset_id)
    : null;
  const heroMedia = post.hero_media_asset_id
    ? mediaAssets.find((asset) => asset.id === post.hero_media_asset_id)
    : null;

  return {
    ...post,
    card_image_src: cardMedia?.public_url ?? post.card_image_url,
    hero_image_src: heroMedia?.public_url ?? post.hero_image_url,
    content_blocks: post.content as ResolvedBlogPost["content_blocks"],
  };
}

export function MediaManager({
  initialMediaAssets,
  initialPageSlots,
  initialBlogPosts,
}: Props) {
  const [mediaAssets, setMediaAssets] = useState(initialMediaAssets);
  const [pageSlots, setPageSlots] = useState(initialPageSlots);
  const [blogPosts, setBlogPosts] = useState(initialBlogPosts);
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("library");
  const [isPending, startTransition] = useTransition();

  const [slotSelections, setSlotSelections] = useState<Record<string, string>>({});
  const [blogCardSelections, setBlogCardSelections] = useState<Record<string, string>>({});
  const [blogHeroSelections, setBlogHeroSelections] = useState<Record<string, string>>({});

  async function refreshMediaAssets() {
    const nextMediaAssets = await listMediaAssetsAction();
    setMediaAssets(nextMediaAssets);
    return nextMediaAssets;
  }

  const filteredMediaAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return mediaAssets;

    return mediaAssets.filter((asset) =>
      [asset.file_name, asset.original_name, asset.alt_text, asset.caption]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [mediaAssets, search]);

  function withPending(key: string, work: () => Promise<void>) {
    setPendingKey(key);
    startTransition(async () => {
      try {
        await work();
      } finally {
        setPendingKey(null);
      }
    });
  }

  function updatePageSlotState(updatedSlot: PageMediaSlot, assets: MediaAsset[] = mediaAssets) {
    setPageSlots((current) =>
      current.map((slot) => (slot.id === updatedSlot.id ? resolvePageSlot(updatedSlot, assets) : slot))
    );
  }

  function updateBlogPostState(updatedPost: BlogPost, assets: MediaAsset[] = mediaAssets) {
    setBlogPosts((current) =>
      current.map((post) => (post.id === updatedPost.id ? resolveBlogPost(updatedPost, assets) : post))
    );
  }

  function handleLibraryUpload(file: File) {
    withPending("library-upload", async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "library");
        await uploadMediaAsset(formData);
        const nextAssets = await refreshMediaAssets();
        setMediaAssets(nextAssets);
        toast.success("Image added to media library");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Upload failed"));
      }
    });
  }

  function handleAssetDetailsUpdate(
    asset: MediaAsset,
    patch: { alt_text?: string | null; caption?: string | null }
  ) {
    withPending(`asset-${asset.id}`, async () => {
      try {
        const updated = await updateMediaAssetDetails(asset.id, patch);
        setMediaAssets((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
        toast.success("Media details updated");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Update failed"));
      }
    });
  }

  function handlePageSlotUrlUpdate(slot: ResolvedPageMediaSlot, nextUrl: string) {
    withPending(`slot-url-${slot.id}`, async () => {
      try {
        const updated = await updatePageMediaSlot(slot.id, {
          image_url: nextUrl,
          media_asset_id: null,
          alt_text: slot.alt_text,
        });
        updatePageSlotState(updated);
        toast.success("Page image updated");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Update failed"));
      }
    });
  }

  function handlePageSlotAltUpdate(slot: ResolvedPageMediaSlot, nextAlt: string) {
    withPending(`slot-alt-${slot.id}`, async () => {
      try {
        const updated = await updatePageMediaSlot(slot.id, {
          image_url: slot.image_url,
          media_asset_id: slot.media_asset_id,
          alt_text: nextAlt,
        });
        updatePageSlotState(updated);
        toast.success("Alt text updated");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Update failed"));
      }
    });
  }

  function handleAssignPageSlotMedia(slot: ResolvedPageMediaSlot) {
    const mediaAssetId = slotSelections[slot.id];
    if (!mediaAssetId) return;

    withPending(`slot-assign-${slot.id}`, async () => {
      try {
        const updated = await updatePageMediaSlot(slot.id, {
          image_url: slot.image_url,
          media_asset_id: mediaAssetId,
          alt_text: slot.alt_text,
        });
        updatePageSlotState(updated);
        toast.success("Page slot linked to media library image");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Assignment failed"));
      }
    });
  }

  function handleUploadPageSlotMedia(slot: ResolvedPageMediaSlot, file: File) {
    withPending(`slot-upload-${slot.id}`, async () => {
      try {
        const formData = new FormData();
        formData.append("slotId", slot.id);
        formData.append("file", file);
        const updated = await uploadPageMediaSlotImage(formData);
        const nextAssets = await refreshMediaAssets();
        updatePageSlotState(updated, nextAssets);
        toast.success("Page slot image uploaded");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Upload failed"));
      }
    });
  }

  function handleUpdateBlogPostUrl(
    post: ResolvedBlogPost,
    target: "card" | "hero",
    nextUrl: string
  ) {
    withPending(`post-url-${post.id}-${target}`, async () => {
      try {
        const updated = await updateBlogPostImages(
          post.id,
          target === "card"
            ? {
                card_image_url: nextUrl,
                card_media_asset_id: null,
              }
            : {
                hero_image_url: nextUrl,
                hero_media_asset_id: null,
              }
        );
        updateBlogPostState(updated);
        toast.success("Blog image updated");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Update failed"));
      }
    });
  }

  function handleAssignBlogPostMedia(post: ResolvedBlogPost, target: "card" | "hero") {
    const selectionMap = target === "card" ? blogCardSelections : blogHeroSelections;
    const mediaAssetId = selectionMap[post.id];
    if (!mediaAssetId) return;

    withPending(`post-assign-${post.id}-${target}`, async () => {
      try {
        const updated = await updateBlogPostImages(
          post.id,
          target === "card"
            ? {
                card_image_url: post.card_image_url,
                card_media_asset_id: mediaAssetId,
              }
            : {
                hero_image_url: post.hero_image_url,
                hero_media_asset_id: mediaAssetId,
              }
        );
        updateBlogPostState(updated);
        toast.success("Blog post linked to media library image");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Assignment failed"));
      }
    });
  }

  function handleUploadBlogPostMedia(
    post: ResolvedBlogPost,
    target: "card" | "hero",
    file: File
  ) {
    withPending(`post-upload-${post.id}-${target}`, async () => {
      try {
        const formData = new FormData();
        formData.append("postId", post.id);
        formData.append("target", target);
        formData.append("file", file);
        const updated = await uploadBlogPostImage(formData);
        const nextAssets = await refreshMediaAssets();
        updateBlogPostState(updated, nextAssets);
        toast.success("Blog post image uploaded");
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Upload failed"));
      }
    });
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-bold text-[#062e39] tracking-tight">Media Management</h1>
          <p className="text-slate-500 mt-2">
            Manage the shared media library, assign marketing page images, and control blog card and hero visuals.
          </p>
        </div>
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search library by filename, alt text, caption..."
            className="pl-10 rounded-xl bg-white border-slate-200"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8 h-auto flex flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger value="library" className="rounded-full border border-slate-200 data-[state=active]:bg-[#062e39] data-[state=active]:text-white px-5 py-2">
            <FileImage className="mr-2 h-4 w-4" />
            Media Library
          </TabsTrigger>
          <TabsTrigger value="pages" className="rounded-full border border-slate-200 data-[state=active]:bg-[#062e39] data-[state=active]:text-white px-5 py-2">
            <LayoutPanelTop className="mr-2 h-4 w-4" />
            Marketing Pages
          </TabsTrigger>
          <TabsTrigger value="blog" className="rounded-full border border-slate-200 data-[state=active]:bg-[#062e39] data-[state=active]:text-white px-5 py-2">
            <Newspaper className="mr-2 h-4 w-4" />
            Blog Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-6">
          <Card className="border-0 shadow-lg rounded-[2rem]">
            <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#062e39]">Upload New Library Image</h2>
                <p className="text-sm text-slate-500">Add reusable images once, then assign them to pages or blog posts.</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleLibraryUpload(file);
                    event.target.value = "";
                  }}
                  disabled={isPending}
                />
                <div className={`inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-[#062e39] text-white font-bold ${pendingKey === "library-upload" ? "opacity-60 pointer-events-none" : ""}`}>
                  {pendingKey === "library-upload" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload Image
                </div>
              </label>
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredMediaAssets.map((asset) => (
              <Card key={asset.id} className="border-0 rounded-[2rem] shadow-lg overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-slate-100 aspect-[4/3] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.public_url} alt={asset.alt_text ?? asset.file_name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[#062e39] truncate">{asset.original_name}</p>
                        <p className="text-xs text-slate-400 truncate">{asset.file_name}</p>
                      </div>
                      <a href={asset.public_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#fd5523]">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <Input
                      defaultValue={asset.alt_text ?? ""}
                      placeholder="Alt text"
                      onBlur={(event) => handleAssetDetailsUpdate(asset, { alt_text: event.target.value, caption: asset.caption })}
                    />
                    <Textarea
                      defaultValue={asset.caption ?? ""}
                      placeholder="Caption"
                      rows={3}
                      onBlur={(event) => handleAssetDetailsUpdate(asset, { alt_text: asset.alt_text, caption: event.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pages" className="space-y-6">
          {pageSlots.map((slot) => (
            <Card key={slot.id} className="border-0 rounded-[2rem] shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="grid lg:grid-cols-[320px_1fr]">
                  <div className="bg-slate-100 min-h-[220px]">
                    {slot.resolved_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={slot.resolved_url} alt={slot.resolved_alt_text ?? slot.label} className="h-full w-full object-cover" />
                      </>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-300">
                        <ImageIcon className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#062e39]">{slot.label}</h3>
                        <p className="text-sm text-slate-500">{slot.description}</p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        <span className="rounded-full bg-slate-100 px-3 py-1">{slot.page_key}</span>
                        <span className="rounded-full bg-[#fff6ee] px-3 py-1 text-[#fd5523]">{slot.slot_key}</span>
                      </div>
                    </div>

                    <Input
                      defaultValue={slot.image_url ?? slot.resolved_url ?? ""}
                      placeholder="Direct image URL"
                      onBlur={(event) => handlePageSlotUrlUpdate(slot, event.target.value)}
                    />
                    <Input
                      defaultValue={slot.alt_text ?? slot.resolved_alt_text ?? ""}
                      placeholder="Alt text"
                      onBlur={(event) => handlePageSlotAltUpdate(slot, event.target.value)}
                    />

                    <div className="grid md:grid-cols-[1fr_auto_auto] gap-3">
                      <select
                        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                        value={slotSelections[slot.id] ?? ""}
                        onChange={(event) =>
                          setSlotSelections((current) => ({ ...current, [slot.id]: event.target.value }))
                        }
                      >
                        <option value="">Assign existing library image</option>
                        {mediaAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.original_name}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" onClick={() => handleAssignPageSlotMedia(slot)}>
                        Assign
                      </Button>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) handleUploadPageSlotMedia(slot, file);
                            event.target.value = "";
                          }}
                        />
                        <div className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#062e39] text-white font-bold">
                          <Upload className="h-4 w-4" />
                          Upload
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="blog" className="space-y-6">
          {blogPosts.map((post) => (
            <Card key={post.id} className="border-0 rounded-[2rem] shadow-lg overflow-hidden">
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#062e39]">{post.title}</h3>
                    <p className="text-sm text-slate-500">{post.slug}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">{post.category}</span>
                    <span className="rounded-full bg-[#fff6ee] px-3 py-1 text-[#fd5523]">{post.read_time}</span>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {(["card", "hero"] as const).map((target) => {
                    const currentUrl = target === "card" ? post.card_image_src : post.hero_image_src;
                    const selectMap = target === "card" ? blogCardSelections : blogHeroSelections;

                    return (
                      <div key={target} className="rounded-[1.5rem] border border-slate-100 overflow-hidden">
                        <div className="bg-slate-100 aspect-[16/9]">
                          {currentUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={currentUrl} alt={`${post.title} ${target}`} className="h-full w-full object-cover" />
                            </>
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-300">
                              <ImageIcon className="h-10 w-10" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-[#062e39] capitalize">{target} image</p>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {target === "card" ? "Listing" : "Detail"}
                            </span>
                          </div>
                          <Input
                            defaultValue={target === "card" ? post.card_image_url ?? currentUrl ?? "" : post.hero_image_url ?? currentUrl ?? ""}
                            placeholder="Direct image URL"
                            onBlur={(event) => handleUpdateBlogPostUrl(post, target, event.target.value)}
                          />
                          <div className="grid md:grid-cols-[1fr_auto_auto] gap-3">
                            <select
                              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                              value={selectMap[post.id] ?? ""}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                if (target === "card") {
                                  setBlogCardSelections((current) => ({ ...current, [post.id]: nextValue }));
                                } else {
                                  setBlogHeroSelections((current) => ({ ...current, [post.id]: nextValue }));
                                }
                              }}
                            >
                              <option value="">Assign existing library image</option>
                              {mediaAssets.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                  {asset.original_name}
                                </option>
                              ))}
                            </select>
                            <Button type="button" variant="outline" onClick={() => handleAssignBlogPostMedia(post, target)}>
                              Assign
                            </Button>
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) handleUploadBlogPostMedia(post, target, file);
                                  event.target.value = "";
                                }}
                              />
                              <div className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#062e39] text-white font-bold">
                                <Upload className="h-4 w-4" />
                                Upload
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {(isPending || pendingKey) && (
        <div className="fixed bottom-6 right-6 rounded-full bg-[#062e39] text-white px-4 py-3 shadow-2xl flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-bold">Saving changes…</span>
        </div>
      )}
    </div>
  );
}
