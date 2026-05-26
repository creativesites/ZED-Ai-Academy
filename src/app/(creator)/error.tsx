"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, BookOpen, WifiOff } from "lucide-react";

export default function CreatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isNetwork, setIsNetwork] = useState(false);

  useEffect(() => {
    console.error("[CreatorError]", error);

    const checkNetwork = () => {
      const offline = typeof window !== "undefined" && !navigator.onLine;
      const isNetError = 
        offline ||
        (error as any)?.isNetworkError === true ||
        error?.message?.toLowerCase().includes("fetch") ||
        error?.message?.toLowerCase().includes("network") ||
        error?.message?.toLowerCase().includes("offline") ||
        error?.message?.toLowerCase().includes("connection") ||
        error?.message?.toLowerCase().includes("unreachable");
      
      setIsNetwork(!!isNetError);
    };

    checkNetwork();

    if (typeof window !== "undefined") {
      window.addEventListener("online", checkNetwork);
      window.addEventListener("offline", checkNetwork);
      return () => {
        window.removeEventListener("online", checkNetwork);
        window.removeEventListener("offline", checkNetwork);
      };
    }
  }, [error]);

  if (isNetwork) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-md space-y-8 text-center relative overflow-hidden rounded-3xl border border-slate-200/50 bg-white p-8 shadow-xl">
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-[#fd5523]/5 blur-3xl" />
          
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff6ee] border border-[#fd5523]/10 text-[#fd5523] animate-pulse">
            <WifiOff className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#fd5523]">Network Issue</p>
            <h2 className="text-2xl font-bold tracking-tight text-[#062e39]">Connection failed</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              The studio failed to load due to a network connection issue. Your course content is completely safe — please check your internet and try again.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
            <Button
              onClick={reset}
              className="rounded-full bg-[#fd5523] px-6 py-4 font-bold text-white hover:bg-[#ef4a16] flex items-center justify-center h-12"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-slate-200 bg-white px-6 py-4 font-bold text-[#062e39] hover:bg-slate-50 flex items-center justify-center h-12"
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
