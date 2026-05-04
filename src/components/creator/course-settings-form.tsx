"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCourse, publishCourse, deleteCourse } from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff, Trash2, ShieldCheck, Save, FileText, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { COURSE_CATEGORIES } from "@/lib/course-experience";
import type { Course } from "@/types/database";

export function CourseSettingsForm({ course }: { course: Course }) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [publishPending, startPublish] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [status, setStatus] = useState<Course["status"]>(course.status);

  function handleSubmit(formData: FormData) {
    startSave(async () => {
      try {
        await updateCourse(course.id, formData);
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
        await publishCourse(course.id, targetPublish);
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
        await deleteCourse(course.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to delete course.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="marketing-outline-card rounded-[2.5rem] border-0 bg-[#fff6ee]/50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
              status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>
              {status === "published" ? <Eye className="h-7 w-7" /> : <EyeOff className="h-7 w-7" />}
            </div>
            <div>
              <p className="text-xl font-bold text-[#062e39] uppercase tracking-tight">Status: {status}</p>
              <p className="text-sm font-medium text-slate-500">
                {status === "published"
                  ? "Your course is live and visible to all learners."
                  : "Only you can see this course. Publish it when ready."}
              </p>
            </div>
          </div>

          <Button
            onClick={handlePublishToggle}
            disabled={publishPending}
            className={`rounded-full px-8 py-6 text-base font-bold transition-all ${
              status === "published"
                ? "bg-[#062e39] text-white hover:bg-[#0a4055]"
                : "bg-[#fd5523] text-white hover:bg-[#ef4a16]"
            }`}
          >
            {publishPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <ShieldCheck className="mr-2 h-5 w-5" />
            {status === "published" ? "Move to Draft" : "Go Live Now"}
          </Button>
        </div>
      </section>

      <form action={handleSubmit} className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Core Info */}
          <Card className="marketing-card rounded-[2.5rem] border-0 p-2 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center gap-2 text-[#fd5523]">
                <FileText className="h-5 w-5" />
                <h3 className="font-bold uppercase tracking-[0.15em] text-[#062e39]">Core Identity</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Course Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={course.title}
                  required
                  className="h-12 rounded-2xl border-slate-200 bg-white text-lg font-medium text-[#062e39] transition-all focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Transformation Summary
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={course.description ?? ""}
                  rows={4}
                  placeholder="What will learners be able to DO after this course?"
                  className="rounded-2xl border-slate-200 bg-white p-4 text-base leading-relaxed text-[#062e39] focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Media & Meta */}
          <Card className="marketing-card rounded-[2.5rem] border-0 p-2 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center gap-2 text-[#fd5523]">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-bold uppercase tracking-[0.15em] text-[#062e39]">Presentation</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail_url" className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Thumbnail URL
                </Label>
                <Input
                  id="thumbnail_url"
                  name="thumbnail_url"
                  type="url"
                  defaultValue={course.thumbnail_url ?? ""}
                  className="h-12 rounded-2xl border-slate-200 bg-white text-base text-[#062e39]"
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Category</Label>
                  <select
                    name="category"
                    defaultValue={course.category ?? ""}
                    className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
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
                  <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Target Level</Label>
                  <select
                    name="level"
                    defaultValue={course.level ?? ""}
                    className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
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
          <Card className="marketing-card rounded-[2.5rem] border-0 p-2 shadow-sm lg:col-span-2">
            <CardContent className="grid gap-8 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col justify-center gap-2">
                <div className="flex items-center gap-2 text-[#fd5523]">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="font-bold uppercase tracking-[0.15em] text-[#062e39]">Commercials</h3>
                </div>
                <p className="text-sm text-slate-500">Set how learners will pay to access this curriculum.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Price Model</Label>
                <select
                  name="price_type"
                  defaultValue={course.price_type}
                  className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                >
                  <option value="free">Free</option>
                  <option value="one_time">One-time purchase</option>
                  <option value="subscription_only">Subscription only</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_amount" className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Price (ZMW)
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">ZK</span>
                  <Input
                    id="price_amount"
                    name="price_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={course.price_amount ?? ""}
                    className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-lg font-bold text-[#062e39]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[2.5rem] bg-[#062e39] p-6 text-white shadow-xl">
          <Button type="submit" disabled={saving} className="rounded-full bg-[#fd5523] px-10 py-6 text-lg font-bold text-white transition-all hover:bg-[#ef4a16] hover:scale-105 active:scale-95">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Save Course Studio Details
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={deleting}
            onClick={handleDelete}
            className="rounded-full border border-white/20 text-white/70 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
          >
            {deleting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Trash2 className="mr-2 h-5 w-5" />}
            Archive Course
          </Button>
        </div>
      </form>
    </div>
  );
}
