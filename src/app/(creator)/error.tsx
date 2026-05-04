"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, BookOpen } from "lucide-react";

export default function CreatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CreatorError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff6ee]">
          <AlertTriangle className="h-8 w-8 text-[#fd5523]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-[#062e39]">Studio error</h2>
          <p className="text-sm leading-relaxed text-slate-500">
            Something went wrong in the course studio. Your content is safe — try again or return to your courses.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-slate-400">Ref: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={reset}
            className="rounded-full bg-[#fd5523] px-6 py-4 font-bold text-white hover:bg-[#ef4a16]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-6 py-4 font-bold text-[#062e39] hover:bg-slate-50"
            render={<Link href="/creator/courses" />}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            My Courses
          </Button>
        </div>
      </div>
    </div>
  );
}
