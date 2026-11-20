"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Rocket } from "lucide-react";
import { useProfileNav } from "@/hooks/use-profile-nav";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "header" | "mobileMenu";
};

export function LaunchAcademyCTA({ className, variant = "header" }: Props) {
  const { isSignedIn } = useAuth();
  const { loaded, needsAcademyLaunch } = useProfileNav();

  if (!isSignedIn || !loaded || !needsAcademyLaunch) return null;

  if (variant === "mobileMenu") {
    return (
      <Link
        href="/launch-your-academy"
        className={cn(
          "flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-[#062e39] text-white text-sm font-bold hover:bg-[#0a4055] transition-colors",
          className
        )}
      >
        <Rocket className="h-4 w-4 text-[#fd5523]" />
        <span>Launch Your Academy</span>
      </Link>
    );
  }

  return (
    <Link
      href="/launch-your-academy"
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#062e39] text-white text-xs font-bold hover:bg-[#0a4055] transition-colors whitespace-nowrap shadow-xs",
        className
      )}
    >
      <Rocket className="h-3.5 w-3.5 text-[#fd5523]" />
      <span>Launch Academy</span>
    </Link>
  );
}
