import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Search, Home, BookOpen } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f7f4] px-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-ink">
          <Search className="h-10 w-10 text-white" />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-text">404</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Page not found</h1>
          <p className="text-base leading-relaxed text-slate-500">
            This page doesn't exist or may have been moved.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            className="rounded-full bg-brand px-8 py-5 font-bold text-white hover:bg-brand-hover"
            render={<Link href="/" />}
          >
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-8 py-5 font-bold text-ink hover:bg-slate-50"
            render={<Link href="/#academies" />}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Explore Academies
          </Button>
        </div>
      </div>
    </div>
  );
}
