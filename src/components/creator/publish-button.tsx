"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishCourse } from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Props = {
  courseId: string;
  status: "draft" | "published" | "archived";
};

export function PublishButton({ courseId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isPublished = status === "published";

  function toggle() {
    startTransition(async () => {
      try {
        await publishCourse(courseId, !isPublished);
        toast.success(isPublished ? "Course moved to draft." : "Course published.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not change publish status.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        className={
          isPublished
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }
      >
        {isPublished ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
        {status}
      </Badge>

      <Button
        onClick={toggle}
        disabled={pending}
        size="sm"
        className={
          isPublished
            ? "border-slate-300 bg-white font-semibold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            : "bg-green-600 font-semibold text-white hover:bg-green-500"
        }
        variant={isPublished ? "outline" : "default"}
      >
        {pending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
        )}
        {isPublished ? "Unpublish" : "Publish"}
      </Button>
    </div>
  );
}
