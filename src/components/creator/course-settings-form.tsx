"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCourse, publishCourse, deleteCourse } from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  ShieldCheck,
  Save,
  FileText,
  Sparkles,
  Upload,
  X,
  CircleDollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { COURSE_CATEGORIES } from "@/lib/course-experience";
import { uploadMedia } from "@/actions/upload";
import type { Course } from "@/types/database";

export function CourseSettingsForm({ course, tenantSlug }: { course: Course; tenantSlug?: string }) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [publishPending, startPublish] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [status, setStatus] = useState<Course["status"]>(course.status);
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url ?? "");
  const [priceType, setPriceType] = useState<Course["price_type"]>(course.price_type);
  const [uploading, setUploading] = useState(false);

  const showsPriceAmount = priceType === "one_time" || priceType === "both";

  function handleSubmit(formData: FormData) {
    startSave(async () => {
      try {
        await updateCourse(course.id, formData, tenantSlug);
        toast.success("Course details updated.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to save course settings.");
      }
    });
  }

  function handlePublishToggle() {
    startPublish(async () => {
      const targetPublish = status !== "published";
      try {
        await publishCourse(course.id, targetPublish, tenantSlug);
        setStatus(targetPublish ? "published" : "draft");
        toast.success(targetPublish ? "Course published." : "Course moved to draft.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to change publish status.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Permanently delete "${course.title}"? This cannot be undone.`)) return;
    startDelete(async () => {
      try {
        await deleteCourse(course.id, tenantSlug);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete course.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Visibility Status Banner */}
      <section className="rounded-2xl sm:rounded-3xl border border-[#fd5523]/15 bg-[#fff6ee]/60 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                status === "published"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {status === "published" ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-[#062e39] uppercase tracking-tight">
                Status: {status}
              </p>
              <p className="text-xs sm:text-sm text-slate-500">
                {status === "published"
                  ? "Your course is live and visible to learners."
                  : "Only staff can preview this draft. Publish when ready."}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handlePublishToggle}
            disabled={publishPending}
            className={`h-11 w-full sm:w-auto rounded-xl px-6 text-sm font-bold transition-all ${
              status === "published"
                ? "bg-[#062e39] text-white hover:bg-[#0a4055]"
                : "bg-[#fd5523] text-white hover:bg-[#ef4a16]"
            }`}
          >
            {publishPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {status === "published" ? "Move to Draft" : "Go Live Now"}
          </Button>
        </div>
      </section>

      <form action={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Core Info */}
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[#fd5523]">
                <FileText className="h-4 w-4" />
                <h3 className="text-sm font-black uppercase tracking-wider text-[#062e39]">
                  Core Identity
                </h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Course Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={course.title}
                  required
                  className="h-11 rounded-xl border-slate-200 bg-white text-base font-semibold text-[#062e39] focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Transformation Summary
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={course.description ?? ""}
                  rows={5}
                  placeholder="What will learners be able to DO after this course?"
                  className="resize-none rounded-xl border-slate-200 bg-white p-3.5 text-sm leading-relaxed text-[#062e39] focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Media & Meta */}
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[#fd5523]">
                <Sparkles className="h-4 w-4" />
                <h3 className="text-sm font-black uppercase tracking-wider text-[#062e39]">
                  Cover & Metadata
                </h3>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Course Cover Image
                </Label>
                <input type="hidden" name="thumbnail_url" value={thumbnailUrl} />

                <div className="relative mt-1">
                  {uploading ? (
                    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#fd5523]/30 bg-[#fd5523]/5 p-4 text-center">
                      <Loader2 className="h-7 w-7 animate-spin text-[#fd5523]" />
                      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[#062e39]">
                        Uploading cover image...
                      </p>
                    </div>
                  ) : thumbnailUrl ? (
                    <div className="group relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnailUrl}
                        alt="Course cover preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setThumbnailUrl("")}
                        aria-label="Remove cover image"
                        className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white transition-all hover:bg-black shadow-md"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="group flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-4 text-center transition-all hover:border-[#fd5523]/40 hover:bg-[#fd5523]/5">
                      <Upload className="h-7 w-7 text-slate-400 transition-colors group-hover:text-[#fd5523]" />
                      <span className="mt-2 text-xs font-bold text-slate-600 group-hover:text-[#062e39]">
                        Click to upload cover image
                      </span>
                      <span className="mt-1 text-[11px] text-slate-400">
                        PNG, JPG, or WEBP up to 5MB (16:9)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            formData.append("courseId", course.id);
                            formData.append("folder", "thumbnails");

                            const res = await uploadMedia(formData);
                            setThumbnailUrl(res.url);
                            toast.success("Cover image uploaded!");
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Failed to upload image."
                            );
                          } finally {
                            setUploading(false);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Category
                  </Label>
                  <select
                    name="category"
                    defaultValue={course.category ?? ""}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                  >
                    <option value="">No category</option>
                    {COURSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Target Level
                  </Label>
                  <select
                    name="level"
                    defaultValue={course.level ?? ""}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                  >
                    <option value="">No level</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:col-span-2">
            <CardContent className="grid gap-5 p-5 sm:p-6 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-2 text-[#fd5523]">
                  <CircleDollarSign className="h-4 w-4" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#062e39]">
                    Pricing
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Set how learners pay to access this course.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Price Model
                </Label>
                <select
                  name="price_type"
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value as Course["price_type"])}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                >
                  <option value="free">Free</option>
                  <option value="one_time">One-time purchase</option>
                  <option value="subscription_only">Subscription only</option>
                  <option value="both">Both</option>
                </select>
              </div>

              {showsPriceAmount && (
                <div className="space-y-2">
                  <Label htmlFor="price_amount" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Price (ZMW)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ZK
                    </span>
                    <Input
                      id="price_amount"
                      name="price_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={course.price_amount ?? ""}
                      className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm font-bold text-[#062e39]"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={handleDelete}
            className="h-11 w-full sm:w-auto rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold text-sm"
          >
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete Course
          </Button>

          <Button
            type="submit"
            disabled={saving}
            className="h-11 w-full sm:w-auto rounded-xl bg-[#fd5523] px-7 text-sm font-bold text-white transition-all hover:bg-[#ef4a16] shadow-sm"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Course Details
          </Button>
        </div>
      </form>
    </div>
  );
}
