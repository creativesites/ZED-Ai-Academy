"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home, WifiOff } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isNetwork, setIsNetwork] = useState(false);

  useEffect(() => {
    console.error("[GlobalError]", error);
    
    // Check if it's a network error
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f7f4] px-6">
        <div className="w-full max-w-md space-y-8 text-center relative overflow-hidden rounded-3xl border border-slate-200/50 bg-white p-8 shadow-xl">
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-[#fd5523]/5 blur-3xl" />
          
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff6ee] border border-[#fd5523]/10 text-[#fd5523] animate-pulse">
            <WifiOff className="h-10 w-10" />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-widest text-[#fd5523]">Network Issue</p>
            <h1 className="text-3xl font-bold tracking-tight text-[#062e39]">Connection failed</h1>
            <p className="text-base leading-relaxed text-slate-500">
              The site failed to load due to a network issue. Please check your internet connection and try again.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
            <Button
              onClick={reset}
              className="rounded-full bg-[#fd5523] px-8 py-5 font-bold text-white hover:bg-[#ef4a16] shadow-lg shadow-[#fd5523]/10 flex items-center justify-center"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-slate-200 bg-white px-8 py-5 font-bold text-[#062e39] hover:bg-slate-50 flex items-center justify-center"
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
