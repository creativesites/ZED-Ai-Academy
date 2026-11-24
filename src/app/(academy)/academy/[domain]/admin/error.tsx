"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AcademyAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Academy admin error:", error);
  }, [error]);

  return (
    <div className="min-h-[75dvh] flex items-center justify-center px-4 py-16 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 text-center space-y-5">
        <div className="h-14 w-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-[#062e39] tracking-tight">
            Admin Console Error
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            An unexpected error occurred while loading this admin view. Your saved data is safe.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <Button
            onClick={reset}
            className="w-full sm:w-auto rounded-xl bg-[#fd5523] hover:bg-[#ef4a16] text-white font-bold text-xs uppercase tracking-wider h-10 px-5"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Home className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
