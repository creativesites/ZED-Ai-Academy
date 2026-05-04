"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f7f4] px-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff6ee]">
          <AlertTriangle className="h-10 w-10 text-[#fd5523]" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-[#062e39]">Something went wrong</h1>
          <p className="text-base leading-relaxed text-slate-500">
            An unexpected error occurred. It's been logged and we'll look into it.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-slate-400">Error ID: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={reset}
            className="rounded-full bg-[#fd5523] px-8 py-5 font-bold text-white hover:bg-[#ef4a16]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-8 py-5 font-bold text-[#062e39] hover:bg-slate-50"
            render={<Link href="/" />}
          >
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
