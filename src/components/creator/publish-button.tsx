"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishCourse } from "@/actions/courses";
import { publishCourseDraftFlows } from "@/actions/tutor-authoring";
import { EyeOff, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  courseId: string;
  status: "draft" | "published" | "archived";
  tenantSlug?: string;
  /** All required launch-checklist items are done. */
  ready?: boolean;
  variant?: "default" | "dark";
};

export function PublishButton({ courseId, status, tenantSlug, ready = true, variant = "default" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isPublished = status === "published";

  function toggle() {
    if (isPublished && !window.confirm("Unpublish this course? It disappears from the catalog. Enrolled learners keep access.")) {
      return;
    }
    startTransition(async () => {
      try {
        await publishCourse(courseId, !isPublished, tenantSlug);
        if (!isPublished) {
          await publishCourseDraftFlows(courseId).catch(() => undefined);
        }
        toast.success(isPublished ? "Course moved back to draft." : "Your course is live! 🎉");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not change publish status.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={!isPublished && !ready ? "Finish the launch checklist to publish" : undefined}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all disabled:opacity-60 sm:w-auto",
        isPublished
          ? variant === "dark"
            ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
            : "border border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          : ready
            ? "bg-brand text-white shadow-sm shadow-brand/25 hover:bg-brand-hover"
            : variant === "dark"
              ? "bg-white/10 text-white/80 hover:bg-white/15"
              : "bg-ink text-white hover:bg-ink-hover"
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isPublished ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Rocket className="h-4 w-4" />
      )}
      {isPublished ? "Unpublish" : "Publish"}
    </button>
  );
}
